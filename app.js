(function () {
  "use strict";

  var M = window.ECONO_MOCK;
  var KEY_PERFIL = "econochanta:v1:perfil";
  var KEY_ALERTAS = "econochanta:v1:alertas";
  var KEY_TEMA = "econochanta:v1:tema";

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

  /* ---------- estado ---------- */

  var perfil = load(KEY_PERFIL, window.ECONO_PERFIL_DEFAULT);
  var alertas = load(KEY_ALERTAS, window.ECONO_ALERTAS_DEFAULT);

  /* ---------- modelo ---------- */

  function serie() {
    var s = M.serieMep30d;
    var min = Math.min.apply(null, s);
    var max = Math.max.apply(null, s);
    return { rango: (max - min) / min * 100, var30: (s[s.length - 1] / s[0] - 1) * 100, min: min, max: max };
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
    var infl = M.inflacionMensual;
    var brechaCcl = (M.dolar.ccl / M.dolar.oficial - 1) * 100;
    var tasaReal = M.tnaPlazoFijo / 12 - infl;

    var lista = [
      {
        id: "inflacion", nombre: "Inflación del mes", valor: pctPlain(infl, 1),
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

    return { lista: lista, score: Math.round(score), e: e, s: s, infl: infl, brechaCcl: brechaCcl, tasaReal: tasaReal };
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
        return "Lo que más te pega hoy es la inflación del mes: " + pctPlain(r.infl, 1) + ". Tu sueldo y tus ahorros en pesos tienen que rendir al menos eso para no perder.";
      case "tasaReal":
        return r.tasaReal < 0
          ? "Tu plazo fijo pierde " + pctPlain(Math.abs(r.tasaReal), 1) + " por mes contra los precios. Mirá la calculadora antes de renovar."
          : "Tu plazo fijo le gana a la inflación por poco: " + pctPlain(r.tasaReal, 1) + " por mes. No es para festejar.";
      case "brecha":
        return "La brecha CCL está en " + pctPlain(r.brechaCcl, 1) + ". Si vas a comprar o vender dólares, fijate qué cotización te aplican.";
      case "volatilidad":
        return "El dólar se movió " + pctPlain(r.s.rango, 1) + " entre su mínimo y su máximo de los últimos 30 días. Evitá decidir apurado.";
      default:
        return "Las reservas cayeron " + pctPlain(Math.abs(M.reservasVar30d), 1) + " en 30 días. Es la señal más débil del día y no te toca de forma directa, pero conviene saberlo.";
    }
  }

  /* ---------- render: Hoy ---------- */

  function renderHoy() {
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

    renderCotizaciones();
    renderAlertasHoy();
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
    var ns = "http://www.w3.org/2000/svg";
    var pl = document.createElementNS(ns, "polyline");
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
      return;
    }
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

  /* ---------- render: Perfil ---------- */

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

  function initPerfil() {
    pintarPerfil();
    renderExposicion();
    $("form-perfil").addEventListener("submit", function (ev) { ev.preventDefault(); });
    $("form-perfil").addEventListener("input", function (ev) {
      var id = ev.target.id;
      Object.keys(CAMPOS).forEach(function (k) {
        if (CAMPOS[k] === id) perfil[k] = Math.max(0, num(ev.target.value));
      });
      save(KEY_PERFIL, perfil);
      $("perfil-estado").textContent = "Guardado en este dispositivo.";
      renderExposicion();
      renderHoy();
      var s = $("s-sueldo");
      if (!s.dataset.tocado) { s.value = String(perfil.ingreso); calcSueldo(); }
    });
    $("perfil-reset").addEventListener("click", function () {
      perfil = clone(window.ECONO_PERFIL_DEFAULT);
      save(KEY_PERFIL, perfil);
      pintarPerfil();
      renderExposicion();
      renderHoy();
      $("perfil-estado").textContent = "Volviste a los datos de ejemplo.";
    });
  }

  /* ---------- render: Alertas ---------- */

  function initAlertas() {
    var ul = $("alertas-config");
    ul.textContent = "";
    Object.keys(NOMBRES_ALERTA).forEach(function (k) {
      var li = el("li");
      var head = el("div", "alert-config__head");
      var left = el("div");
      left.appendChild(el("p", "alert-config__name", "Brecha " + NOMBRES_ALERTA[k]));
      left.appendChild(el("p", "alert-config__now", "Hoy: " + pctPlain(brechaDe(k), 1) + " sobre el oficial"));
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
    var hace = hoy / (1 + aum / 100);
    var real = ((1 + aum / 100) / (1 + infl / 100) - 1) * 100;
    var necesario = hace * (1 + infl / 100);
    var dif = necesario - hoy;

    box.appendChild(el("p", "result__verdict", real < 0
      ? "Tu sueldo perdió " + pctPlain(Math.abs(real), 1) + " de poder de compra en el último año."
      : "Le ganaste a la inflación por " + pctPlain(real, 1) + "."));

    var dl = el("dl", "result__rows");
    dl.appendChild(fila("Tu sueldo hace 12 meses", ars(hace)));
    dl.appendChild(fila("Para empatar con la inflación", ars(necesario)));
    dl.appendChild(fila(dif > 0 ? "Te faltan" : "Te sobran", ars(Math.abs(dif))));
    box.appendChild(dl);
  }

  function initCalculadoras() {
    $("pf-tna").value = String(M.tnaPlazoFijo);
    $("pf-dolar").value = serie().var30.toFixed(1);
    $("s-sueldo").value = String(perfil.ingreso);
    $("s-inflacion").value = String(M.inflacionInteranual);

    ["pf-monto", "pf-tna", "pf-dias", "pf-dolar"].forEach(function (id) {
      $(id).addEventListener("input", calcPlazoFijo);
    });
    ["s-sueldo", "s-aumento", "s-inflacion"].forEach(function (id) {
      $(id).addEventListener("input", function () { $(id).dataset.tocado = "1"; calcSueldo(); });
    });
    calcPlazoFijo();
    calcSueldo();

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

  var VISTAS = ["hoy", "perfil", "calcular", "alertas"];

  function route() {
    var h = (location.hash || "#hoy").slice(1);
    if (VISTAS.indexOf(h) === -1) h = "hoy";
    VISTAS.forEach(function (v) { $("vista-" + v).hidden = v !== h; });
    Array.prototype.forEach.call(document.querySelectorAll(".nav a"), function (a) {
      if (a.dataset.vista === h) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
  }

  /* ---------- tema ---------- */

  function temaEfectivo() {
    var t = document.documentElement.dataset.theme;
    if (t === "light" || t === "dark") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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

  /* ---------- arranque ---------- */

  function init() {
    var f = new Date(M.fecha + "T12:00:00");
    $("fecha").textContent = f.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    $("banner").hidden = !M.esMock;

    initTema();
    initPerfil();
    initAlertas();
    initCalculadoras();
    renderHoy();
    route();
    window.addEventListener("hashchange", route);

    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* sin offline, sigue andando */ });
    }
  }

  init();
})();
