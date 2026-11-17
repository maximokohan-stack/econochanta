/*
 * Deuda neta del Estado nacional: deuda bruta del Tesoro menos la parte en manos del propio Estado.
 * Datos: data/deuda.json (scripts/build_deuda.py, a partir de los informes trimestrales de la Secretaría de Finanzas).
 */
(function () {
  "use strict";

  var datos = null, pedido = null;
  var TRIM = { "03": "mar", "06": "jun", "09": "sep", "12": "dic" };
  var MES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function cargar() {
    if (datos) return Promise.resolve(datos);
    if (pedido) return pedido;
    pedido = fetch("data/deuda.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("sin deuda.json"); return r.json(); })
      .then(function (d) { if (!d.puntos || !d.puntos.length) throw new Error("vacío"); datos = d; return d; })
      .catch(function (e) { pedido = null; throw e; });
    return pedido;
  }

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function m(v) { return Math.round(v).toLocaleString("es-AR"); }
  function neta(p) { return p.privado + p.multi; }
  function pbiNeta(p) {
    var a = parseFloat(String(p.pbi.privado).replace(",", ".")), b = parseFloat(String(p.pbi.multi).replace(",", "."));
    return isFinite(a + b) ? (a + b).toFixed(1).replace(".", ",") + "%" : "";
  }
  function fechaLarga(f) { return Number(f.slice(8, 10)) + " de " + MES_L[Number(f.slice(5, 7)) - 1] + " de " + f.slice(0, 4); }
  function fechaCorta(f) { return TRIM[f.slice(5, 7)] + " " + f.slice(2, 4); }

  var NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, txt) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (txt != null) e.textContent = txt;
    return e;
  }

  function grafico(pts, ancho) {
    // el ancho real de la caja: así la letra del gráfico queda del mismo tamaño en celular y en escritorio
    var W = Math.max(320, Math.round(ancho || 1000)), H = W < 600 ? 290 : 280, x0 = W < 600 ? 58 : 74, x1 = W - 10, y0 = 20, y1 = H - 34;
    var hi = Math.ceil(Math.max.apply(null, pts.map(function (p) { return p.total; })) / 100000) * 100000;
    function Y(v) { return y1 - (y1 - y0) * v / hi; }
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img",
      "aria-label": "Deuda bruta del Tesoro por acreedor, de " + fechaLarga(pts[0].fecha) + " a " + fechaLarga(pts[pts.length - 1].fecha) +
        ": la deuda neta pasó de " + m(neta(pts[0])) + " a " + m(neta(pts[pts.length - 1])) + " millones de dólares" });
    var defs = s("defs", {}), pat = s("pattern", { id: "deuda-raya", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    pat.appendChild(s("rect", { width: 7, height: 7, "class": "deuda__fondo" }));
    pat.appendChild(s("line", { x1: 0, y1: 0, x2: 0, y2: 7, "class": "deuda__raya" }));
    defs.appendChild(pat); svg.appendChild(defs);
    for (var v = 0; v <= hi; v += 100000) {
      svg.appendChild(s("line", { x1: x0, x2: x1, y1: Y(v), y2: Y(v), "class": v ? "deuda__eje" : "deuda__eje0" }));
      svg.appendChild(s("text", { x: x0 - 8, y: Y(v) + 4, "text-anchor": "end", "class": "deuda__lab" }, m(v / 1000) + (W < 600 ? " mil" : " mil M")));
    }
    var bw = (x1 - x0) / pts.length;
    pts.forEach(function (p, i) {
      var x = x0 + i * bw + bw * 0.2, w = bw * 0.6;
      var yp = Y(p.privado), ym = Y(p.privado + p.multi), ya = Y(p.total);
      svg.appendChild(s("rect", { x: x, y: yp, width: w, height: y1 - yp, "class": "deuda__priv" }));
      svg.appendChild(s("rect", { x: x, y: ym, width: w, height: yp - ym, "class": "deuda__multi" }));
      svg.appendChild(s("rect", { x: x, y: ya, width: w, height: ym - ya, fill: "url(#deuda-raya)" }));
      if (w > 64) svg.appendChild(s("text", { x: x + w / 2, y: ym + 18, "text-anchor": "middle", "class": "deuda__in" }, m(neta(p) / 1000) + " mil M"));
      // en pantallas angostas, mes y año en dos renglones para que no se pisen
      var lab = s("text", { x: x + w / 2, y: y1 + 20, "text-anchor": "middle", "class": "deuda__lab" });
      if (W < 600) {
        lab.appendChild(s("tspan", { x: x + w / 2, dy: 0 }, TRIM[p.fecha.slice(5, 7)]));
        lab.appendChild(s("tspan", { x: x + w / 2, dy: 14 }, p.fecha.slice(2, 4)));
      } else lab.textContent = fechaCorta(p.fecha);
      svg.appendChild(lab);
    });
    return svg;
  }

  function kpi(cls, l, v, n) {
    var d = el("div", "deuda__k" + (cls ? " " + cls : ""));
    d.appendChild(el("p", "deuda__kl", l)); d.appendChild(el("p", "deuda__kv", v)); d.appendChild(el("p", "deuda__kn", n));
    return d;
  }

  function pintar(caja) {
    if (!caja || caja.__deuda) return;
    caja.__deuda = true;
    caja.appendChild(el("p", "hint", "Cargando la deuda…"));
    cargar().then(function (d) {
      var pts = d.puntos, u = pts[pts.length - 1], p0 = pts[0], dif = neta(u) - neta(p0);
      caja.textContent = "";
      var card = el("section", "sp-card deuda__card"); card.setAttribute("aria-labelledby", "deuda-tit");
      var cab = el("div", "deuda__cab"), izq = el("div");
      var h = el("h2", "deuda__tit", "Deuda neta del Estado nacional"); h.id = "deuda-tit"; izq.appendChild(h);
      izq.appendChild(el("p", "deuda__baj", "Lo que el Tesoro le debe a quienes no son el propio Estado. A la deuda bruta se le resta la parte que tienen otros organismos públicos (BCRA, FGS de la ANSES, Banco Nación y otros). Al " + fechaLarga(u.fecha) + ", en millones de dólares."));
      cab.appendChild(izq);
      var ley = el("p", "deuda__ley");
      [["deuda__ley-priv", "Privados"], ["deuda__ley-multi", "Organismos internacionales"], ["deuda__ley-raya", "Otros organismos del Estado (se resta)"]].forEach(function (x) {
        var sp = el("span"); sp.appendChild(el("i", x[0])); sp.appendChild(document.createTextNode(x[1])); ley.appendChild(sp);
      });
      cab.appendChild(ley); card.appendChild(cab);
      var k = el("div", "deuda__kpis");
      k.appendChild(kpi("deuda__k--neta", "Deuda neta", "US$ " + m(neta(u)) + " M", pbiNeta(u) + " del PBI · " + (dif >= 0 ? "+" : "−") + m(Math.abs(dif)) + " M desde " + fechaCorta(p0.fecha)));
      k.appendChild(kpi("", "Con privados", "US$ " + m(u.privado) + " M", u.pbi.privado + " del PBI. Incluye " + m(u.elegible) + " M de deuda impaga pendiente de reestructurar"));
      k.appendChild(kpi("", "Con organismos internacionales", "US$ " + m(u.multi) + " M", u.pbi.multi + " del PBI · FMI, BID, Banco Mundial, CAF y otros"));
      k.appendChild(kpi("deuda__k--estado", "En manos del propio Estado", "US$ " + m(u.agencias) + " M", u.pbi.agencias + " del PBI. No se cuenta: es el Estado debiéndose a sí mismo"));
      card.appendChild(k);
      var cuenta = el("p", "deuda__cuenta");
      cuenta.innerHTML = "Deuda bruta <b></b> <span>−</span> en manos del Estado <b></b> <span>=</span> deuda neta <b></b>";
      var bs = cuenta.querySelectorAll("b");
      bs[0].textContent = "US$ " + m(u.total) + " M"; bs[1].textContent = "US$ " + m(u.agencias) + " M"; bs[2].textContent = "US$ " + m(neta(u)) + " M";
      card.appendChild(cuenta);
      var g = el("div", "deuda__graf"); card.appendChild(g);
      var f = el("p", "deuda__fuente");
      f.appendChild(document.createTextNode("Fuente: "));
      var a = el("a", "", "Secretaría de Finanzas"); a.href = d.url; a.target = "_blank"; a.rel = "noopener"; f.appendChild(a);
      f.appendChild(document.createTextNode(", «Deuda Bruta de la Administración Central por acreedor», informes trimestrales. Los % del PBI son los de cada informe. La Secretaría publica el total en manos del Estado, no cuánto tiene cada organismo. Sale una vez por trimestre, con unos tres meses de atraso."));
      card.appendChild(f);
      card.appendChild(el("p", "deuda__fuente", "No incluye la deuda propia del BCRA ni la de empresas públicas y fondos fiduciarios: no tienen una serie oficial periódica. Las provincias no son organismos nacionales."));
      caja.appendChild(card);
      g.appendChild(grafico(pts, g.clientWidth));
    }).catch(function () {
      caja.__deuda = false;
      caja.textContent = "";
      caja.appendChild(el("p", "hint", "No se pudo cargar la deuda. Probá de nuevo en un rato."));
    });
  }

  window.EconoDeuda = {
    pintar: pintar,
    // para la tarjeta del Inicio: la deuda neta del último trimestre
    ultimo: function () { return cargar().then(function (d) { var u = d.puntos[d.puntos.length - 1]; return { neta: neta(u), fecha: u.fecha, texto: "US$ " + m(neta(u)) + " M", corta: fechaCorta(u.fecha) }; }); }
  };
})();
