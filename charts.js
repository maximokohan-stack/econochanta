/*
 * Graficos SVG propios, sin dependencias.
 *   line(el, opts)   lineas con ejes, leyenda, valor final y tooltip
 *   bars(el, opts)   barras con signo (positivas y negativas)
 *   spark(el, pts)   sparkline para tarjetas
 *   csv(nombre, series)  descarga de datos
 * Las series no dependen solo del color: cada linea usa un trazo distinto y lleva rotulo.
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var TRAZOS = ["", "7 4", "2 4", "9 3 2 3"];
  var COLORES = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"];

  function s(tag, attrs, texto) {
    var e = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function h(tag, cls, texto) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function ms(d) { return new Date(d + "T12:00:00").getTime(); }

  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fechaCorta(d, modo) {
    var x = new Date(d + "T12:00:00");
    if (modo === "anio") return String(x.getFullYear());
    if (modo === "mes") return MESES[x.getMonth()] + " " + String(x.getFullYear()).slice(2);
    return x.getDate() + " " + MESES[x.getMonth()];
  }
  function fechaLarga(d, mensual) {
    var x = new Date(d + "T12:00:00");
    return mensual ? MESES[x.getMonth()] + " " + x.getFullYear() : x.getDate() + " " + MESES[x.getMonth()] + " " + x.getFullYear();
  }

  function ticks(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    var span = max - min;
    var paso = Math.pow(10, Math.floor(Math.log(span / n) / Math.LN10));
    var err = span / n / paso;
    paso *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var ini = Math.floor(min / paso) * paso;
    var out = [];
    for (var v = ini; v <= max + paso * 0.5; v += paso) out.push(Math.round(v / paso * 1e6) / 1e6 * paso);
    return out;
  }

  function mensual(points) {
    if (points.length < 3) return false;
    var dias = (ms(points[points.length - 1][0]) - ms(points[0][0])) / 86400000 / (points.length - 1);
    return dias > 20;
  }

  function nearest(points, t) {
    var lo = 0, hi = points.length - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (ms(points[mid][0]) < t) lo = mid; else hi = mid;
    }
    return Math.abs(ms(points[lo][0]) - t) <= Math.abs(ms(points[hi][0]) - t) ? lo : hi;
  }

  /* ---------- lineas ---------- */

  function observar(el, redo) {
    if (el.__ro) el.__ro.disconnect();
    if (typeof ResizeObserver !== "function") return;
    var ancho = el.clientWidth;
    var ro = new ResizeObserver(function () {
      if (el.clientWidth > 0 && Math.abs(el.clientWidth - ancho) > 24) { ro.disconnect(); redo(); }
    });
    ro.observe(el);
    el.__ro = ro;
  }

  function line(el, o) {
    if (el.__ro) el.__ro.disconnect();
    el.textContent = "";
    var series = o.series.filter(function (x) { return x && x.points && x.points.length; });
    if (!series.length) { el.appendChild(h("p", "chart__empty", "Sin datos para mostrar.")); return; }
    var fmt = o.fmt || function (v) { return String(v); };

    var W = Math.max(300, Math.round(el.clientWidth) || 640), H = o.height || 260, m = { l: 58, r: 14, t: 14, b: 28 };
    var tMin = Infinity, tMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    series.forEach(function (x) {
      x.points.forEach(function (p) {
        var t = ms(p[0]);
        if (t < tMin) tMin = t; if (t > tMax) tMax = t;
        if (p[1] < vMin) vMin = p[1]; if (p[1] > vMax) vMax = p[1];
      });
    });
    if (o.zero) { if (vMin > 0) vMin = 0; if (vMax < 0) vMax = 0; }
    var pad = (vMax - vMin) * 0.06 || 1;
    if (!o.zero || vMin < 0) vMin -= pad;
    vMax += pad;
    var yt = ticks(vMin, vMax, 4);
    vMin = Math.min(vMin, yt[0]); vMax = Math.max(vMax, yt[yt.length - 1]);

    function X(t) { return m.l + (t - tMin) / (tMax - tMin || 1) * (W - m.l - m.r); }
    function Y(v) { return H - m.b - (v - vMin) / (vMax - vMin || 1) * (H - m.t - m.b); }

    var leyenda = h("ul", "chart__legend");
    series.forEach(function (x, i) {
      var li = h("li");
      var sw = s("svg", { width: 26, height: 10, "aria-hidden": "true" });
      sw.appendChild(s("line", { x1: 1, y1: 5, x2: 25, y2: 5, stroke: x.color || COLORES[i % 4], "stroke-width": 2.5, "stroke-dasharray": TRAZOS[i % 4] }));
      li.appendChild(sw);
      var u = x.points[x.points.length - 1];
      li.appendChild(h("span", "", x.label));
      li.appendChild(h("strong", "", fmt(u[1])));
      leyenda.appendChild(li);
    });
    el.appendChild(leyenda);

    var wrap = h("div", "chart__wrap");
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "chart__svg", role: "img" });
    svg.setAttribute("aria-label", (o.titulo || "Gráfico") + ". " + series.map(function (x) {
      var a = x.points[0], b = x.points[x.points.length - 1];
      return x.label + ": de " + fmt(a[1]) + " (" + fechaLarga(a[0], mensual(x.points)) + ") a " + fmt(b[1]) + " (" + fechaLarga(b[0], mensual(x.points)) + ")";
    }).join(". "));

    yt.forEach(function (v) {
      if (v < vMin || v > vMax) return;
      svg.appendChild(s("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: "chart__grid" }));
      svg.appendChild(s("text", { x: m.l - 8, y: Y(v) + 4, class: "chart__tick", "text-anchor": "end" }, (o.tickFmt || fmt)(v)));
    });
    if (o.zero && vMin < 0 && vMax > 0) svg.appendChild(s("line", { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), class: "chart__zero" }));

    var spanDias = (tMax - tMin) / 86400000;
    var modo = spanDias > 900 ? "anio" : spanDias > 120 ? "mes" : "dia";
    var nx = 5;
    for (var i = 0; i < nx; i++) {
      var t = tMin + (tMax - tMin) * i / (nx - 1);
      var d = new Date(t).toISOString().slice(0, 10);
      svg.appendChild(s("text", { x: X(t), y: H - 8, class: "chart__tick", "text-anchor": i === 0 ? "start" : i === nx - 1 ? "end" : "middle" }, fechaCorta(d, modo)));
    }

    series.forEach(function (x, idx) {
      var d = x.points.map(function (p, j) { return (j ? "L" : "M") + X(ms(p[0])).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join("");
      var color = x.color || COLORES[idx % 4];
      if (o.area && series.length === 1) {
        var last = x.points[x.points.length - 1], first = x.points[0];
        svg.appendChild(s("path", { d: d + "L" + X(ms(last[0])).toFixed(1) + " " + Y(Math.max(vMin, 0) || vMin) + "L" + X(ms(first[0])).toFixed(1) + " " + Y(Math.max(vMin, 0) || vMin) + "Z", fill: color, opacity: 0.12 }));
      }
      svg.appendChild(s("path", { d: d, fill: "none", stroke: color, "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": TRAZOS[idx % 4], "vector-effect": "non-scaling-stroke" }));
      var u = x.points[x.points.length - 1];
      svg.appendChild(s("circle", { cx: X(ms(u[0])), cy: Y(u[1]), r: 3.5, fill: color }));
    });

    var guia = s("line", { y1: m.t, y2: H - m.b, class: "chart__guide", visibility: "hidden" });
    svg.appendChild(guia);
    var puntos = series.map(function (x, idx) { var c = s("circle", { r: 4.5, fill: x.color || COLORES[idx % 4], stroke: "var(--surface)", "stroke-width": 2, visibility: "hidden" }); svg.appendChild(c); return c; });

    wrap.appendChild(svg);
    var tip = h("div", "chart__tip");
    tip.hidden = true;
    wrap.appendChild(tip);
    el.appendChild(wrap);

    function mover(ev) {
      var r = svg.getBoundingClientRect();
      var px = (ev.clientX - r.left) / r.width * W;
      var t = tMin + (px - m.l) / (W - m.l - m.r) * (tMax - tMin);
      if (t < tMin) t = tMin; if (t > tMax) t = tMax;
      var ref = nearest(series[0].points, t);
      var f = series[0].points[ref][0];
      var xx = X(ms(f));
      guia.setAttribute("x1", xx); guia.setAttribute("x2", xx); guia.setAttribute("visibility", "visible");
      tip.textContent = "";
      tip.appendChild(h("strong", "", fechaLarga(f, mensual(series[0].points))));
      series.forEach(function (x, idx) {
        var j = nearest(x.points, ms(f));
        var p = x.points[j];
        puntos[idx].setAttribute("cx", X(ms(p[0]))); puntos[idx].setAttribute("cy", Y(p[1])); puntos[idx].setAttribute("visibility", "visible");
        var fila = h("div", "chart__tiprow");
        fila.appendChild(h("span", "", x.label));
        fila.appendChild(h("b", "", fmt(p[1])));
        tip.appendChild(fila);
      });
      tip.hidden = false;
      var left = xx / W * r.width;
      tip.style.left = Math.min(Math.max(left, 70), r.width - 70) + "px";
    }
    function salir() { guia.setAttribute("visibility", "hidden"); puntos.forEach(function (c) { c.setAttribute("visibility", "hidden"); }); tip.hidden = true; }
    svg.addEventListener("pointermove", mover);
    svg.addEventListener("pointerdown", mover);
    svg.addEventListener("pointerleave", salir);
    observar(el, function () { line(el, o); });
  }

  /* ---------- barras ---------- */

  function bars(el, o) {
    if (el.__ro) el.__ro.disconnect();
    el.textContent = "";
    var pts = o.points || [];
    if (!pts.length) { el.appendChild(h("p", "chart__empty", "Sin datos para mostrar.")); return; }
    var fmt = o.fmt || function (v) { return String(v); };
    var W = Math.max(300, Math.round(el.clientWidth) || 640), H = o.height || 220, m = { l: 50, r: 10, t: 14, b: 28 };
    var vMin = Math.min(0, Math.min.apply(null, pts.map(function (p) { return p[1]; })));
    var vMax = Math.max(0, Math.max.apply(null, pts.map(function (p) { return p[1]; })));
    var pad = (vMax - vMin) * 0.08 || 1;
    if (vMax > 0) vMax += pad; if (vMin < 0) vMin -= pad;
    var yt = ticks(vMin, vMax, 4);
    vMin = Math.min(vMin, yt[0]); vMax = Math.max(vMax, yt[yt.length - 1]);
    function Y(v) { return H - m.b - (v - vMin) / (vMax - vMin || 1) * (H - m.t - m.b); }
    var bw = (W - m.l - m.r) / pts.length;

    var wrap = h("div", "chart__wrap");
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "chart__svg", role: "img" });
    var ult = pts[pts.length - 1];
    svg.setAttribute("aria-label", (o.titulo || "Gráfico de barras") + ". Último dato: " + fmt(ult[1]) + " (" + fechaLarga(ult[0], true) + "). Máximo " + fmt(Math.max.apply(null, pts.map(function (p) { return p[1]; }))) + ", mínimo " + fmt(Math.min.apply(null, pts.map(function (p) { return p[1]; }))) + ".");
    yt.forEach(function (v) {
      svg.appendChild(s("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: v === 0 ? "chart__zero" : "chart__grid" }));
      svg.appendChild(s("text", { x: m.l - 8, y: Y(v) + 4, class: "chart__tick", "text-anchor": "end" }, (o.tickFmt || fmt)(v)));
    });
    var cada = Math.max(1, Math.ceil(pts.length / 6));
    pts.forEach(function (p, i) {
      var x = m.l + i * bw + bw * 0.15, w = bw * 0.7;
      var y0 = Y(0), y1 = Y(p[1]);
      var color = o.color ? o.color(p[1]) : "var(--c1)";
      var r = s("rect", { x: x, y: Math.min(y0, y1), width: w, height: Math.max(1, Math.abs(y1 - y0)), fill: color, rx: 1.5 });
      r.appendChild(s("title", null, fechaLarga(p[0], true) + ": " + fmt(p[1])));
      svg.appendChild(r);
      if ((pts.length - 1 - i) % cada === 0) svg.appendChild(s("text", { x: x + w / 2, y: H - 8, class: "chart__tick", "text-anchor": "middle" }, fechaCorta(p[0], "mes")));
    });
    wrap.appendChild(svg);
    el.appendChild(wrap);
    observar(el, function () { bars(el, o); });
  }

  /* ---------- sparkline ---------- */

  function spark(svg, pts, color) {
    svg.textContent = "";
    if (!pts || pts.length < 2) return;
    var min = Math.min.apply(null, pts.map(function (p) { return p[1]; }));
    var max = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
    var W = 100, H = 28;
    var d = pts.map(function (p, i) {
      var x = i / (pts.length - 1) * W;
      var y = H - 3 - (p[1] - min) / (max - min || 1) * (H - 6);
      return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }).join("");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.appendChild(s("path", { d: d, fill: "none", stroke: color || "var(--c1)", "stroke-width": 1.8, "stroke-linejoin": "round", "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" }));
  }

  /* ---------- csv ---------- */

  function csv(nombre, series) {
    var fechas = {};
    series.forEach(function (x) { x.points.forEach(function (p) { fechas[p[0]] = true; }); });
    var orden = Object.keys(fechas).sort();
    var idx = series.map(function (x) { var m = {}; x.points.forEach(function (p) { m[p[0]] = p[1]; }); return m; });
    var filas = ["fecha," + series.map(function (x) { return '"' + x.label.replace(/"/g, '""') + '"'; }).join(",")];
    orden.forEach(function (f) { filas.push(f + "," + idx.map(function (m) { return m[f] === undefined ? "" : m[f]; }).join(",")); });
    var blob = new Blob(["﻿" + filas.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  window.EconoCharts = { line: line, bars: bars, spark: spark, csv: csv, fechaLarga: fechaLarga, mensual: mensual };
})();
