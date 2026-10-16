(function () {
  "use strict";

  var KEY_PERFIL = "econochanta:v1:perfil";
  var KEY_ALERTAS = "econochanta:v1:alertas";
  var KEY_TEMA = "econochanta:v1:tema";
  var KEY_PLATA = "econochanta:v1:plata";

  /* ---------- utilidades ---------- */

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load(key, fallback) {
    var base = clone(fallback);
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return base;
      var saved = JSON.parse(raw);
      Object.keys(base).forEach(function (k) {
        if (base[k] !== null && typeof base[k] === "object") {
          if (saved[k] && typeof saved[k] === "object") {
            Object.keys(base[k]).forEach(function (kk) {
              if (typeof saved[k][kk] === typeof base[k][kk]) base[k][kk] = saved[k][kk];
            });
          }
        } else if (typeof saved[k] === typeof base[k]) {
          base[k] = saved[k];
        }
      });
    } catch (e) { /* sin storage: se usa el ejemplo */ }
    return base;
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignorar */ }
  }

  var f0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
  function ars(n) { return "$ " + f0.format(Math.round(n)); }
  function pct(n, d) {
    var dec = d === undefined ? 2 : d;
    var s = n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return (n > 0 ? "+" : "") + s + "%";
  }
  function pctPlain(n, d) {
    var dec = d === undefined ? 1 : d;
    return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + "%";
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function hace(iso) {
    var min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 1) return "recién";
    if (min < 60) return "hace " + min + " min";
    var h = Math.round(min / 60);
    if (h < 24) return "hace " + h + " h";
    return "hace " + Math.round(h / 24) + " d";
  }
  function hora(iso) {
    return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
  function urlSegura(u) {
    return typeof u === "string" && /^https?:\/\//i.test(u) ? u : null;
  }

  /* ---------- estado ---------- */

  var M = clone(window.ECONO_MOCK);
  var perfil = load(KEY_PERFIL, window.ECONO_PERFIL_DEFAULT);
  var alertas = load(KEY_ALERTAS, window.ECONO_ALERTAS_DEFAULT);
  var plata = null;
  try { plata = JSON.parse(localStorage.getItem(KEY_PLATA) || "null"); } catch (e) { plata = null; }
  var filtro = { tema: "todos", medio: "todos" };
  var cargando = false;

  /* ---------- modelo ---------- */

  function serie() {
    var s = M.serieMep30d;
    var min = Math.min.apply(null, s);
    var max = Math.max.apply(null, s);
    return { rango: (max - min) / min * 100, var30: (s[s.length - 1] / s[0] - 1) * 100 };
  }

  var MAPA_IPC = {
    "Transporte": "transporte", "Hogar": "equipamiento", "Salud": "salud",
    "Ocio": "recreacion", "Compras": "prendas", "Educación": "educacion"
  };

  function inflacionPersonal() {
    if (!plata || !plata.gastoPorCat || !M.ipc || !M.ipc.general) return null;
    var gen = M.ipc.general.mom;
    var total = 0, suma = 0, cubierto = 0, filas = [];
    Object.keys(plata.gastoPorCat).forEach(function (c) {
      if (c === "Deudas") return;
      var monto = plata.gastoPorCat[c];
      if (!(monto > 0)) return;
      var key = MAPA_IPC[c];
      var dato = key && M.ipc[key] ? M.ipc[key].mom : null;
      var v = dato !== null ? dato : gen;
      total += monto; suma += monto * v;
      if (dato !== null) cubierto += monto;
      filas.push({ cat: c, monto: monto, v: v, propio: dato !== null });
    });
    if (total <= 0) return null;
    filas.forEach(function (f) { f.share = f.monto / total * 100; });
    filas.sort(function (a, b) { return b.share - a.share; });
    var pers = suma / total;
    return {
      personal: pers, general: gen,
      ratio: gen > 0 ? clamp(pers / gen, 0.5, 2) : 1,
      cobertura: cubierto / total * 100, filas: filas, fecha: M.ipc.general.fecha
    };
  }

  function exposicion(p) {
    var mep = M.dolar.mep;
    var ingreso = num(p.ingreso), ahARS = num(p.ahorroARS), ahUSD = num(p.ahorroUSD);
    var alq = num(p.alquiler), gUSD = num(p.gastoUSD);
    var pesosIngreso = ingreso * 3;
    var usdEnPesos = ahUSD * mep;
    var total = pesosIngreso + ahARS + usdEnPesos;
    var base = total > 0 ? total : 1;
    return {
      total: total,
      wIngreso: pesosIngreso / base,
      wAhorroARS: ahARS / base,
      wUSD: usdEnPesos / base,
      idx: ingreso > 0 ? clamp(alq / ingreso, 0, 1) : 0,
      viaje: ingreso > 0 ? clamp(gUSD * mep / ingreso, 0, 1) : 0
    };
  }

  function factores(p) {
    var e = exposicion(p);
    var s = serie();
    var ip = inflacionPersonal();
    var infl = M.inflacionMensual * (ip ? ip.ratio : 1);
    var brechaCcl = (M.dolar.ccl / M.dolar.oficial - 1) * 100;
    var tasaReal = M.tnaPlazoFijo / 12 - infl;

    var lista = [
      {
        id: "inflacion", nombre: ip ? "Tu inflación del mes" : "Inflación del mes", valor: pctPlain(infl, 1),
        score: clamp(100 - (infl - 0.5) / 5 * 100, 0, 100),
        peso: 1 + 2 * (e.wIngreso + e.wAhorroARS) + 2 * e.idx
      },
      {
        id: "tasaReal", nombre: "Plazo fijo contra precios", valor: pct(tasaReal, 1) + " por mes",
        score: clamp((tasaReal + 3) / 4 * 100, 0, 100),
        peso: 1 + 3 * e.wAhorroARS
      },
      {
        id: "brecha", nombre: "Brecha CCL", valor: pctPlain(brechaCcl, 1),
        score: clamp(100 - brechaCcl / 20 * 100, 0, 100),
        peso: 1 + 2 * e.wUSD + 2 * e.viaje
      },
      {
        id: "volatilidad", nombre: "Movimiento del dólar, 30 días", valor: pctPlain(s.rango, 1),
        score: clamp(100 - s.rango / 15 * 100, 0, 100),
        peso: 1 + 1.5 * e.wUSD + 1.5 * e.viaje
      },
      {
        id: "reservas", nombre: "Reservas, 30 días", valor: pct(M.reservasVar30d, 1),
        score: clamp((M.reservasVar30d + 10) / 15 * 100, 0, 100),
        peso: 1
      }
    ];

    var sumaPesos = lista.reduce(function (a, f) { return a + f.peso; }, 0);
    var score = lista.reduce(function (a, f) { return a + f.peso * f.score; }, 0) / sumaPesos;
    lista.forEach(function (f) { f.pesoPct = f.peso / sumaPesos * 100; });

    return { lista: lista, score: Math.round(score), e: e, s: s, infl: infl, brechaCcl: brechaCcl, tasaReal: tasaReal, ip: ip };
  }

  function mood(score) {
    if (score >= 70) return { id: "tranquilo", texto: "tranquilo" };
    if (score >= 50) return { id: "atento", texto: "atento" };
    if (score >= 30) return { id: "turbulento", texto: "turbulento" };
    return { id: "critico", texto: "crítico" };
  }

  function tono(score) {
    if (score >= 65) return { t: "ok", texto: "Bien" };
    if (score >= 40) return { t: "warn", texto: "Ojo" };
    return { t: "bad", texto: "Mal" };
  }

  function variaciones(r) {
    var e = r.e;
    var infD = r.infl / 30;
    var plazoD = M.tnaPlazoFijo / 365;
    var dMep = (M.dolar.mep / M.dolar.ayer.mep - 1) * 100;
    var dia = e.wIngreso * (-infD) + e.wAhorroARS * (plazoD - infD) + e.wUSD * (dMep - infD);
    var mes = e.wIngreso * (-r.infl) + e.wAhorroARS * (M.tnaPlazoFijo / 12 - r.infl) + e.wUSD * (r.s.var30 - r.infl);
    return { dia: dia, mes: mes, pesos: mes / 100 * e.total };
  }

  function mensajeDelDia(r) {
    var peor = r.lista.slice().sort(function (a, b) {
      return b.peso * (100 - b.score) - a.peso * (100 - a.score);
    })[0];
    switch (peor.id) {
      case "inflacion":
        return "Lo que más te pega es la inflación del mes: " + pctPlain(r.infl, 1) + (r.ip ? " según lo que gastás vos" : "") + ". Tu sueldo y tus ahorros en pesos tienen que rendir al menos eso para no perder.";
      case "tasaReal":
        return r.tasaReal < 0
          ? "Tu plazo fijo pierde " + pctPlain(Math.abs(r.tasaReal), 1) + " por mes contra los precios. Mirá la calculadora antes de renovar."
          : "Tu plazo fijo le gana a la inflación por poco: " + pctPlain(r.tasaReal, 1) + " por mes. No es para festejar.";
      case "brecha":
        return "La brecha CCL está en " + pctPlain(r.brechaCcl, 1) + ". Si vas a comprar o vender dólares, fijate qué cotización te aplican.";
      case "volatilidad":
        return "El dólar se movió " + pctPlain(r.s.rango, 1) + " entre su mínimo y su máximo de los últimos 30 días. Evitá decidir apurado.";
      default:
        return "Las reservas " + (M.reservasVar30d < 0 ? "cayeron " : "subieron ") + pctPlain(Math.abs(M.reservasVar30d), 1) + " en 30 días. Es la señal más débil del día y no te toca de forma directa, pero conviene saberlo.";
    }
  }

  /* ---------- Inicio: tapa de noticias ---------- */

  var TEMAS_FALLBACK = [
    { id: "dolar", label: "Dólar" }, { id: "inflacion", label: "Inflación y precios" },
    { id: "mercados", label: "Mercados" }, { id: "actividad", label: "Actividad y empleo" },
    { id: "politica", label: "Política económica" }, { id: "empresas", label: "Empresas" },
    { id: "otros", label: "Otros" }
  ];

  function temasDe(n) { return (n && n.temas) || TEMAS_FALLBACK; }
  function labelTema(n, id) {
    var t = temasDe(n).filter(function (x) { return x.id === id; })[0];
    return t ? t.label : "Otros";
  }

  function chip(texto, activo, onClick) {
    var b = el("button", "chip", texto);
    b.type = "button";
    b.setAttribute("aria-pressed", activo ? "true" : "false");
    b.addEventListener("click", onClick);
    return b;
  }

  function itemNoticia(it, n, mostrarTema) {
    var li = el("li");
    var url = urlSegura(it.url);
    var a = el(url ? "a" : "span", "news");
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
    var meta = el("span", "news__meta");
    meta.appendChild(el("span", "news__medio", String(it.medio || "")));
    meta.appendChild(el("span", "news__time", it.fecha ? hace(it.fecha) : ""));
    if (mostrarTema) {
      var p = el("span", "pill pill--tema", labelTema(n, it.tema));
      meta.appendChild(p);
    }
    a.appendChild(meta);
    a.appendChild(el("span", "news__title", String(it.titulo || "")));
    li.appendChild(a);
    return li;
  }

  function renderNoticias() {
    var cont = $("noticias");
    var nota = $("noticias-nota");
    var chipsT = $("chips-tema"), chipsM = $("chips-medio");
    cont.textContent = ""; chipsT.textContent = ""; chipsM.textContent = "";
    var n = M.noticias;

    if (!n || !n.items || !n.items.length) {
      var vacio = el("div", "card empty");
      vacio.appendChild(el("p", "empty__title", "No hay titulares todavía"));
      vacio.appendChild(el("p", "empty__text", "Las noticias se generan con scripts/fetch_news.py y se guardan en news.json. Corré el script o revisá tu conexión y tocá Actualizar."));
      cont.appendChild(vacio);
      nota.textContent = "";
      return;
    }

    var items = n.items;
    var conteoTema = {}, conteoMedio = {};
    items.forEach(function (it) {
      conteoTema[it.tema] = (conteoTema[it.tema] || 0) + 1;
      conteoMedio[it.medio] = (conteoMedio[it.medio] || 0) + 1;
    });

    chipsT.appendChild(chip("Todas (" + items.length + ")", filtro.tema === "todos", function () { filtro.tema = "todos"; renderNoticias(); }));
    temasDe(n).forEach(function (t) {
      if (!conteoTema[t.id]) return;
      chipsT.appendChild(chip(t.label + " (" + conteoTema[t.id] + ")", filtro.tema === t.id, function () { filtro.tema = t.id; renderNoticias(); }));
    });
    chipsM.appendChild(chip("Todos los medios", filtro.medio === "todos", function () { filtro.medio = "todos"; renderNoticias(); }));
    Object.keys(conteoMedio).forEach(function (m) {
      chipsM.appendChild(chip(m, filtro.medio === m, function () { filtro.medio = m; renderNoticias(); }));
    });

    var filtrados = items.filter(function (it) {
      return (filtro.tema === "todos" || it.tema === filtro.tema) && (filtro.medio === "todos" || it.medio === filtro.medio);
    });

    function seccion(titulo, lista, verMas) {
      var sec = el("section", "card news-sec");
      var h = el("h2", "label", titulo);
      sec.appendChild(h);
      var ul = el("ul", "news-list");
      lista.forEach(function (it) { ul.appendChild(itemNoticia(it, n, true)); });
      sec.appendChild(ul);
      if (verMas) sec.appendChild(verMas);
      return sec;
    }

    if (!filtrados.length) {
      var v = el("div", "card empty");
      v.appendChild(el("p", "empty__title", "Sin resultados"));
      v.appendChild(el("p", "empty__text", "No hay titulares con ese filtro en las últimas " + (n.ventanaHoras || 48) + " horas."));
      cont.appendChild(v);
    } else if (filtro.tema === "todos" && filtro.medio === "todos") {
      var ultimas = filtrados.slice(0, 8);
      cont.appendChild(seccion("Lo último", ultimas, null));
      var usados = {};
      ultimas.forEach(function (it) { usados[it.url] = true; });
      temasDe(n).forEach(function (t) {
        var resto = filtrados.filter(function (it) { return it.tema === t.id && !usados[it.url]; });
        if (!resto.length) return;
        var btn = null;
        if (resto.length > 4) {
          btn = el("button", "link link--btn", "Ver las " + resto.length + " de " + t.label);
          btn.type = "button";
          btn.addEventListener("click", function () { filtro.tema = t.id; renderNoticias(); window.scrollTo(0, 0); });
        }
        cont.appendChild(seccion(t.label, resto.slice(0, 4), btn));
      });
    } else {
      var titulo = (filtro.tema === "todos" ? "Todos los temas" : labelTema(n, filtro.tema)) + (filtro.medio === "todos" ? "" : " en " + filtro.medio);
      cont.appendChild(seccion(titulo + " (" + filtrados.length + ")", filtrados.slice(0, 60), null));
    }

    var okMedios = (n.fuentes || []).filter(function (f) { return f.ok; }).map(function (f) { return f.medio; });
    nota.textContent = "Titulares de " + okMedios.join(", ") + ". Se abren en el sitio de cada medio. Ventana de " + (n.ventanaHoras || 48) +
      " horas, con temas asignados por palabras del título. Actualizado " + (n.actualizado ? hace(n.actualizado) : "sin dato") + ".";
  }

  function renderInicio() {
    renderNoticias();
  }

  /* ---------- estado de datos ---------- */

  var ETIQUETAS = {
    dolar: "cotizaciones", historia: "histórico del dólar", inflacion: "inflación",
    plazoFijo: "plazo fijo", reservas: "reservas", ipc: "inflación por rubro", noticias: "noticias"
  };

  function renderEstado() {
    var banner = $("banner");
    var stamp = $("actualizado");
    if (M.actualizadoEn) stamp.textContent = (M.esMock ? "Datos de ejemplo" : "En vivo") + ", actualizado " + hora(M.actualizadoEn);
    else stamp.textContent = "Datos de ejemplo, sin actualizar";

    var fallas = M.estado ? Object.keys(M.estado).filter(function (k) { return !M.estado[k]; }) : [];
    if (!M.actualizadoEn) {
      banner.hidden = false;
      banner.textContent = "Mostrando datos de ejemplo mientras se cargan los reales.";
    } else if (fallas.length) {
      banner.hidden = false;
      banner.textContent = "No se pudo traer: " + fallas.map(function (k) { return ETIQUETAS[k] || k; }).join(", ") + ". Para eso se muestra el dato de ejemplo.";
    } else {
      banner.hidden = true;
    }
  }

  /* ---------- Tu plata ---------- */

  function renderMiPlata() {
    var r = factores(perfil);
    var v = variaciones(r);
    var m = mood(r.score);

    var heroNum = $("hero-num");
    heroNum.textContent = pct(v.mes, 2);
    heroNum.dataset.signo = v.mes < 0 ? "neg" : v.mes > 0 ? "pos" : "";
    $("hero-sub").textContent = v.mes < 0
      ? "En 30 días, tu plata perdió contra los precios."
      : "En 30 días, tu plata le ganó a los precios.";
    $("hero-dia").textContent = pct(v.dia, 2);
    $("hero-mes").textContent = (v.pesos < 0 ? "-" : "+") + ars(Math.abs(v.pesos));

    $("mensaje").textContent = mensajeDelDia(r);

    $("score").textContent = String(r.score);
    $("mood").textContent = m.texto;
    var g = $("gauge-valor");
    g.dataset.mood = m.id;
    g.style.strokeDashoffset = String(100 - r.score);
    $("gauge-svg").setAttribute("aria-label", "Termómetro personal: " + r.score + " de 100, " + m.texto);

    var ul = $("factores");
    ul.textContent = "";
    r.lista.forEach(function (f) {
      var t = tono(f.score);
      var li = el("li");
      var name = el("span", "factors__name", f.nombre);
      var pill = el("span", "pill", t.texto);
      pill.dataset.t = t.t;
      name.appendChild(pill);
      li.appendChild(name);
      li.appendChild(el("span", "factors__val", f.valor));
      li.appendChild(el("span", "factors__note", "Pesa " + f.pesoPct.toFixed(0) + "% en tu caso."));
      ul.appendChild(li);
    });

    renderPersonal(r.ip);
    renderCotizaciones();
    renderAlertasHoy();
  }

  function renderPersonal(ip) {
    var box = $("personal-cuerpo");
    box.textContent = "";
    if (!ip) {
      box.appendChild(el("p", "note__text", plata
        ? "Todavía no hay índices por rubro para calcularla. Probá actualizar."
        : "Traé tus gastos desde Plata y te mostramos cuánto subió el costo de vida de tus gastos, no el promedio del país."));
      var a = el("a", "link", "Traer datos de Plata");
      a.href = "#perfil";
      box.appendChild(a);
      return;
    }
    var dif = ip.personal - ip.general;
    box.appendChild(el("p", "hero__num hero__num--sm", pctPlain(ip.personal, 2)));
    box.appendChild(el("p", "hero__sub", (dif >= 0 ? "Por encima" : "Por debajo") + " del " + pctPlain(ip.general, 2) +
      " general de " + new Date(ip.fecha + "T12:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" }) + "."));

    var ul = el("ul", "factors");
    ip.filas.slice(0, 6).forEach(function (f) {
      var li = el("li");
      li.appendChild(el("span", "factors__name", f.cat));
      li.appendChild(el("span", "factors__val", pctPlain(f.v, 1)));
      li.appendChild(el("span", "factors__note", "Es el " + f.share.toFixed(0) + "% de tu gasto" + (f.propio ? "." : ", con la inflación general porque no hay índice del rubro.")));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    box.appendChild(el("p", "hint", "El " + ip.cobertura.toFixed(0) + "% de tu gasto tiene índice propio del INDEC. Se usa para ajustar la inflación del mes en tu termómetro."));
  }

  function renderCotizaciones() {
    var d = M.dolar;
    var items = [
      { k: "oficial", n: "Oficial", extra: pct((d.oficial / d.ayer.oficial - 1) * 100, 2) + " hoy" },
      { k: "mep", n: "MEP", extra: "Brecha " + pctPlain((d.mep / d.oficial - 1) * 100, 1) },
      { k: "ccl", n: "CCL", extra: "Brecha " + pctPlain((d.ccl / d.oficial - 1) * 100, 1) },
      { k: "blue", n: "Blue", extra: "Brecha " + pctPlain((d.blue / d.oficial - 1) * 100, 1) }
    ];
    var ul = $("cotizaciones");
    ul.textContent = "";
    items.forEach(function (it) {
      var li = el("li");
      li.appendChild(el("span", "quotes__name", it.n));
      li.appendChild(el("span", "quotes__val", ars(d[it.k])));
      li.appendChild(el("span", "quotes__gap", it.extra));
      ul.appendChild(li);
    });

    var s = M.serieMep30d;
    var min = Math.min.apply(null, s), max = Math.max.apply(null, s);
    var pts = s.map(function (y, i) {
      var x = 4 + i / (s.length - 1) * 292;
      var yy = 62 - (y - min) / (max - min || 1) * 54;
      return x.toFixed(1) + "," + yy.toFixed(1);
    }).join(" ");
    var svg = $("spark");
    svg.textContent = "";
    var pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    pl.setAttribute("points", pts);
    svg.appendChild(pl);
  }

  var NOMBRES_ALERTA = { mep: "MEP", ccl: "CCL", blue: "Blue" };
  function brechaDe(k) { return (M.dolar[k] / M.dolar.oficial - 1) * 100; }

  function renderAlertasHoy() {
    var ul = $("alertas-hoy");
    ul.textContent = "";
    var activas = Object.keys(alertas).filter(function (k) { return alertas[k].activa; });
    if (!activas.length) {
      var vacio = el("li");
      vacio.appendChild(el("p", "alerts__body", "No tenés alertas activas. Prendé alguna en la pestaña Alertas."));
      ul.appendChild(vacio);
    } else {
      activas.forEach(function (k) {
        var b = brechaDe(k);
        var u = alertas[k].umbral;
        var dispara = b >= u;
        var li = el("li");
        li.dataset.on = dispara ? "1" : "0";
        li.appendChild(el("p", "alerts__title", "Brecha " + NOMBRES_ALERTA[k] + ": " + pctPlain(b, 1)));
        li.appendChild(el("p", "alerts__body", dispara
          ? "Superó tu umbral de " + pctPlain(u, 1) + "."
          : "Tu umbral es " + pctPlain(u, 1) + ". Faltan " + (u - b).toFixed(1).replace(".", ",") + " puntos."));
        ul.appendChild(li);
      });
    }
    Object.keys(NOMBRES_ALERTA).forEach(function (k) {
      var now = $("al-" + k + "-now");
      if (now) now.textContent = "Hoy: " + pctPlain(brechaDe(k), 1) + " sobre el oficial";
    });
  }

  /* ---------- Perfil ---------- */

  var CAMPOS = { ingreso: "p-ingreso", ahorroARS: "p-ahorroARS", ahorroUSD: "p-ahorroUSD", alquiler: "p-alquiler", gastoUSD: "p-gastoUSD" };

  function pintarPerfil() {
    Object.keys(CAMPOS).forEach(function (k) { $(CAMPOS[k]).value = String(perfil[k]); });
  }

  function renderExposicion() {
    var e = exposicion(perfil);
    var filas = [
      { n: "Sueldo (3 meses de referencia)", v: pctPlain(e.wIngreso * 100, 0), t: "De toda tu plata, lo que depende de cobrar en pesos." },
      { n: "Ahorros en pesos", v: pctPlain(e.wAhorroARS * 100, 0), t: "Lo que sufre la inflación pero cobra tasa." },
      { n: "Ahorros en dólares", v: pctPlain(e.wUSD * 100, 0), t: "Lo que se mueve con la cotización." },
      { n: "Gastos que se indexan", v: pctPlain(e.idx * 100, 0), t: "Alquiler o cuota UVA contra tu sueldo." },
      { n: "Gasto en dólares", v: pctPlain(e.viaje * 100, 0), t: "Lo que gastás en dólares contra tu sueldo." }
    ];
    var ul = $("exposicion");
    ul.textContent = "";
    filas.forEach(function (f) {
      var li = el("li");
      li.appendChild(el("span", "factors__name", f.n));
      li.appendChild(el("span", "factors__val", f.v));
      li.appendChild(el("span", "factors__note", f.t));
      ul.appendChild(li);
    });
  }

  function refrescarTodoSegunPerfil() {
    renderExposicion();
    renderInicio();
    renderMiPlata();
    var s = $("s-sueldo");
    if (!s.dataset.tocado) { s.value = String(perfil.ingreso); calcSueldo(); }
  }

  function resumirPlata(json) {
    if (!json || !Array.isArray(json.tx)) throw new Error("No parece un backup de Plata (falta la lista de movimientos).");
    var hoyMs = Date.now();
    var corte = new Date(hoyMs - 90 * 86400000).toISOString().slice(0, 10);
    var gasto = {}, ingresos = 0, n = 0, mesesConDatos = {};
    json.tx.forEach(function (t) {
      if (!t || typeof t.date !== "string" || t.date < corte) return;
      var a = Number(t.amount);
      if (!isFinite(a) || a <= 0) return;
      mesesConDatos[t.date.slice(0, 7)] = true;
      if (t.type === "ingreso") { ingresos += a; n++; }
      else {
        var c = typeof t.cat === "string" && t.cat.trim() ? t.cat.trim().slice(0, 40) : "Otros";
        gasto[c] = (gasto[c] || 0) + a; n++;
      }
    });
    if (!n) throw new Error("No hay movimientos en los últimos 90 días.");
    var meses = clamp(Object.keys(mesesConDatos).length, 1, 3);
    var porMes = {}, total = 0;
    Object.keys(gasto).forEach(function (c) { porMes[c] = Math.round(gasto[c] / meses); total += porMes[c]; });
    return {
      importado: new Date().toISOString(), meses: Math.round(meses * 10) / 10, nMov: n,
      gastoPorCat: porMes, gastoTotalMes: total, ingresoMes: Math.round(ingresos / meses)
    };
  }

  function renderPlataEstado() {
    var st = $("plata-estado");
    var usar = $("plata-usar-sueldo"), quitar = $("plata-quitar");
    if (!plata) {
      st.textContent = "Todavía no importaste nada.";
      usar.hidden = true; quitar.hidden = true;
      return;
    }
    st.textContent = "Importado " + hace(plata.importado) + ": " + plata.nMov + " movimientos de " + plata.meses + " meses. Gastás " +
      ars(plata.gastoTotalMes) + " por mes" + (plata.ingresoMes > 0 ? " y cobrás en promedio " + ars(plata.ingresoMes) : "") + ".";
    usar.hidden = !(plata.ingresoMes > 0);
    quitar.hidden = false;
  }

  function initPerfil() {
    pintarPerfil();
    renderExposicion();
    renderPlataEstado();
    $("form-perfil").addEventListener("submit", function (ev) { ev.preventDefault(); });
    $("form-perfil").addEventListener("input", function (ev) {
      var id = ev.target.id;
      Object.keys(CAMPOS).forEach(function (k) {
        if (CAMPOS[k] === id) perfil[k] = Math.max(0, num(ev.target.value));
      });
      save(KEY_PERFIL, perfil);
      $("perfil-estado").textContent = "Guardado en este dispositivo.";
      refrescarTodoSegunPerfil();
    });
    $("perfil-reset").addEventListener("click", function () {
      perfil = clone(window.ECONO_PERFIL_DEFAULT);
      save(KEY_PERFIL, perfil);
      pintarPerfil();
      refrescarTodoSegunPerfil();
      $("perfil-estado").textContent = "Volviste a los datos de ejemplo.";
    });

    $("plata-file").addEventListener("change", function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      var st = $("plata-estado");
      if (f.size > 20 * 1024 * 1024) { st.textContent = "El archivo es demasiado grande para ser un backup de Plata."; return; }
      var rd = new FileReader();
      rd.onload = function () {
        try {
          plata = resumirPlata(JSON.parse(String(rd.result)));
          save(KEY_PLATA, plata);
          renderPlataEstado();
          refrescarTodoSegunPerfil();
        } catch (e) {
          st.textContent = "No pude leer el archivo: " + (e && e.message ? e.message : "formato inválido") + ".";
        }
        ev.target.value = "";
      };
      rd.onerror = function () { st.textContent = "No pude abrir el archivo."; };
      rd.readAsText(f);
    });
    $("plata-usar-sueldo").addEventListener("click", function () {
      if (!plata || !(plata.ingresoMes > 0)) return;
      perfil.ingreso = plata.ingresoMes;
      save(KEY_PERFIL, perfil);
      pintarPerfil();
      refrescarTodoSegunPerfil();
      $("perfil-estado").textContent = "Sueldo actualizado con el promedio de Plata.";
    });
    $("plata-quitar").addEventListener("click", function () {
      plata = null;
      try { localStorage.removeItem(KEY_PLATA); } catch (e) { /* ignorar */ }
      renderPlataEstado();
      refrescarTodoSegunPerfil();
    });
  }

  /* ---------- Alertas ---------- */

  function initAlertas() {
    var ul = $("alertas-config");
    ul.textContent = "";
    Object.keys(NOMBRES_ALERTA).forEach(function (k) {
      var li = el("li");
      var head = el("div", "alert-config__head");
      var left = el("div");
      left.appendChild(el("p", "alert-config__name", "Brecha " + NOMBRES_ALERTA[k]));
      var now = el("p", "alert-config__now", "Hoy: " + pctPlain(brechaDe(k), 1) + " sobre el oficial");
      now.id = "al-" + k + "-now";
      left.appendChild(now);
      head.appendChild(left);

      var sw = el("label", "switch");
      var chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = !!alertas[k].activa;
      chk.id = "al-" + k + "-on";
      sw.appendChild(chk);
      sw.appendChild(el("span", "", "Activa"));
      head.appendChild(sw);
      li.appendChild(head);

      var field = el("div", "field");
      field.style.marginTop = "12px";
      var lab = el("label", "", "Avisarme si la brecha llega a (%)");
      lab.setAttribute("for", "al-" + k + "-u");
      var inp = document.createElement("input");
      inp.type = "number"; inp.id = "al-" + k + "-u"; inp.min = "0"; inp.step = "0.5";
      inp.inputMode = "decimal";
      inp.value = String(alertas[k].umbral);
      field.appendChild(lab);
      field.appendChild(inp);
      li.appendChild(field);

      chk.addEventListener("change", function () {
        alertas[k].activa = chk.checked;
        save(KEY_ALERTAS, alertas);
        renderAlertasHoy();
      });
      inp.addEventListener("input", function () {
        alertas[k].umbral = Math.max(0, num(inp.value));
        save(KEY_ALERTAS, alertas);
        renderAlertasHoy();
      });
      ul.appendChild(li);
    });
  }

  /* ---------- calculadoras ---------- */

  function fila(dt, dd) {
    var d = el("div");
    d.appendChild(el("dt", "", dt));
    d.appendChild(el("dd", "", dd));
    return d;
  }

  function calcPlazoFijo() {
    var monto = Math.max(0, num($("pf-monto").value));
    var tna = Math.max(0, num($("pf-tna").value));
    var dias = Math.max(1, num($("pf-dias").value));
    var sube = num($("pf-dolar").value);
    var box = $("pf-resultado");
    box.textContent = "";
    if (monto <= 0) {
      box.appendChild(el("p", "hint", "Ingresá un monto para ver la comparación."));
      return;
    }
    var ganPF = monto * tna / 100 * dias / 365;
    var finalPF = monto + ganPF;
    var mepFinal = M.dolar.mep * (1 + sube / 100 * dias / 30);
    var finalUSD = monto / M.dolar.mep * mepFinal;
    var rendPF = ganPF / monto * 100;
    var rendUSD = (finalUSD / monto - 1) * 100;
    var inf = M.inflacionMensual * dias / 30;
    var realPF = ((1 + rendPF / 100) / (1 + inf / 100) - 1) * 100;
    var realUSD = ((1 + rendUSD / 100) / (1 + inf / 100) - 1) * 100;
    var dif = Math.abs(rendPF - rendUSD);

    var verdict = rendPF >= rendUSD
      ? "Con tu supuesto, el plazo fijo rinde " + dif.toFixed(1).replace(".", ",") + " puntos más que el dólar."
      : "Con tu supuesto, el dólar rinde " + dif.toFixed(1).replace(".", ",") + " puntos más que el plazo fijo.";
    box.appendChild(el("p", "result__verdict", verdict));

    var dl = el("dl", "result__rows");
    dl.appendChild(fila("Plazo fijo, al final", ars(finalPF)));
    dl.appendChild(fila("Dólar MEP, al final (en pesos)", ars(finalUSD)));
    dl.appendChild(fila("Inflación del período", pct(inf, 1)));
    dl.appendChild(fila("Plazo fijo contra precios", pct(realPF, 1)));
    dl.appendChild(fila("Dólar contra precios", pct(realUSD, 1)));
    box.appendChild(dl);
    box.appendChild(el("p", "hint", "No incluye comisiones, impuestos ni la diferencia entre comprar y vender."));
  }

  function calcSueldo() {
    var hoy = Math.max(0, num($("s-sueldo").value));
    var aum = num($("s-aumento").value);
    var infl = num($("s-inflacion").value);
    var box = $("s-resultado");
    box.textContent = "";
    if (hoy <= 0) {
      box.appendChild(el("p", "hint", "Ingresá tu sueldo para ver el resultado."));
      return;
    }
    var hace12 = hoy / (1 + aum / 100);
    var real = ((1 + aum / 100) / (1 + infl / 100) - 1) * 100;
    var necesario = hace12 * (1 + infl / 100);
    var dif = necesario - hoy;

    box.appendChild(el("p", "result__verdict", real < 0
      ? "Tu sueldo perdió " + pctPlain(Math.abs(real), 1) + " de poder de compra en el último año."
      : "Le ganaste a la inflación por " + pctPlain(real, 1) + "."));

    var dl = el("dl", "result__rows");
    dl.appendChild(fila("Tu sueldo hace 12 meses", ars(hace12)));
    dl.appendChild(fila("Para empatar con la inflación", ars(necesario)));
    dl.appendChild(fila(dif > 0 ? "Te faltan" : "Te sobran", ars(Math.abs(dif))));
    box.appendChild(dl);
  }

  function defaultsCalculadoras() {
    var tna = $("pf-tna"), dol = $("pf-dolar"), inf = $("s-inflacion");
    if (!tna.dataset.tocado) tna.value = String(M.tnaPlazoFijo);
    if (!dol.dataset.tocado) dol.value = serie().var30.toFixed(1);
    if (!inf.dataset.tocado) inf.value = String(M.inflacionInteranual);
    calcPlazoFijo();
    calcSueldo();
  }

  function initCalculadoras() {
    $("s-sueldo").value = String(perfil.ingreso);
    ["pf-monto", "pf-tna", "pf-dias", "pf-dolar"].forEach(function (id) {
      $(id).addEventListener("input", function () { $(id).dataset.tocado = "1"; calcPlazoFijo(); });
    });
    ["s-sueldo", "s-aumento", "s-inflacion"].forEach(function (id) {
      $(id).addEventListener("input", function () { $(id).dataset.tocado = "1"; calcSueldo(); });
    });
    defaultsCalculadoras();

    var tabs = [$("tab-pf"), $("tab-sueldo")];
    var panels = [$("panel-pf"), $("panel-sueldo")];
    function activar(i) {
      tabs.forEach(function (t, j) {
        t.setAttribute("aria-selected", j === i ? "true" : "false");
        t.tabIndex = j === i ? 0 : -1;
        panels[j].hidden = j !== i;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { activar(i); });
      t.addEventListener("keydown", function (ev) {
        if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
          var n = (i + (ev.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
          activar(n);
          tabs[n].focus();
        }
      });
    });
  }

  /* ---------- navegación ---------- */

  var VISTAS = ["tablero", "bcra", "mercados", "mas", "noticias", "miplata", "calcular", "alertas", "perfil"];
  var TITULOS = {
    tablero: "Tablero", bcra: "Banco Central", mercados: "Acciones y bonos", mas: "Más", noticias: "Noticias",
    miplata: "Tu plata", calcular: "Calculadoras", alertas: "Alertas", perfil: "Perfil"
  };
  // las pantallas que cuelgan de "Más" dejan marcada esa pestaña
  var PESTANA = { calcular: "mas", alertas: "mas", perfil: "mas" };

  function route() {
    var partes = (location.hash || "#tablero").slice(1).split(":");
    var h = partes[0];
    if (VISTAS.indexOf(h) === -1) h = "tablero";
    VISTAS.forEach(function (v) { $("vista-" + v).hidden = v !== h; });
    var pestana = PESTANA[h] || h;
    Array.prototype.forEach.call(document.querySelectorAll(".nav a"), function (a) {
      if (a.dataset.vista === pestana) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = (h === "tablero" ? "" : TITULOS[h] + " | ") + "Econochanta";
    if (window.EconoTablero) window.EconoTablero.mostrar(h, partes[1]);
    if (!partes[1]) window.scrollTo(0, 0);
  }

  /* ---------- tema ---------- */

  function temaEfectivo() {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  function pintarBotonTema() {
    $("tema").textContent = temaEfectivo() === "dark" ? "Modo claro" : "Modo oscuro";
  }

  function initTema() {
    try {
      var t = localStorage.getItem(KEY_TEMA);
      if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
    } catch (e) { /* ignorar */ }
    pintarBotonTema();
    $("tema").addEventListener("click", function () {
      var next = temaEfectivo() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(KEY_TEMA, next); } catch (e) { /* ignorar */ }
      pintarBotonTema();
    });
  }

  /* ---------- datos en vivo ---------- */

  function renderTodo() {
    renderEstado();
    renderInicio();
    renderMiPlata();
    renderExposicion();
    defaultsCalculadoras();
  }

  function actualizar() {
    if (cargando || !window.EconoAPI) return;
    cargando = true;
    var b = $("refrescar");
    b.disabled = true; b.textContent = "Actualizando";
    window.EconoAPI.cargar().then(function (datos) {
      M = datos;
      renderTodo();
    }).catch(function () {
      $("banner").hidden = false;
      $("banner").textContent = "No se pudo actualizar. Se muestran los últimos datos que había.";
    }).then(function () {
      cargando = false;
      b.disabled = false; b.textContent = "Actualizar";
    });
  }

  /* ---------- arranque ---------- */

  function init() {
    $("fecha").textContent = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

    var cache = window.EconoAPI ? window.EconoAPI.desdeCache() : null;
    if (cache) M = cache.datos;

    initTema();
    initPerfil();
    initAlertas();
    initCalculadoras();
    $("refrescar").addEventListener("click", actualizar);
    window.EconoApp = {
      noticias: function () { return M.noticias; },
      hace: hace,
      actualizar: actualizar,
      resumenPlata: function () {
        var r = factores(perfil), v = variaciones(r), m = mood(r.score);
        return { mes: v.mes, score: r.score, mood: m.texto };
      }
    };
    renderTodo();
    route();
    window.addEventListener("hashchange", route);

    if (!cache || !cache.vigente) actualizar();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      var c = window.EconoAPI.desdeCache();
      if (!c || !c.vigente) actualizar();
    });

    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* sin offline, sigue andando */ });
    }
  }

  init();
})();
