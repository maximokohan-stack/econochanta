/*
 * Vistas del tablero: Tablero, Dolar, Inflacion, Economia, Mercados y Mas.
 * Cada vista se arma una sola vez y carga sus series al abrirse.
 */
(function () {
  "use strict";

  var S = window.EconoSeries, C = window.EconoCharts;

  /* ---------- utilidades ---------- */

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function num(v, d) {
    var dec = d === undefined ? 0 : d;
    return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function signo(v, d) { return (v > 0 ? "+" : "") + num(v, d); }

  // valor segun la unidad de la serie
  function fmtUnit(unit, v, dec) {
    var d = dec === undefined ? 0 : dec;
    switch (unit) {
      case "%": return num(v, d) + "%";
      case "ARS": return "$ " + num(v, d);
      case "M ARS":
        if (Math.abs(v) >= 1e6) return (v < 0 ? "-" : "") + "$ " + num(Math.abs(v) / 1e6, 2) + " billones";
        return "$ " + num(v, 0) + " M";
      case "M USD": return "USD " + num(v, 0) + " M";
      case "pb": return num(v, 0) + " pb";
      default: return num(v, d);
    }
  }
  function fmtSerie(s, v) { return fmtUnit(s.unit, v, s.dec); }

  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fechaDato(s) {
    if (!s || !s.ultimo) return "";
    var d = new Date(s.ultimo.d + "T12:00:00");
    return C.mensual(s.points) ? MESES[d.getMonth()] + " " + d.getFullYear() : d.getDate() + " " + MESES[d.getMonth()] + " " + d.getFullYear();
  }
  function esMensual(s) { return C.mensual(s.points); }

  function recortar(s, dias) {
    if (!s) return s;
    if (!dias) return s;
    var ult = new Date(s.points[s.points.length - 1][0] + "T12:00:00").getTime();
    var corte = new Date(ult - dias * 86400000).toISOString().slice(0, 10);
    var pts = s.points.filter(function (p) { return p[0] >= corte; });
    return { key: s.key, label: s.label, unit: s.unit, dec: s.dec, fuente: s.fuente, points: pts.length > 1 ? pts : s.points.slice(-2), ultimo: s.ultimo, previo: s.previo };
  }

  function conPuntos(s, pts, label, unit, dec) {
    return { key: s.key, label: label || s.label, unit: unit || s.unit, dec: dec === undefined ? s.dec : dec, fuente: s.fuente, points: pts, ultimo: pts.length ? { d: pts[pts.length - 1][0], v: pts[pts.length - 1][1] } : null, previo: pts.length > 1 ? { d: pts[pts.length - 2][0], v: pts[pts.length - 2][1] } : null };
  }

  function base100(s, label) {
    var b = s.points[0][1];
    return conPuntos(s, s.points.map(function (p) { return [p[0], p[1] / b * 100]; }), label || s.label, "índice", 1);
  }

  function varA(s, k) {
    // variacion porcentual contra el punto de hace k posiciones
    var n = s.points.length;
    if (n <= k) return null;
    return (s.points[n - 1][1] / s.points[n - 1 - k][1] - 1) * 100;
  }

  function serieVarA(s, k, label) {
    var pts = [];
    for (var i = k; i < s.points.length; i++) pts.push([s.points[i][0], (s.points[i][1] / s.points[i - k][1] - 1) * 100]);
    return conPuntos(s, pts, label, "%", 1);
  }

  function rango(dias, etiqueta) { return { dias: dias, l: etiqueta }; }

  /* ---------- tarjetas ---------- */

  function chip(texto, activo, onClick) {
    var b = el("button", "chip", texto);
    b.type = "button";
    b.setAttribute("aria-pressed", activo ? "true" : "false");
    b.addEventListener("click", onClick);
    return b;
  }

  function esqueleto(alto) {
    var d = el("div", "skeleton");
    d.style.height = (alto || 200) + "px";
    d.setAttribute("aria-hidden", "true");
    return d;
  }

  function tablaDatos(series, maxFilas) {
    var det = el("details", "datos");
    det.appendChild(el("summary", "", "Ver datos"));
    var principal = series[0].points.slice(-(maxFilas || 12)).reverse();
    var mapas = series.map(function (x) { var m = {}; x.points.forEach(function (p) { m[p[0]] = p[1]; }); return m; });
    var t = el("table", "tabla");
    var cab = el("tr");
    cab.appendChild(el("th", "", "Fecha"));
    series.forEach(function (x) { cab.appendChild(el("th", "", x.label)); });
    var th = el("thead"); th.appendChild(cab); t.appendChild(th);
    var tb = el("tbody");
    principal.forEach(function (p) {
      var tr = el("tr");
      tr.appendChild(el("td", "", C.fechaLarga(p[0], esMensual(series[0]))));
      series.forEach(function (x, i) { tr.appendChild(el("td", "num", mapas[i][p[0]] === undefined ? "-" : fmtSerie(x, mapas[i][p[0]]))); });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    var cont = el("div", "tabla__wrap"); cont.appendChild(t);
    det.appendChild(cont);
    return det;
  }

  /*
   * Tarjeta con grafico. cfg:
   *  titulo, keys, n, rangos, defRango, armar(map, dias) -> { tipo:'line'|'bars', ...opts, csv:[series] }, nota, ancho
   */
  function tarjetaGrafico(padre, cfg) {
    var card = el("article", "card chartcard" + (cfg.ancho === "full" ? " chartcard--full" : ""));
    var cab = el("div", "chartcard__head");
    cab.appendChild(el("h2", "label", cfg.titulo));
    var acciones = el("div", "chartcard__actions");
    cab.appendChild(acciones);
    card.appendChild(cab);
    var rangosBox = el("div", "chips chips--sm");
    var cuerpo = el("div", "chart");
    var pie = el("p", "hint");
    var extra = el("div");
    if (cfg.rangos) card.appendChild(rangosBox);
    card.appendChild(cuerpo);
    card.appendChild(pie);
    card.appendChild(extra);
    padre.appendChild(card);

    var rangoActual = cfg.defRango === undefined ? (cfg.rangos ? cfg.rangos[0].dias : 0) : cfg.defRango;
    var mapa = null;
    var ultimaVista = null;

    function pintarRangos() {
      rangosBox.textContent = "";
      (cfg.rangos || []).forEach(function (r) {
        rangosBox.appendChild(chip(r.l, r.dias === rangoActual, function () { rangoActual = r.dias; pintarRangos(); dibujar(); }));
      });
      if (cfg.extraControl) cfg.extraControl(rangosBox, function () { dibujar(); });
    }

    function dibujar() {
      var v = cfg.armar(mapa, rangoActual);
      ultimaVista = v;
      if (!v) { cuerpo.textContent = ""; cuerpo.appendChild(el("p", "chart__empty", "No hay datos disponibles.")); return; }
      if (v.tipo === "bars") C.bars(cuerpo, { points: v.points, fmt: v.fmt, tickFmt: v.tickFmt, color: v.color, titulo: cfg.titulo });
      else C.line(cuerpo, { series: v.series, fmt: v.fmt, tickFmt: v.tickFmt, zero: v.zero, area: v.area, titulo: cfg.titulo });
      var series = v.csv || v.series || [conPuntos({ key: "x", unit: "", dec: 1, fuente: "" }, v.points, cfg.titulo)];
      acciones.textContent = "";
      var b = el("button", "btn btn--ghost btn--xs", "CSV");
      b.type = "button";
      b.setAttribute("aria-label", "Descargar datos de " + cfg.titulo + " en CSV");
      b.addEventListener("click", function () { C.csv(cfg.csvNombre || cfg.keys[0], series); });
      acciones.appendChild(b);
      extra.textContent = "";
      extra.appendChild(tablaDatos(series, 12));
      var primero = mapa[cfg.keys[0]];
      pie.textContent = (cfg.nota ? cfg.nota + " " : "") + "Fuente: " + (primero ? primero.fuente : "") + (primero ? ". Último dato: " + fechaDato(primero) + "." : "");
    }

    function cargar() {
      cuerpo.textContent = "";
      cuerpo.appendChild(esqueleto(cfg.alto || 240));
      S.cargarVarias(cfg.keys, cfg.n || 120).then(function (r) {
        mapa = r.series;
        var algo = cfg.keys.some(function (k) { return mapa[k]; });
        if (!algo) {
          cuerpo.textContent = "";
          var err = el("div", "chart__error");
          err.appendChild(el("p", "", "No se pudo cargar este gráfico."));
          var b = el("button", "btn btn--ghost btn--sm", "Reintentar");
          b.type = "button"; b.addEventListener("click", cargar);
          err.appendChild(b);
          cuerpo.appendChild(err);
          return;
        }
        pintarRangos();
        dibujar();
      });
    }
    cargar();
    return card;
  }

  /* ---------- tarjetas de dato (KPI) ---------- */

  function kpi(padre, cfg) {
    var a = el(cfg.href ? "a" : "div", "kpi");
    if (cfg.href) a.href = cfg.href;
    a.appendChild(el("span", "kpi__label", cfg.label));
    var val = el("span", "kpi__val", "…");
    var delta = el("span", "kpi__delta", "");
    var sp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sp.setAttribute("class", "kpi__spark"); sp.setAttribute("aria-hidden", "true");
    a.appendChild(val); a.appendChild(delta); a.appendChild(sp);
    padre.appendChild(a);
    return {
      pintar: function (valor, deltaTxt, pts) {
        val.textContent = valor; delta.textContent = deltaTxt || "";
        if (pts) C.spark(sp, pts);
        if (valor === "-") a.classList.add("kpi--vacio");
      }
    };
  }

  function deltaPct(s, suf) {
    if (!s || !s.previo) return "";
    return signo((s.ultimo.v / s.previo.v - 1) * 100, 2) + "% " + suf;
  }
  function deltaDif(s, unidad, suf, dec) {
    if (!s || !s.previo) return "";
    return signo(s.ultimo.v - s.previo.v, dec === undefined ? 1 : dec) + " " + unidad + " " + suf;
  }

  /* ---------- Tablero ---------- */

  var tableroListo = false;

  function armarTablero() {
    var v = $("vista-tablero");
    var kp = $("kpis");
    var tiles = {};
    var defs = [
      ["dOficial", "Dólar oficial", "#dolar"], ["dMep", "Dólar MEP", "#dolar"], ["dCcl", "Dólar CCL", "#dolar"], ["dBlue", "Dólar blue", "#dolar"],
      ["brecha", "Brecha CCL", "#dolar"], ["riesgo", "Riesgo país", "#mercados"], ["reservas", "Reservas", "#economia:dinero"], ["badlar", "Tasa BADLAR", "#economia:dinero"],
      ["infM", "Inflación mensual", "#inflacion"], ["infIA", "Inflación interanual", "#inflacion"], ["salReal", "Salarios vs inflación, 12 m", "#economia:empleo"], ["emaeIA", "Actividad (EMAE), interanual", "#economia:actividad"],
      ["desocupacion", "Desocupación", "#economia:empleo"], ["resPrimario", "Resultado primario", "#economia:fiscal"], ["saldo", "Saldo comercial", "#economia:comercio"], ["baseMon", "Base monetaria", "#economia:dinero"]
    ];
    defs.forEach(function (d) { tiles[d[0]] = kpi(kp, { label: d[1], href: d[2] }); });

    var keys = ["dOficial", "dMep", "dCcl", "dBlue", "riesgo", "reservas", "badlar", "infM", "infIA", "salarios", "emae", "desocupacion", "resPrimario", "expo", "impo", "baseMon"];
    S.cargarVarias(keys, 60).then(function (r) {
      var s = r.series;
      function pt(k) { return s[k] ? s[k].points.slice(-30) : null; }
      ["dOficial", "dMep", "dCcl", "dBlue"].forEach(function (k) {
        if (s[k]) tiles[k].pintar(fmtSerie(s[k], s[k].ultimo.v), deltaPct(s[k], "vs ayer"), pt(k)); else tiles[k].pintar("-", "sin dato");
      });
      if (s.dCcl && s.dOficial) {
        var b = (s.dCcl.ultimo.v / s.dOficial.ultimo.v - 1) * 100;
        var bp = (s.dCcl.previo.v / s.dOficial.previo.v - 1) * 100;
        var ptsB = s.dCcl.points.slice(-30).map(function (p, i) { var o = s.dOficial.points[s.dOficial.points.length - 30 + i]; return o ? [p[0], (p[1] / o[1] - 1) * 100] : null; }).filter(Boolean);
        tiles.brecha.pintar(num(b, 1) + "%", signo(b - bp, 1) + " pp vs ayer", ptsB);
      } else tiles.brecha.pintar("-", "sin dato");
      if (s.riesgo) tiles.riesgo.pintar(fmtSerie(s.riesgo, s.riesgo.ultimo.v), deltaDif(s.riesgo, "pb", "vs día previo", 0), pt("riesgo")); else tiles.riesgo.pintar("-", "sin dato");
      if (s.reservas) tiles.reservas.pintar(fmtSerie(s.reservas, s.reservas.ultimo.v), deltaPct(s.reservas, "vs día previo"), pt("reservas")); else tiles.reservas.pintar("-", "sin dato");
      if (s.badlar) tiles.badlar.pintar(num(s.badlar.ultimo.v, 1) + "%", deltaDif(s.badlar, "pp", "vs día previo"), pt("badlar")); else tiles.badlar.pintar("-", "sin dato");
      if (s.infM) tiles.infM.pintar(num(s.infM.ultimo.v, 1) + "%", deltaDif(s.infM, "pp", "vs mes anterior") + " · " + fechaDato(s.infM), s.infM.points.slice(-24)); else tiles.infM.pintar("-", "sin dato");
      if (s.infIA) tiles.infIA.pintar(num(s.infIA.ultimo.v, 1) + "%", deltaDif(s.infIA, "pp", "vs mes anterior") + " · " + fechaDato(s.infIA), s.infIA.points.slice(-24)); else tiles.infIA.pintar("-", "sin dato");
      if (s.salarios && s.infIA) {
        var sa = S.variacion(s.salarios, 12);
        var real = sa === null ? null : ((1 + sa / 100) / (1 + s.infIA.ultimo.v / 100) - 1) * 100;
        tiles.salReal.pintar(real === null ? "-" : signo(real, 1) + "%", "Salarios " + (sa === null ? "-" : signo(sa, 1) + "%") + " contra precios " + num(s.infIA.ultimo.v, 1) + "%", null);
      } else tiles.salReal.pintar("-", "sin dato");
      if (s.emae) {
        var e = varA(s.emae, 12);
        tiles.emaeIA.pintar(e === null ? "-" : signo(e, 1) + "%", "EMAE desest. · " + fechaDato(s.emae), s.emae.points.slice(-24));
      } else tiles.emaeIA.pintar("-", "sin dato");
      if (s.desocupacion) tiles.desocupacion.pintar(num(s.desocupacion.ultimo.v, 1) + "%", deltaDif(s.desocupacion, "pp", "vs trim. anterior") + " · " + fechaDato(s.desocupacion), s.desocupacion.points.slice(-12)); else tiles.desocupacion.pintar("-", "sin dato");
      if (s.resPrimario) tiles.resPrimario.pintar(fmtSerie(s.resPrimario, s.resPrimario.ultimo.v), (s.resPrimario.ultimo.v >= 0 ? "Superávit" : "Déficit") + " · " + fechaDato(s.resPrimario), s.resPrimario.points.slice(-12)); else tiles.resPrimario.pintar("-", "sin dato");
      if (s.expo && s.impo) {
        var sd = S.restar(s.expo, s.impo, "Saldo comercial");
        tiles.saldo.pintar(fmtSerie(sd, sd.ultimo.v), (sd.ultimo.v >= 0 ? "Superávit" : "Déficit") + " · " + fechaDato(sd), sd.points.slice(-12));
      } else tiles.saldo.pintar("-", "sin dato");
      if (s.baseMon) tiles.baseMon.pintar(fmtSerie(s.baseMon, s.baseMon.ultimo.v), deltaPct(s.baseMon, "vs día previo"), pt("baseMon")); else tiles.baseMon.pintar("-", "sin dato");
    });

    // graficos
    var g = $("tablero-graficos");
    tarjetaGrafico(g, {
      titulo: "Dólar: oficial, MEP, CCL y blue", keys: ["dOficial", "dMep", "dCcl", "dBlue"], n: 400,
      rangos: [rango(30, "1 mes"), rango(90, "3 meses"), rango(365, "1 año")], defRango: 90,
      armar: function (m, dias) {
        var ser = ["dOficial", "dMep", "dCcl", "dBlue"].map(function (k) { return m[k] ? recortar(m[k], dias) : null; }).filter(Boolean);
        if (!ser.length) return null;
        return { tipo: "line", series: ser, fmt: function (v) { return "$ " + num(v, 0); } };
      }
    });
    tarjetaGrafico(g, {
      titulo: "Inflación mensual, últimos 24 meses", keys: ["infM"], n: 60,
      armar: function (m) {
        if (!m.infM) return null;
        return { tipo: "bars", points: m.infM.points.slice(-24), fmt: function (v) { return num(v, 1) + "%"; } };
      }
    });
    armarMovimientos($("tablero-movers"));
    armarTitulares($("tablero-titulares"));
  }

  function armarMovimientos(box) {
    box.textContent = "";
    box.appendChild(esqueleto(180));
    S.live("arg_stocks").then(function (rows) {
      var ok = rows.filter(function (r) { return r.c > 0 && r.v > 0 && typeof r.pct_change === "number"; });
      var arriba = ok.slice().sort(function (a, b) { return b.pct_change - a.pct_change; }).slice(0, 5);
      var abajo = ok.slice().sort(function (a, b) { return a.pct_change - b.pct_change; }).slice(0, 5);
      box.textContent = "";
      var wrap = el("div", "movers");
      [["Más suben", arriba], ["Más bajan", abajo]].forEach(function (par) {
        var col = el("div");
        col.appendChild(el("h3", "movers__title", par[0]));
        var ul = el("ul", "movers__list");
        par[1].forEach(function (r) {
          var li = el("li");
          li.appendChild(el("span", "movers__sym", r.symbol));
          li.appendChild(el("span", "movers__px", "$ " + num(r.c, r.c < 100 ? 2 : 0)));
          li.appendChild(el("span", "movers__chg", signo(r.pct_change, 2) + "%"));
          ul.appendChild(li);
        });
        col.appendChild(ul);
        wrap.appendChild(col);
      });
      box.appendChild(wrap);
      box.appendChild(el("p", "hint", "Acciones argentinas, con demora. Fuente: data912."));
    }, function () {
      box.textContent = "";
      box.appendChild(el("p", "chart__empty", "No se pudieron cargar las acciones."));
    });
  }

  function armarTitulares(box) {
    box.textContent = "";
    var n = window.EconoApp && window.EconoApp.noticias();
    if (!n || !n.items || !n.items.length) {
      box.appendChild(el("p", "chart__empty", "Todavía no hay titulares. Corré scripts/fetch_news.py o tocá Actualizar."));
      return;
    }
    var ul = el("ul", "news-list");
    n.items.slice(0, 5).forEach(function (it) {
      var li = el("li");
      var ok = /^https?:\/\//i.test(it.url || "");
      var a = el(ok ? "a" : "span", "news");
      if (ok) { a.href = it.url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
      var meta = el("span", "news__meta");
      meta.appendChild(el("span", "news__medio", String(it.medio || "")));
      meta.appendChild(el("span", "news__time", window.EconoApp.hace(it.fecha)));
      a.appendChild(meta);
      a.appendChild(el("span", "news__title", String(it.titulo || "")));
      li.appendChild(a); ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function tarjetaPlata() {
    var box = $("tablero-plata");
    if (!box || !window.EconoApp) return;
    var r = window.EconoApp.resumenPlata();
    box.textContent = "";
    if (!r) return;
    box.appendChild(el("span", "kpi__label", "Tu plata, 30 días"));
    box.appendChild(el("span", "kpi__val", (r.mes > 0 ? "+" : "") + num(r.mes, 2) + "%"));
    box.appendChild(el("span", "kpi__delta", "Termómetro " + r.score + ", " + r.mood));
  }

  /* ---------- Dolar ---------- */

  var ipcIndice = null;

  function armarIndiceIPC(infM) {
    var acum = {}, idx = 1, ultimoMes = "";
    infM.points.forEach(function (p) {
      var mes = p[0].slice(0, 7);
      idx *= 1 + p[1] / 100;
      acum[mes] = idx;
      ultimoMes = mes;
    });
    return { acum: acum, ultimo: acum[ultimoMes], ultimoMes: ultimoMes };
  }

  function ajustar(serie, ipc) {
    var pts = serie.points.map(function (p) {
      var mes = p[0].slice(0, 7);
      var f = mes > ipc.ultimoMes ? 1 : (ipc.acum[mes] ? ipc.ultimo / ipc.acum[mes] : 1);
      return [p[0], p[1] * f];
    });
    return conPuntos(serie, pts, serie.label, serie.unit, serie.dec);
  }

  function armarDolar() {
    var v = $("dolar-contenido");
    var cot = el("ul", "quotes quotes--4");
    v.appendChild(cot);
    S.cargarVarias(["dOficial", "dMep", "dCcl", "dBlue"], 60).then(function (r) {
      var o = r.series.dOficial;
      [["dOficial", "Oficial"], ["dMep", "MEP"], ["dCcl", "CCL"], ["dBlue", "Blue"]].forEach(function (x) {
        var s = r.series[x[0]];
        var li = el("li");
        li.appendChild(el("span", "quotes__name", x[1]));
        if (!s) { li.appendChild(el("span", "quotes__val", "-")); cot.appendChild(li); return; }
        li.appendChild(el("span", "quotes__val", "$ " + num(s.ultimo.v, 0)));
        li.appendChild(el("span", "quotes__gap", deltaPct(s, "vs ayer")));
        if (x[0] !== "dOficial" && o) li.appendChild(el("span", "quotes__gap", "Brecha " + num((s.ultimo.v / o.ultimo.v - 1) * 100, 1) + "%"));
        cot.appendChild(li);
      });
    });

    var real = false;
    tarjetaGrafico(v, {
      titulo: "Evolución del dólar", keys: ["dOficial", "dMep", "dCcl", "dBlue", "infM"], n: 1300, ancho: "full", alto: 300,
      rangos: [rango(30, "1 mes"), rango(90, "3 meses"), rango(365, "1 año"), rango(1825, "5 años")], defRango: 365,
      csvNombre: "dolar",
      extraControl: function (box, redibujar) {
        var b = chip("Ajustado por inflación", real, function () { real = !real; b.setAttribute("aria-pressed", real ? "true" : "false"); redibujar(); });
        box.appendChild(b);
      },
      nota: "Con el ajuste, los precios pasados se expresan en pesos de hoy usando el IPC.",
      armar: function (m, dias) {
        var ipc = m.infM ? armarIndiceIPC(m.infM) : null;
        var ser = ["dOficial", "dMep", "dCcl", "dBlue"].map(function (k) {
          if (!m[k]) return null;
          var s = real && ipc ? ajustar(m[k], ipc) : m[k];
          return recortar(s, dias);
        }).filter(Boolean);
        if (!ser.length) return null;
        return { tipo: "line", series: ser, fmt: function (x) { return "$ " + num(x, 0); } };
      }
    });
    tarjetaGrafico(v, {
      titulo: "Brecha contra el oficial", keys: ["dOficial", "dMep", "dCcl", "dBlue"], n: 1300, ancho: "full",
      rangos: [rango(90, "3 meses"), rango(365, "1 año"), rango(1825, "5 años")], defRango: 365, zero: true,
      csvNombre: "brecha-dolar",
      nota: "Cuánto más caro está cada dólar contra el oficial, en porcentaje.",
      armar: function (m, dias) {
        if (!m.dOficial) return null;
        var of = {}; m.dOficial.points.forEach(function (p) { of[p[0]] = p[1]; });
        var ser = [["dMep", "MEP"], ["dCcl", "CCL"], ["dBlue", "Blue"]].map(function (x) {
          var s = m[x[0]]; if (!s) return null;
          var pts = s.points.filter(function (p) { return of[p[0]]; }).map(function (p) { return [p[0], (p[1] / of[p[0]] - 1) * 100]; });
          return recortar(conPuntos(s, pts, "Brecha " + x[1], "%", 1), dias);
        }).filter(Boolean);
        if (!ser.length) return null;
        return { tipo: "line", series: ser, zero: true, fmt: function (x) { return num(x, 1) + "%"; } };
      }
    });
  }

  /* ---------- Inflacion ---------- */

  var RUBROS = [
    ["ipcGeneral", "Nivel general"], ["ipcNucleo", "Núcleo"], ["ipcRegulados", "Regulados"], ["ipcEstacionales", "Estacionales"],
    ["ipcTransporte", "Transporte"], ["ipcSalud", "Salud"], ["ipcEducacion", "Educación"], ["ipcPrendas", "Prendas y calzado"],
    ["ipcEquipamiento", "Equipamiento del hogar"], ["ipcComunicaciones", "Comunicaciones"], ["ipcBebidas", "Bebidas alcohólicas y tabaco"]
  ];

  function armarInflacion() {
    var v = $("inflacion-contenido");
    var kp = el("div", "kpis kpis--3");
    v.appendChild(kp);
    var kM = kpi(kp, { label: "Inflación mensual" }), kA = kpi(kp, { label: "Inflación interanual" }), kN = kpi(kp, { label: "Núcleo, último mes" });

    S.cargarVarias(["infM", "infIA", "ipcNucleo"], 60).then(function (r) {
      var s = r.series;
      if (s.infM) kM.pintar(num(s.infM.ultimo.v, 1) + "%", deltaDif(s.infM, "pp", "vs mes anterior") + " · " + fechaDato(s.infM), s.infM.points.slice(-24)); else kM.pintar("-", "sin dato");
      if (s.infIA) kA.pintar(num(s.infIA.ultimo.v, 1) + "%", deltaDif(s.infIA, "pp", "vs mes anterior") + " · " + fechaDato(s.infIA), s.infIA.points.slice(-24)); else kA.pintar("-", "sin dato");
      if (s.ipcNucleo) { var m = varA(s.ipcNucleo, 1); kN.pintar(m === null ? "-" : num(m, 1) + "%", "Núcleo · " + fechaDato(s.ipcNucleo), null); } else kN.pintar("-", "sin dato");
    });

    var g = el("div", "grid2");
    v.appendChild(g);
    tarjetaGrafico(g, {
      titulo: "Inflación mensual", keys: ["infM"], n: 120,
      rangos: [rango(730, "2 años"), rango(1825, "5 años")], defRango: 730,
      armar: function (m, dias) {
        if (!m.infM) return null;
        var rc = recortar(m.infM, dias);
        return { tipo: "bars", points: rc.points, fmt: function (x) { return num(x, 1) + "%"; } };
      }
    });
    tarjetaGrafico(g, {
      titulo: "Inflación interanual", keys: ["infIA"], n: 120, area: true,
      rangos: [rango(730, "2 años"), rango(1825, "5 años")], defRango: 730,
      armar: function (m, dias) {
        if (!m.infIA) return null;
        return { tipo: "line", series: [recortar(m.infIA, dias)], area: true, fmt: function (x) { return num(x, 1) + "%"; } };
      }
    });

    // tabla por rubro
    var card = el("article", "card");
    card.appendChild(el("h2", "label", "Por rubro (INDEC)"));
    var cuerpo = el("div");
    cuerpo.appendChild(esqueleto(260));
    card.appendChild(cuerpo);
    v.appendChild(card);
    S.cargarVarias(RUBROS.map(function (x) { return x[0]; }), 60).then(function (r) {
      var t = el("table", "tabla tabla--rubros");
      var th = el("thead"), trh = el("tr");
      ["Rubro", "Mes", "Mensual", "Interanual"].forEach(function (x, i) { var c = el("th", i > 1 ? "num" : "", x); trh.appendChild(c); });
      th.appendChild(trh); t.appendChild(th);
      var tb = el("tbody");
      RUBROS.forEach(function (x) {
        var s = r.series[x[0]];
        var tr = el("tr");
        tr.appendChild(el("td", "", x[1]));
        if (!s) { tr.appendChild(el("td", "", "-")); tr.appendChild(el("td", "num", "-")); tr.appendChild(el("td", "num", "-")); tb.appendChild(tr); return; }
        var d = new Date(s.ultimo.d + "T12:00:00");
        var mom = varA(s, 1), yoy = varA(s, 12);
        tr.appendChild(el("td", "", MESES[d.getMonth()] + " " + String(d.getFullYear()).slice(2)));
        tr.appendChild(el("td", "num", mom === null ? "-" : signo(mom, 1) + "%"));
        tr.appendChild(el("td", "num", yoy === null ? "-" : signo(yoy, 1) + "%"));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      cuerpo.textContent = "";
      var w = el("div", "tabla__wrap"); w.appendChild(t); cuerpo.appendChild(w);
      cuerpo.appendChild(el("p", "hint", "Cada rubro muestra su último mes publicado, que puede ser anterior al nivel general. Fuente: INDEC, vía datos.gob.ar."));
    });

    tarjetaGrafico(v, {
      titulo: "Tasas contra inflación (TNA)", keys: ["badlar", "tamar", "tasaDep", "infIA"], n: 400, ancho: "full",
      rangos: [rango(180, "6 meses"), rango(365, "1 año"), rango(730, "2 años")], defRango: 365,
      nota: "Si la tasa está por debajo de la inflación interanual, el ahorro en pesos pierde poder de compra.",
      armar: function (m, dias) {
        var ser = [];
        if (m.badlar) ser.push(recortar(m.badlar, dias));
        if (m.tamar) ser.push(recortar(m.tamar, dias));
        if (m.tasaDep) ser.push(recortar(m.tasaDep, dias));
        if (m.infIA) ser.push(recortar(conPuntos(m.infIA, m.infIA.points, "Inflación interanual"), dias));
        if (!ser.length) return null;
        return { tipo: "line", series: ser, fmt: function (x) { return num(x, 1) + "%"; } };
      }
    });

    var kp2 = el("div", "kpis kpis--3");
    v.appendChild(kp2);
    var kU = kpi(kp2, { label: "UVA" }), kC = kpi(kp2, { label: "CER" }), kTP = kpi(kp2, { label: "Préstamos personales (TNA)" });
    S.cargarVarias(["uva", "cer", "tasaPers"], 400).then(function (r) {
      var s = r.series;
      if (s.uva) kU.pintar("$ " + num(s.uva.ultimo.v, 2), "12 meses: " + signo(S.variacion(s.uva, 12) || 0, 1) + "%", s.uva.points.slice(-120).filter(function (p, i) { return i % 4 === 0; })); else kU.pintar("-", "sin dato");
      if (s.cer) kC.pintar(num(s.cer.ultimo.v, 2), "12 meses: " + signo(S.variacion(s.cer, 12) || 0, 1) + "%", s.cer.points.slice(-120).filter(function (p, i) { return i % 4 === 0; })); else kC.pintar("-", "sin dato");
      if (s.tasaPers) kTP.pintar(num(s.tasaPers.ultimo.v, 1) + "%", deltaDif(s.tasaPers, "pp", "vs día previo"), s.tasaPers.points.slice(-60)); else kTP.pintar("-", "sin dato");
    });
  }

  /* ---------- Economia ---------- */

  var SUBS = [["actividad", "Actividad"], ["empleo", "Empleo y salarios"], ["fiscal", "Cuentas fiscales"], ["comercio", "Comercio exterior"], ["dinero", "Dinero y tasas"]];
  var subActual = "actividad";

  function filaKPI(padre, items) {
    var kp = el("div", "kpis kpis--3");
    padre.appendChild(kp);
    return items.map(function (l) { return kpi(kp, { label: l }); });
  }

  function barrasSigno(pts, fmt) {
    return { tipo: "bars", points: pts, fmt: fmt, color: function (v) { return v >= 0 ? "var(--ok)" : "var(--bad)"; } };
  }

  function billones(v) { return num(v / 1e6, 2) + " bill."; }

  var PANELES = {
    actividad: function (p) {
      var k = filaKPI(p, ["EMAE, interanual", "EMAE, mensual", "Industria (IPI), interanual", "Construcción (cemento), interanual", "PBI, interanual"]);
      S.cargarVarias(["emae", "emaeVM", "ipi", "cemento", "pbi"], 60).then(function (r) {
        var s = r.series;
        var e = s.emae && varA(s.emae, 12); k[0].pintar(e === null || !s.emae ? "-" : signo(e, 1) + "%", s.emae ? "Desestacionalizado · " + fechaDato(s.emae) : "sin dato", s.emae && s.emae.points.slice(-24));
        k[1].pintar(s.emaeVM ? signo(s.emaeVM.ultimo.v, 2) + "%" : "-", s.emaeVM ? "vs mes anterior · " + fechaDato(s.emaeVM) : "sin dato", s.emaeVM && s.emaeVM.points.slice(-24));
        var i = s.ipi && varA(s.ipi, 12); k[2].pintar(i === null || !s.ipi ? "-" : signo(i, 1) + "%", s.ipi ? fechaDato(s.ipi) : "sin dato", s.ipi && s.ipi.points.slice(-24));
        var c = s.cemento && varA(s.cemento, 12); k[3].pintar(c === null || !s.cemento ? "-" : signo(c, 1) + "%", s.cemento ? fechaDato(s.cemento) : "sin dato", s.cemento && s.cemento.points.slice(-24));
        var b = s.pbi && varA(s.pbi, 4); k[4].pintar(b === null || !s.pbi ? "-" : signo(b, 1) + "%", s.pbi ? "Trimestral · " + fechaDato(s.pbi) : "sin dato", s.pbi && s.pbi.points.slice(-12));
      });
      var g = el("div", "grid2"); p.appendChild(g);
      tarjetaGrafico(g, { titulo: "EMAE desestacionalizado", keys: ["emae"], n: 120, area: true, rangos: [rango(1095, "3 años"), rango(1825, "5 años")], defRango: 1095,
        armar: function (m, d) { return m.emae ? { tipo: "line", series: [recortar(m.emae, d)], area: true, fmt: function (x) { return num(x, 1); } } : null; } });
      tarjetaGrafico(g, { titulo: "EMAE, variación interanual", keys: ["emae"], n: 120,
        armar: function (m) { return m.emae ? barrasSigno(serieVarA(m.emae, 12).points.slice(-36), function (x) { return num(x, 1) + "%"; }) : null; } });
      tarjetaGrafico(g, { titulo: "Industria y construcción (base 100 hace 3 años)", keys: ["ipi", "cemento"], n: 120, zero: false,
        armar: function (m) {
          var a = ["ipi", "cemento"].map(function (k) { return m[k] ? base100(recortar(m[k], 1095), k === "ipi" ? "Industria (IPI)" : "Cemento") : null; }).filter(Boolean);
          return a.length ? { tipo: "line", series: a, fmt: function (x) { return num(x, 1); } } : null;
        } });
      tarjetaGrafico(g, { titulo: "PBI, variación interanual por trimestre", keys: ["pbi"], n: 60,
        armar: function (m) { return m.pbi ? barrasSigno(serieVarA(m.pbi, 4).points, function (x) { return num(x, 1) + "%"; }) : null; } });
    },

    empleo: function (p) {
      var k = filaKPI(p, ["Desocupación", "Salarios vs inflación, 12 m", "Salario mínimo", "Haber mínimo jubilatorio", "RIPTE"]);
      S.cargarVarias(["desocupacion", "salarios", "infIA", "smvm", "haberMin", "ripte"], 60).then(function (r) {
        var s = r.series;
        k[0].pintar(s.desocupacion ? num(s.desocupacion.ultimo.v, 1) + "%" : "-", s.desocupacion ? deltaDif(s.desocupacion, "pp", "vs trim. anterior") + " · " + fechaDato(s.desocupacion) : "sin dato", s.desocupacion && s.desocupacion.points.slice(-12));
        if (s.salarios && s.infIA) { var sa = S.variacion(s.salarios, 12); var re = ((1 + sa / 100) / (1 + s.infIA.ultimo.v / 100) - 1) * 100; k[1].pintar(signo(re, 1) + "%", "Salarios " + signo(sa, 1) + "% contra precios " + num(s.infIA.ultimo.v, 1) + "%", null); } else k[1].pintar("-", "sin dato");
        k[2].pintar(s.smvm ? fmtSerie(s.smvm, s.smvm.ultimo.v) : "-", s.smvm ? "12 meses: " + signo(S.variacion(s.smvm, 12) || 0, 1) + "%" : "sin dato", s.smvm && s.smvm.points.slice(-24));
        k[3].pintar(s.haberMin ? fmtSerie(s.haberMin, s.haberMin.ultimo.v) : "-", s.haberMin ? "12 meses: " + signo(S.variacion(s.haberMin, 12) || 0, 1) + "%" : "sin dato", s.haberMin && s.haberMin.points.slice(-24));
        k[4].pintar(s.ripte ? fmtSerie(s.ripte, s.ripte.ultimo.v) : "-", s.ripte ? "12 meses: " + signo(S.variacion(s.ripte, 12) || 0, 1) + "% · " + fechaDato(s.ripte) : "sin dato", s.ripte && s.ripte.points.slice(-24));
      });
      var g = el("div", "grid2"); p.appendChild(g);
      tarjetaGrafico(g, { titulo: "Desocupación", keys: ["desocupacion"], n: 60, area: true,
        armar: function (m) { return m.desocupacion ? { tipo: "line", series: [m.desocupacion], area: true, fmt: function (x) { return num(x, 1) + "%"; } } : null; } });
      tarjetaGrafico(g, { titulo: "Salarios y precios (base 100 hace 3 años)", keys: ["salPrivado", "salNoReg", "salPublico", "ipcGeneral"], n: 120,
        armar: function (m) {
          var a = [["salPrivado", "Privado registrado"], ["salNoReg", "Privado no registrado"], ["salPublico", "Sector público"], ["ipcGeneral", "Precios (IPC)"]].map(function (x) { return m[x[0]] ? base100(recortar(m[x[0]], 1095), x[1]) : null; }).filter(Boolean);
          return a.length ? { tipo: "line", series: a, fmt: function (x) { return num(x, 0); } } : null;
        } });
      tarjetaGrafico(g, { titulo: "Salario mínimo y haber mínimo jubilatorio", keys: ["smvm", "haberMin"], n: 120,
        armar: function (m) {
          var a = ["smvm", "haberMin"].map(function (k) { return m[k] ? recortar(m[k], 1095) : null; }).filter(Boolean);
          return a.length ? { tipo: "line", series: a, fmt: function (x) { return "$ " + num(x, 0); } } : null;
        } });
    },

    fiscal: function (p) {
      var k = filaKPI(p, ["Resultado primario, último mes", "Recaudación, último mes", "Recaudación, interanual real"]);
      S.cargarVarias(["resPrimario", "recaudacion", "recaudacionIA", "infIA"], 60).then(function (r) {
        var s = r.series;
        k[0].pintar(s.resPrimario ? fmtSerie(s.resPrimario, s.resPrimario.ultimo.v) : "-", s.resPrimario ? (s.resPrimario.ultimo.v >= 0 ? "Superávit" : "Déficit") + " · " + fechaDato(s.resPrimario) : "sin dato", s.resPrimario && s.resPrimario.points.slice(-24));
        k[1].pintar(s.recaudacion ? fmtSerie(s.recaudacion, s.recaudacion.ultimo.v) : "-", s.recaudacion ? fechaDato(s.recaudacion) : "sin dato", s.recaudacion && s.recaudacion.points.slice(-24));
        if (s.recaudacionIA && s.infIA) { var re = ((1 + s.recaudacionIA.ultimo.v / 100) / (1 + s.infIA.ultimo.v / 100) - 1) * 100; k[2].pintar(signo(re, 1) + "%", "Nominal " + signo(s.recaudacionIA.ultimo.v, 1) + "% contra inflación " + num(s.infIA.ultimo.v, 1) + "%", null); } else k[2].pintar("-", "sin dato");
      });
      var g = el("div", "grid2"); p.appendChild(g);
      tarjetaGrafico(g, { titulo: "Resultado primario mensual", keys: ["resPrimario"], n: 60,
        nota: "Verde: superávit. Rojo: déficit. En billones de pesos.",
        armar: function (m) { return m.resPrimario ? barrasSigno(m.resPrimario.points.slice(-36), billones) : null; } });
      tarjetaGrafico(g, { titulo: "Recaudación tributaria total", keys: ["recaudacion"], n: 120, area: true,
        armar: function (m) { return m.recaudacion ? { tipo: "line", series: [conPuntos(m.recaudacion, m.recaudacion.points.slice(-48), "Recaudación (billones)", "billones", 2)].map(function (x) { x.points = x.points.map(function (q) { return [q[0], q[1] / 1e6]; }); return x; }), area: true, fmt: function (x) { return num(x, 1) + " bill."; } } : null; } });
    },

    comercio: function (p) {
      var k = filaKPI(p, ["Exportaciones", "Importaciones", "Saldo comercial"]);
      S.cargarVarias(["expo", "impo"], 60).then(function (r) {
        var s = r.series;
        k[0].pintar(s.expo ? fmtSerie(s.expo, s.expo.ultimo.v) : "-", s.expo ? "12 meses: " + signo(S.variacion(s.expo, 12) || 0, 1) + "% · " + fechaDato(s.expo) : "sin dato", s.expo && s.expo.points.slice(-24));
        k[1].pintar(s.impo ? fmtSerie(s.impo, s.impo.ultimo.v) : "-", s.impo ? "12 meses: " + signo(S.variacion(s.impo, 12) || 0, 1) + "% · " + fechaDato(s.impo) : "sin dato", s.impo && s.impo.points.slice(-24));
        if (s.expo && s.impo) { var sd = S.restar(s.expo, s.impo, "Saldo"); k[2].pintar(fmtSerie(sd, sd.ultimo.v), (sd.ultimo.v >= 0 ? "Superávit" : "Déficit") + " · " + fechaDato(sd), sd.points.slice(-24)); } else k[2].pintar("-", "sin dato");
      });
      var g = el("div", "grid2"); p.appendChild(g);
      tarjetaGrafico(g, { titulo: "Exportaciones e importaciones", keys: ["expo", "impo"], n: 120,
        armar: function (m) { var a = ["expo", "impo"].map(function (k) { return m[k] ? recortar(m[k], 1095) : null; }).filter(Boolean); return a.length ? { tipo: "line", series: a, fmt: function (x) { return "USD " + num(x, 0) + " M"; } } : null; } });
      tarjetaGrafico(g, { titulo: "Saldo comercial mensual", keys: ["expo", "impo"], n: 120, nota: "Verde: superávit. Rojo: déficit.",
        armar: function (m) { return m.expo && m.impo ? barrasSigno(S.restar(m.expo, m.impo, "Saldo").points.slice(-36), function (x) { return num(x, 0) + " M"; }) : null; } });
    },

    dinero: function (p) {
      var k = filaKPI(p, ["Reservas", "Base monetaria", "M2 privado, interanual", "Depósitos en efectivo", "Préstamos al sector privado"]);
      S.cargarVarias(["reservas", "baseMon", "m2IA", "depositos", "prestamos"], 400).then(function (r) {
        var s = r.series;
        function t(i, key, suf) { var x = s[key]; k[i].pintar(x ? fmtSerie(x, x.ultimo.v) : "-", x ? (suf || "12 meses: " + signo(S.variacion(x, 12) || 0, 1) + "%") + " · " + fechaDato(x) : "sin dato", x && x.points.slice(-60).filter(function (q, j) { return j % 2 === 0; })); }
        t(0, "reservas"); t(1, "baseMon"); t(3, "depositos"); t(4, "prestamos");
        k[2].pintar(s.m2IA ? num(s.m2IA.ultimo.v, 1) + "%" : "-", s.m2IA ? "Promedio móvil 30 días · " + fechaDato(s.m2IA) : "sin dato", s.m2IA && s.m2IA.points.slice(-60));
      });
      var g = el("div", "grid2"); p.appendChild(g);
      tarjetaGrafico(g, { titulo: "Reservas internacionales", keys: ["reservas"], n: 800, area: true, rangos: [rango(180, "6 meses"), rango(365, "1 año"), rango(730, "2 años")], defRango: 365,
        armar: function (m, d) { return m.reservas ? { tipo: "line", series: [recortar(m.reservas, d)], area: true, fmt: function (x) { return "USD " + num(x, 0) + " M"; } } : null; } });
      tarjetaGrafico(g, { titulo: "Tasas de interés (TNA)", keys: ["badlar", "tamar", "tasaDep"], n: 800, rangos: [rango(180, "6 meses"), rango(365, "1 año"), rango(730, "2 años")], defRango: 365,
        armar: function (m, d) { var a = ["badlar", "tamar", "tasaDep"].map(function (k) { return m[k] ? recortar(m[k], d) : null; }).filter(Boolean); return a.length ? { tipo: "line", series: a, fmt: function (x) { return num(x, 1) + "%"; } } : null; } });
      tarjetaGrafico(g, { titulo: "Base monetaria y circulación (billones)", keys: ["baseMon", "circulacion"], n: 800, rangos: [rango(180, "6 meses"), rango(365, "1 año"), rango(730, "2 años")], defRango: 365,
        armar: function (m, d) {
          var a = ["baseMon", "circulacion"].map(function (k) { if (!m[k]) return null; var r = recortar(m[k], d); return conPuntos(r, r.points.map(function (q) { return [q[0], q[1] / 1e6]; }), r.label, "billones", 2); }).filter(Boolean);
          return a.length ? { tipo: "line", series: a, fmt: function (x) { return num(x, 1) + " bill."; } } : null;
        } });
      tarjetaGrafico(g, { titulo: "Depósitos y préstamos (billones)", keys: ["depositos", "prestamos"], n: 800, rangos: [rango(180, "6 meses"), rango(365, "1 año"), rango(730, "2 años")], defRango: 365,
        armar: function (m, d) {
          var a = ["depositos", "prestamos"].map(function (k) { if (!m[k]) return null; var r = recortar(m[k], d); return conPuntos(r, r.points.map(function (q) { return [q[0], q[1] / 1e6]; }), r.label, "billones", 2); }).filter(Boolean);
          return a.length ? { tipo: "line", series: a, fmt: function (x) { return num(x, 0) + " bill."; } } : null;
        } });
      tarjetaGrafico(g, { titulo: "M2 privado, variación interanual", keys: ["m2IA"], n: 800, area: true, rangos: [rango(365, "1 año"), rango(730, "2 años")], defRango: 365,
        armar: function (m, d) { return m.m2IA ? { tipo: "line", series: [recortar(m.m2IA, d)], area: true, fmt: function (x) { return num(x, 1) + "%"; } } : null; } });
    }
  };

  var panelesArmados = {};

  function armarEconomia(sub) {
    var chips = $("econ-chips");
    chips.textContent = "";
    SUBS.forEach(function (s) {
      chips.appendChild(chip(s[1], s[0] === sub, function () { location.hash = "#economia:" + s[0]; }));
    });
    SUBS.forEach(function (s) { var p = $("econ-" + s[0]); if (p) p.hidden = s[0] !== sub; });
    var panel = $("econ-" + sub);
    if (panel && !panelesArmados[sub]) { panelesArmados[sub] = true; PANELES[sub](panel); }
  }

  /* ---------- Mercados ---------- */

  function tablaMercado(padre, panel, titulo, vacio) {
    var card = el("article", "card");
    card.appendChild(el("h2", "label", titulo));
    var controles = el("div", "mkt__ctl");
    var buscar = el("input", "mkt__search");
    buscar.type = "search"; buscar.placeholder = "Buscar símbolo"; buscar.setAttribute("aria-label", "Buscar símbolo en " + titulo);
    controles.appendChild(buscar);
    var orden = "suben";
    var chipsO = el("div", "chips chips--sm");
    controles.appendChild(chipsO);
    card.appendChild(controles);
    var cuerpo = el("div");
    card.appendChild(cuerpo);
    var pie = el("p", "hint", "Precios con demora. Fuente: data912.");
    card.appendChild(pie);
    padre.appendChild(card);
    var datos = [], limite = 30;

    function pintarChips() {
      chipsO.textContent = "";
      [["suben", "Mayor suba"], ["bajan", "Mayor baja"], ["volumen", "Más operadas"], ["az", "A-Z"]].forEach(function (o) {
        chipsO.appendChild(chip(o[1], orden === o[0], function () { orden = o[0]; limite = 30; pintarChips(); dibujar(); }));
      });
    }
    function dibujar() {
      var q = buscar.value.trim().toUpperCase();
      var f = datos.filter(function (r) { return !q || r.symbol.toUpperCase().indexOf(q) !== -1; });
      f.sort(function (a, b) {
        if (orden === "suben") return b.pct_change - a.pct_change;
        if (orden === "bajan") return a.pct_change - b.pct_change;
        if (orden === "volumen") return b.v - a.v;
        return a.symbol < b.symbol ? -1 : 1;
      });
      cuerpo.textContent = "";
      if (!f.length) { cuerpo.appendChild(el("p", "chart__empty", "Sin resultados.")); return; }
      var t = el("table", "tabla tabla--mkt");
      var th = el("thead"), trh = el("tr");
      ["Símbolo", "Último", "Var. %", "Volumen"].forEach(function (x, i) { trh.appendChild(el("th", i ? "num" : "", x)); });
      th.appendChild(trh); t.appendChild(th);
      var tb = el("tbody");
      f.slice(0, limite).forEach(function (r) {
        var tr = el("tr");
        tr.appendChild(el("td", "mkt__sym", r.symbol));
        tr.appendChild(el("td", "num", num(r.c, r.c < 100 ? 2 : 0)));
        tr.appendChild(el("td", "num", signo(r.pct_change, 2) + "%"));
        tr.appendChild(el("td", "num", r.v >= 1e6 ? num(r.v / 1e6, 1) + " M" : r.v >= 1e3 ? num(r.v / 1e3, 0) + " mil" : num(r.v, 0)));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      var w = el("div", "tabla__wrap"); w.appendChild(t); cuerpo.appendChild(w);
      if (f.length > limite) {
        var mas = el("button", "btn btn--ghost btn--sm", "Mostrar más (" + (f.length - limite) + ")");
        mas.type = "button"; mas.addEventListener("click", function () { limite += 30; dibujar(); });
        cuerpo.appendChild(mas);
      }
    }
    buscar.addEventListener("input", function () { limite = 30; dibujar(); });
    pintarChips();
    cuerpo.appendChild(esqueleto(260));
    S.live(panel).then(function (rows) {
      datos = rows.filter(function (r) { return r.c > 0 && typeof r.pct_change === "number" && r.v > 0; });
      dibujar();
    }, function () {
      cuerpo.textContent = "";
      var err = el("div", "chart__error");
      err.appendChild(el("p", "", vacio));
      cuerpo.appendChild(err);
    });
  }

  function armarMercados() {
    var v = $("mercados-contenido");
    var kp = el("div", "kpis kpis--3");
    v.appendChild(kp);
    var kR = kpi(kp, { label: "Riesgo país" }), kS = kpi(kp, { label: "Acciones que suben" }), kB = kpi(kp, { label: "Acciones que bajan" });
    S.cargarVarias(["riesgo"], 800).then(function (r) {
      var s = r.series.riesgo;
      if (s) kR.pintar(fmtSerie(s, s.ultimo.v), deltaDif(s, "pb", "vs día previo", 0) + " · " + fechaDato(s), s.points.slice(-60)); else kR.pintar("-", "sin dato");
    });
    S.live("arg_stocks").then(function (rows) {
      var ok = rows.filter(function (r) { return r.c > 0 && r.v > 0 && typeof r.pct_change === "number"; });
      kS.pintar(String(ok.filter(function (r) { return r.pct_change > 0; }).length), "de " + ok.length + " con operaciones", null);
      kB.pintar(String(ok.filter(function (r) { return r.pct_change < 0; }).length), "de " + ok.length + " con operaciones", null);
    }, function () { kS.pintar("-", "sin dato"); kB.pintar("-", "sin dato"); });

    tarjetaGrafico(v, {
      titulo: "Riesgo país (puntos básicos)", keys: ["riesgo"], n: 800, area: true, ancho: "full",
      rangos: [rango(90, "3 meses"), rango(365, "1 año"), rango(1095, "3 años")], defRango: 365,
      armar: function (m, d) { return m.riesgo ? { tipo: "line", series: [recortar(m.riesgo, d)], area: true, fmt: function (x) { return num(x, 0) + " pb"; } } : null; }
    });
    var g = el("div", "grid2");
    v.appendChild(g);
    tablaMercado(g, "arg_stocks", "Acciones argentinas", "No se pudieron cargar las acciones.");
    tablaMercado(g, "arg_bonds", "Bonos y letras", "No se pudieron cargar los bonos.");
  }

  /* ---------- API publica ---------- */

  var armado = {};

  function mostrar(nombre, sub) {
    if (nombre === "tablero") {
      if (!armado.tablero) { armado.tablero = true; armarTablero(); }
      tarjetaPlata();
    } else if (nombre === "dolar") {
      if (!armado.dolar) { armado.dolar = true; armarDolar(); }
    } else if (nombre === "inflacion") {
      if (!armado.inflacion) { armado.inflacion = true; armarInflacion(); }
    } else if (nombre === "economia") {
      subActual = SUBS.some(function (s) { return s[0] === sub; }) ? sub : subActual;
      armarEconomia(subActual);
    } else if (nombre === "mercados") {
      if (!armado.mercados) { armado.mercados = true; armarMercados(); }
    }
  }

  function refrescarNoticias() {
    var box = $("tablero-titulares");
    if (box && armado.tablero) armarTitulares(box);
    tarjetaPlata();
  }

  window.EconoDash = { mostrar: mostrar, refrescarNoticias: refrescarNoticias };
})();
