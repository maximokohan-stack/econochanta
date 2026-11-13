/*
 * Cinta de mercados: una franja arriba de todo con riesgo país, dólares financieros,
 * CEDEARs de ETFs que siguen índices, acciones líderes, ADRs en Nueva York y bonos.
 * Datos: ArgentinaDatos (riesgo país y dólares, cierre del día anterior o del día) y
 * data912 (precios con demora). Si una fuente falla, ese grupo no aparece: nunca se
 * completa con valores de ejemplo. La cinta se puede pausar y se queda quieta si el
 * sistema pide menos movimiento.
 */
(function () {
  "use strict";

  var S = window.EconoSeries;
  var REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var KEY_PAUSA = "econochanta:v1:cinta-pausa";
  var CADA_MS = 2 * 60 * 1000;

  // [símbolo en data912, nombre que se muestra]; los índices no cotizan como tales: se usan CEDEARs de ETFs que los siguen
  var GRUPOS = [
    { id: "idx", panel: "arg_cedears", titulo: "Índices, oro, petróleo y cripto", nota: "vía CEDEARs de ETFs, en pesos", moneda: "ARS",
      items: [["SPY", "S&P 500"], ["QQQ", "Nasdaq 100"], ["DIA", "Dow Jones"], ["EWZ", "Bolsa de Brasil"], ["GLD", "Oro"], ["USO", "Petróleo"], ["IBIT", "Bitcoin"], ["ETHA", "Ethereum"]] },
    { id: "acc", panel: "arg_stocks", titulo: "Acciones líderes", nota: "BYMA, en pesos", moneda: "ARS",
      items: [["GGAL", "Galicia"], ["YPFD", "YPF"], ["PAMP", "Pampa"], ["BMA", "Macro"], ["TXAR", "Ternium"], ["ALUA", "Aluar"], ["CEPU", "Central Puerto"], ["TGSU2", "TGS"], ["BBAR", "Francés"], ["LOMA", "Loma Negra"]] },
    { id: "adr", panel: "usa_adrs", titulo: "ADRs en Nueva York", nota: "en dólares", moneda: "USD",
      items: [["YPF", "YPF"], ["GGAL", "Galicia"], ["BMA", "Macro"], ["PAM", "Pampa"], ["TGS", "TGS"], ["CEPU", "Central Puerto"], ["TEO", "Telecom"]] },
    { id: "bon", panel: "arg_bonds", titulo: "Bonos soberanos", nota: "en pesos, cada 100 de valor nominal", moneda: "ARS",
      items: [["AL30", "AL30"], ["GD30", "GD30"], ["GD35", "GD35"], ["AE38", "AE38"], ["GD41", "GD41"]] }
  ];

  var estado = { datos: null, consultado: null, pausada: false, t: null };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
  function nf(v, d) { return v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function precio(v, moneda) {
    var d = v >= 1000 ? 0 : 2;
    return (moneda === "USD" ? "US$ " : "$ ") + nf(v, d);
  }
  function hora(t) { var d = new Date(t); return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }); }
  // tono graduado de la variación: verde subió, rojo bajó, más intenso cuanto más grande
  function calor(v) {
    if (!isFinite(v) || Math.abs(v) < 0.005) return "h-0";
    var a = Math.abs(v);
    return (v > 0 ? "h-u" : "h-d") + (a < 0.5 ? 1 : a < 1.5 ? 2 : a < 3 ? 3 : 4);
  }
  function flecha(v) { return Math.abs(v) < 0.005 ? "■" : v > 0 ? "▲" : "▼"; }
  function pct(v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + nf(Math.abs(v), 2) + "%"; }

  /* ---------- datos ---------- */

  // riesgo país y dólares financieros: último dato contra el anterior
  function serieArg(key, nombre, fmt, tipo) {
    return S.cargar(key, 10).then(function (s) {
      if (!s || !s.ultimo || !s.previo) throw new Error("sin dato");
      var v = s.ultimo.v, p = s.previo.v, c = tipo === "pb" ? v - p : (v / p - 1) * 100;
      return { nombre: nombre, valor: fmt(v), cambio: c, txtCambio: tipo === "pb" ? (c > 0 ? "+" : c < 0 ? "−" : "") + nf(Math.abs(c), 0) + " pb" : pct(c), fecha: s.ultimo.d };
    });
  }

  function cargar() {
    var arg = Promise.all([
      serieArg("riesgo", "Riesgo país", function (v) { return nf(v, 0) + " pb"; }, "pb").catch(function () { return null; }),
      serieArg("dMep", "Dólar MEP", function (v) { return "$ " + nf(v, 0); }).catch(function () { return null; }),
      serieArg("dCcl", "Dólar CCL", function (v) { return "$ " + nf(v, 0); }).catch(function () { return null; })
    ]).then(function (xs) {
      var items = xs.filter(Boolean);
      return items.length ? { id: "arg", titulo: "Argentina", nota: "ArgentinaDatos, último dato", items: items } : null;
    });
    var mercados = GRUPOS.map(function (g) {
      return S.live(g.panel).then(function (lista) {
        var por = {};
        lista.forEach(function (x) { por[x.symbol] = x; });
        var items = g.items.map(function (it) {
          var x = por[it[0]];
          if (!x || !isFinite(x.c) || x.c <= 0) return null;
          var c = Number(x.pct_change);
          return { nombre: it[1], simbolo: it[0], valor: precio(x.c, g.moneda), cambio: isFinite(c) ? c : 0, txtCambio: isFinite(c) ? pct(c) : "" };
        }).filter(Boolean);
        return items.length ? { id: g.id, titulo: g.titulo, nota: g.nota + " · data912, con demora", items: items } : null;
      }, function () { return null; });
    });
    return Promise.all([arg].concat(mercados)).then(function (gs) {
      estado.datos = gs.filter(Boolean);
      estado.consultado = Date.now();
      pintar();
    });
  }

  /* ---------- pantalla ---------- */

  function item(x, oculto) {
    var li = el("li", "cinta__it");
    var a = el("a", "cinta__link"); a.href = "#mercados";
    if (oculto) a.tabIndex = -1;
    a.appendChild(el("span", "cinta__nom", x.nombre));
    a.appendChild(el("span", "cinta__val", x.valor));
    var ch = el("span", "cinta__chg hchip " + calor(x.cambio), flecha(x.cambio) + " " + x.txtCambio);
    a.appendChild(ch);
    a.setAttribute("aria-label", x.nombre + ": " + x.valor + ", " + (x.cambio > 0 ? "sube " : x.cambio < 0 ? "baja " : "sin cambios ") + x.txtCambio.replace(/^[+−]/, ""));
    li.appendChild(a);
    return li;
  }

  function tira(oculto) {
    var ul = el("ul", "cinta__tira");
    if (oculto) ul.setAttribute("aria-hidden", "true");
    estado.datos.forEach(function (g) {
      var cab = el("li", "cinta__grupo");
      cab.appendChild(el("span", "cinta__gtit", g.titulo));
      cab.appendChild(el("span", "cinta__gnota", g.nota));
      ul.appendChild(cab);
      g.items.forEach(function (x) { ul.appendChild(item(x, oculto)); });
    });
    return ul;
  }

  function pintar() {
    var raiz = $("cinta"); if (!raiz) return;
    var vent = raiz.querySelector(".cinta__vent"), pie = raiz.querySelector(".cinta__estado");
    vent.textContent = "";
    if (!estado.datos || !estado.datos.length) {
      vent.appendChild(el("p", "cinta__vacio", estado.datos ? "Las cotizaciones de mercado no están disponibles ahora." : "Cargando cotizaciones…"));
      pie.textContent = "";
      raiz.classList.remove("cinta--mueve");
      return;
    }
    var pista = el("div", "cinta__pista");
    pista.appendChild(tira(false));
    if (!REDUCE) pista.appendChild(tira(true));
    vent.appendChild(pista);
    // la velocidad depende del largo: unos 70 px por segundo
    requestAnimationFrame(function () {
      var w = pista.firstChild.getBoundingClientRect().width;
      pista.style.setProperty("--dur", Math.max(120, Math.round(w / 16)) + "s");  // lenta: se lee sin perseguirla
    });
    raiz.classList.toggle("cinta--mueve", !REDUCE);
    pie.textContent = "Consultado " + hora(estado.consultado);
  }

  function pausar(v) {
    estado.pausada = v;
    var raiz = $("cinta"), b = $("cinta-pausa");
    if (raiz) raiz.classList.toggle("cinta--pausa", v);
    if (b) {
      b.setAttribute("aria-pressed", v ? "true" : "false");
      b.setAttribute("aria-label", v ? "Reanudar la cinta de mercados" : "Pausar la cinta de mercados");
      b.textContent = "";
      var NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg");
      s.setAttribute("viewBox", "0 0 16 16"); s.setAttribute("width", "14"); s.setAttribute("height", "14"); s.setAttribute("aria-hidden", "true");
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", v ? "M4 2.5v11l9-5.5z" : "M4 2.5h3v11H4zM9 2.5h3v11H9z");
      p.setAttribute("fill", "currentColor");
      s.appendChild(p); b.appendChild(s);
    }
    try { localStorage.setItem(KEY_PAUSA, v ? "1" : "0"); } catch (e) { /* sin storage */ }
  }

  function iniciar() {
    var raiz = $("cinta"); if (!raiz || !S || !S.live) return;
    var b = $("cinta-pausa");
    if (REDUCE && b) b.hidden = true;
    var guardada = false;
    try { guardada = localStorage.getItem(KEY_PAUSA) === "1"; } catch (e) { guardada = false; }
    pausar(guardada);
    if (b) b.addEventListener("click", function () { pausar(!estado.pausada); });
    pintar();
    cargar();
    estado.t = setInterval(function () { if (document.visibilityState === "visible") cargar(); }, CADA_MS);
  }

  window.EconoCinta = { recargar: cargar };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
