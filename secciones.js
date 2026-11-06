/*
 * Portadas de las secciones Dólares e Inflación (diseño "Pulso").
 * Arriba de cada mesa de indicadores: un titular armado con los datos, el dato grande,
 * un gráfico que se recorre con el mouse, el dedo o las flechas, y tarjetas que explican.
 * Todo sale de las mismas series que usa el resto de la app (series.js). Si una fuente
 * falla, esa parte dice "sin dato": nunca se completa con valores de ejemplo.
 */
(function () {
  "use strict";

  var S = window.EconoSeries, C = window.EconoCharts;
  var MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var NS = "http://www.w3.org/2000/svg";

  /* ---------- utilidades ---------- */

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
  function sv(tag, at) { var e = document.createElementNS(NS, tag); Object.keys(at || {}).forEach(function (k) { e.setAttribute(k, at[k]); }); return e; }
  function nf(v, d) { var k = d === undefined ? 0 : d; return Math.abs(v) < 1e-9 ? (0).toLocaleString("es-AR", { minimumFractionDigits: k, maximumFractionDigits: k }) : v.toLocaleString("es-AR", { minimumFractionDigits: k, maximumFractionDigits: k }); }
  function pesos(v) { return "$ " + nf(v, 0); }
  function conSigno(v, d, suf) { var r = Number(Math.abs(v).toFixed(d === undefined ? 1 : d)); return (r === 0 ? "" : v > 0 ? "+" : "−") + nf(Math.abs(v), d === undefined ? 1 : d) + (suf === undefined ? "%" : suf); }
  function flecha(v) { return Math.abs(v) < 1e-4 ? "■ " : v > 0 ? "▲ " : "▼ "; }
  function fecha(iso) { return new Date(String(iso).slice(0, 10) + "T12:00:00"); }
  function mesAnio(iso) { var d = fecha(iso); return MESES_L[d.getMonth()] + " de " + d.getFullYear(); }
  function mesNom(iso) { return MESES_L[fecha(iso).getMonth()]; }
  function mayus(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function diaMes(iso) { var d = fecha(iso); return d.getDate() + "/" + (d.getMonth() + 1); }
  function diaMesAnio(iso) { var d = fecha(iso); return d.getDate() + " " + MESES_C[d.getMonth()] + " " + String(d.getFullYear()).slice(2); }
  function hoyLargo() { var d = new Date(); return DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES_L[d.getMonth()]; }
  function hoyISO() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function isoLocal(t) { var d = new Date(t); return isNaN(d) ? null : d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function hora(t) { var d = new Date(t); return isNaN(d) ? "" : d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }); }
  function anunciar(t) { var a = $("anuncio"); if (a) { a.textContent = ""; setTimeout(function () { a.textContent = t; }, 30); } }

  // valor de la serie en una fecha (el ultimo punto que no la pasa)
  function valorEn(pts, iso) { for (var i = pts.length - 1; i >= 0; i--) if (pts[i][0] <= iso) return pts[i]; return null; }
  function antesDe(pts, iso, dias) { var obj = new Date(fecha(iso).getTime() - dias * 86400000).toISOString().slice(0, 10); return valorEn(pts, obj); }
  // mismo mes, un año antes (para series mensuales)
  function mismoMesAnterior(pts, iso) { var d = fecha(iso); var obj = (d.getFullYear() - 1) + "-" + ("0" + (d.getMonth() + 1)).slice(-2); for (var i = pts.length - 1; i >= 0; i--) if (pts[i][0].slice(0, 7) === obj) return pts[i]; return null; }
  function delMes(pts, iso) { var m = String(iso).slice(0, 7); for (var i = pts.length - 1; i >= 0; i--) if (pts[i][0].slice(0, 7) === m) return pts[i]; return null; }

  // escala de calor en 4 tonos (h-u = subió, h-d = bajó), con los cortes que se le pasan
  function calor(v, cortes) {
    if (v === null || v === undefined || !isFinite(v) || Math.abs(v) < 1e-4) return "h-0";
    var a = Math.abs(v), c = cortes || [0.25, 1, 3];
    return (v > 0 ? "h-u" : "h-d") + (a < c[0] ? 1 : a < c[1] ? 2 : a < c[2] ? 3 : 4);
  }
  function chip(v, txt, suf, cortes) {
    if (v === null || v === undefined || !isFinite(v)) return el("span", "hchip h-0", "sin dato");
    return el("span", "hchip " + calor(v, cortes), flecha(v) + txt + (suf || ""));
  }
  function boton(txt, cls) { var b = el("button", cls || "", txt); b.type = "button"; return b; }
  function icono(d) { var s = sv("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", width: "16", height: "16", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }); s.appendChild(sv("path", { d: d })); return s; }
  // el numero cuenta desde el valor anterior hasta el nuevo (nodo.__anim queda en true mientras cuenta)
  function contar(nodo, desde, hasta, fmt) {
    cancelAnimationFrame(nodo.__raf); nodo.__anim = false;
    if (REDUCE || desde === null || desde === hasta) { nodo.textContent = fmt(hasta); return; }
    var t0 = null; nodo.__anim = true;
    function paso(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / 900);
      nodo.textContent = fmt(desde + (hasta - desde) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) nodo.__raf = requestAnimationFrame(paso); else { nodo.__anim = false; nodo.textContent = fmt(hasta); }
    }
    nodo.__raf = requestAnimationFrame(paso);
  }
  function glosa(id) { return (window.EconoGlosario && window.EconoGlosario[id]) || null; }

  /* ---------- grafico de linea que se recorre ---------- */

  // pts = [[fecha, valor]]; fmt = formato del valor; etiqueta(fecha, esUltimo) = texto de la fecha
  function grafico(caja, pts, o) {
    caja.textContent = "";
    var n = pts.length;
    if (n < 2) { caja.appendChild(el("p", "hint", "No hay datos suficientes para el gráfico.")); return null; }
    var vals = pts.map(function (p) { return p[1]; });
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = (mx - mn) || 1;
    var W = 1000, H = 300;
    function x(i) { return i * W / (n - 1); }
    function y(v) { return 270 - (v - mn) / rg * 240; }
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p[1]).toFixed(1); }).join(" ");

    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", role: "img", "class": "gl__svg", "aria-label": o.aria });
    [30, 150, 270].forEach(function (yy) { g.appendChild(sv("line", { x1: 0, x2: W, y1: yy, y2: yy, "class": "gl__grid", "data-c": "line", "vector-effect": "non-scaling-stroke" })); });
    g.appendChild(sv("path", { d: d + " L" + W + " " + H + " L0 " + H + " Z", "class": "gl__ar", "data-c": "area" }));
    var ln = sv("path", { d: d, pathLength: "1", "class": "gl__ln", "data-c": "acc", "vector-effect": "non-scaling-stroke" });
    // el trazo punteado solo sirve para la animacion de dibujo: al terminar se saca, si no deja huecos al escalar
    ln.addEventListener("animationend", function () { ln.style.strokeDasharray = "none"; });
    g.appendChild(ln);
    var cruz = sv("line", { x1: 0, x2: 0, y1: 20, y2: H, "class": "gl__cruz", "vector-effect": "non-scaling-stroke" }); cruz.style.display = "none"; g.appendChild(cruz);
    var marca = sv("circle", { cx: x(n - 1), cy: y(vals[n - 1]), r: 5, "class": "gl__punto" }); g.appendChild(marca);

    var capa = el("div", "gl__capa"); capa.tabIndex = 0;
    capa.setAttribute("role", "slider");
    capa.setAttribute("aria-label", "Recorré el gráfico con el mouse, el dedo o las flechas");
    capa.setAttribute("aria-valuemin", "0"); capa.setAttribute("aria-valuemax", String(n - 1)); capa.setAttribute("aria-valuenow", String(n - 1));
    capa.setAttribute("aria-valuetext", o.fmt(vals[n - 1]) + ", " + o.etiqueta(pts[n - 1][0], true));
    var tip = el("div", "gl__tip"); tip.hidden = true;
    caja.appendChild(capa); caja.appendChild(tip); caja.appendChild(g);
    caja.appendChild(el("span", "gl__max", o.fmt(mx)));
    caja.appendChild(el("span", "gl__min", o.fmt(mn)));
    // el punto marcado en el svg se estira con el preserveAspectRatio: se dibuja como circulo de html
    marca.style.display = "none";
    var dot = el("i", "gl__dot"); caja.appendChild(dot);
    function ubicarDot(i) { dot.style.left = (i / (n - 1) * 100) + "%"; dot.style.top = (y(vals[i]) / H * 100) + "%"; }
    ubicarDot(n - 1);

    var actual = null;
    function mostrar(i) {
      actual = i;
      var fr = i / (n - 1);
      cruz.setAttribute("x1", x(i)); cruz.setAttribute("x2", x(i)); cruz.style.display = "";
      tip.hidden = false;
      tip.textContent = "";
      tip.appendChild(el("strong", "", o.fmt(vals[i]))); tip.appendChild(document.createTextNode(" · " + o.etiqueta(pts[i][0], i === n - 1)));
      tip.style.left = (fr * 100) + "%";
      tip.style.transform = "translateX(" + (fr > 0.85 ? "-100%" : fr < 0.15 ? "0" : "-50%") + ")";
      ubicarDot(i);
      capa.setAttribute("aria-valuenow", String(i));
      capa.setAttribute("aria-valuetext", o.fmt(vals[i]) + ", " + o.etiqueta(pts[i][0], i === n - 1));
    }
    function ocultar() { actual = null; cruz.style.display = "none"; tip.hidden = true; ubicarDot(n - 1); }
    function desdeEvento(ev) { var b = capa.getBoundingClientRect(); var f = (ev.clientX - b.left) / b.width; mostrar(Math.max(0, Math.min(n - 1, Math.round(f * (n - 1))))); }
    capa.addEventListener("pointermove", desdeEvento);
    capa.addEventListener("pointerdown", desdeEvento);
    capa.addEventListener("pointerleave", ocultar);
    capa.addEventListener("blur", ocultar);
    capa.addEventListener("keydown", function (ev) {
      var c = actual === null ? n - 1 : actual, k = ev.key;
      if (k === "ArrowLeft" || k === "ArrowDown") { ev.preventDefault(); mostrar(Math.max(0, c - 1)); }
      else if (k === "ArrowRight" || k === "ArrowUp") { ev.preventDefault(); mostrar(Math.min(n - 1, c + 1)); }
      else if (k === "Home") { ev.preventDefault(); mostrar(0); }
      else if (k === "End") { ev.preventDefault(); mostrar(n - 1); }
      else if (k === "Escape") ocultar();
    });
    return g;
  }

  // el grafico como imagen PNG, con titulo y fuente (sin depender de la hoja de estilos)
  function exportarPng(g, titulo, bajada, fuente, nombre) {
    if (!g) return;
    var cs = getComputedStyle(document.documentElement);
    function c(v, def) { return (cs.getPropertyValue(v) || "").trim() || def; }
    var col = { fondo: c("--surface", "#111831"), texto: c("--text", "#edf1ff"), suave: c("--text-2", "#a7b1cf"), acc: c("--accent", "#7cb8f0"), linea: c("--line", "#222d52") };
    var clon = g.cloneNode(true);
    clon.setAttribute("xmlns", NS); clon.setAttribute("width", "1000"); clon.setAttribute("height", "300");
    [].forEach.call(clon.querySelectorAll("[data-c]"), function (e) {
      var t = e.getAttribute("data-c");
      if (t === "line") e.setAttribute("stroke", col.linea);
      if (t === "acc") { e.setAttribute("stroke", col.acc); e.setAttribute("fill", "none"); e.setAttribute("stroke-width", "3"); }
      if (t === "area") { e.setAttribute("fill", col.acc); e.setAttribute("fill-opacity", "0.14"); }
    });
    [].forEach.call(clon.querySelectorAll(".gl__cruz, .gl__punto"), function (e) { e.remove(); });
    var url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clon)], { type: "image/svg+xml" }));
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement("canvas"); cv.width = 1200; cv.height = 560;
      var x = cv.getContext("2d");
      x.fillStyle = col.fondo; x.fillRect(0, 0, cv.width, cv.height);
      x.fillStyle = col.texto; x.font = "700 34px Inter, system-ui, sans-serif"; x.fillText(titulo, 60, 74);
      x.fillStyle = col.suave; x.font = "500 22px Inter, system-ui, sans-serif"; x.fillText(bajada, 60, 112);
      x.drawImage(img, 60, 150, 1080, 320);
      x.font = "500 18px Inter, system-ui, sans-serif"; x.fillText(fuente + " · econochanta", 60, 520);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) {
        if (!b) { anunciar("No se pudo armar la imagen"); return; }
        var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nombre + ".png";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        anunciar("Imagen descargada");
      });
    };
    img.onerror = function () { URL.revokeObjectURL(url); anunciar("No se pudo armar la imagen"); };
    img.src = url;
  }

  function compartir(titulo, texto, url, boton) {
    if (navigator.share) { navigator.share({ title: titulo, text: texto, url: url }).catch(function () { /* cancelado */ }); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto + " " + url).then(function () {
        anunciar("Link copiado"); var t = boton.lastChild.textContent; boton.lastChild.textContent = "Link copiado";
        setTimeout(function () { boton.lastChild.textContent = t; }, 1800);
      }, function () { anunciar("No se pudo copiar el link"); });
    } else anunciar("Tu navegador no permite compartir ni copiar automáticamente");
  }

  function accion(txt, d) { var b = boton("", "act"); b.appendChild(icono(d)); b.appendChild(document.createTextNode(txt)); return b; }
  var IC_COMP = "M18 8a3 3 0 1 0-2.8-4M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4";
  var IC_IMG = "M12 4v11M7 10l5 5 5-5M5 20h14";
  var IC_CSV = "M4 4h16v16H4zM4 10h16M10 4v16";

  /* ================= DÓLARES ================= */

  var DOL = [
    { id: "oficial", key: "dOficial", nombre: "Oficial", corto: "oficial" },
    { id: "blue", key: "dBlue", nombre: "Blue", corto: "blue" },
    { id: "mep", key: "dMep", nombre: "MEP", corto: "MEP" },
    { id: "ccl", key: "dCcl", nombre: "CCL", corto: "CCL" },
    { id: "tarjeta", key: "dTarjeta", nombre: "Tarjeta", corto: "tarjeta" }
  ];
  var PER_DOL = [["1m", "1 mes", 31, "último mes"], ["3m", "3 meses", 92, "últimos 3 meses"], ["1a", "1 año", 366, "último año"]];
  var dol = { k: "oficial", per: "3m", s: {}, err: {}, cot: null, inf: null, dom: null, pend: null, mostrado: null };

  function dolDef(id) { return DOL.filter(function (d) { return d.id === id; })[0]; }

  // el dato de un dolar: precio de venta en vivo (DolarAPI) si hay, si no el ultimo cierre (ArgentinaDatos)
  function dolInfo(d) {
    var s = dol.s[d.id]; if (!s) return null;
    var pts = s.points.slice(), c = dol.cot && dol.cot[d.key], vivo = null;
    if (c && isFinite(c.venta)) {
      var dia = isoLocal(c.fecha) || hoyISO();
      if (pts.length && pts[pts.length - 1][0] === dia) pts[pts.length - 1] = [dia, c.venta];
      else if (!pts.length || pts[pts.length - 1][0] < dia) pts.push([dia, c.venta]);
      vivo = c;
    }
    var ult = pts[pts.length - 1], v = ult[1];
    var ant = null; for (var i = pts.length - 2; i >= 0; i--) if (pts[i][0] < ult[0]) { ant = pts[i]; break; }
    var h30 = antesDe(pts, ult[0], 30), h365 = antesDe(pts, ult[0], 365);
    return {
      v: v, fecha: ult[0], pts: pts, vivo: vivo, fuente: s.fuente || "ArgentinaDatos",
      hoy: ant ? (v / ant[1] - 1) * 100 : null,
      m30: h30 ? (v / h30[1] - 1) * 100 : null,
      y1: h365 && h365[0] < ult[0] ? (v / h365[1] - 1) * 100 : null
    };
  }

  function armarDolares() {
    var cuerpo = $("dol-cuerpo"); if (!cuerpo || dol.dom) return;
    var D = dol.dom = {};
    D.picks = el("div", "dp"); D.picks.setAttribute("role", "group"); D.picks.setAttribute("aria-label", "Elegí un tipo de dólar");
    cuerpo.appendChild(D.picks);

    var card = el("section", "sp-card dg"); card.setAttribute("aria-labelledby", "dg-tit");
    var top = el("div", "dg__top"), izq = el("div", "dg__izq");
    D.tit = el("h2", "dg__tit"); D.tit.id = "dg-tit"; izq.appendChild(D.tit);
    D.big = el("p", "dg__big", "…"); izq.appendChild(D.big);
    D.nota = el("p", "dg__nota"); izq.appendChild(D.nota);
    top.appendChild(izq);
    D.cambios = el("dl", "dg__cambios"); top.appendChild(D.cambios);
    card.appendChild(top);

    var barra = el("div", "dg__barra");
    D.pers = el("div", "seg-grupo"); D.pers.setAttribute("role", "group"); D.pers.setAttribute("aria-label", "Período del gráfico");
    barra.appendChild(D.pers);
    var acc = el("div", "dg__acc");
    D.bComp = accion("Compartir", IC_COMP); D.bImg = accion("Imagen", IC_IMG); D.bCsv = accion("CSV", IC_CSV);
    acc.appendChild(D.bComp); acc.appendChild(D.bImg); acc.appendChild(D.bCsv);
    barra.appendChild(acc);
    card.appendChild(barra);
    D.graf = el("div", "gl"); card.appendChild(D.graf);
    D.ejes = el("div", "gl__ejes"); card.appendChild(D.ejes);
    D.stats = el("dl", "dg__stats"); card.appendChild(D.stats);
    cuerpo.appendChild(card);

    var fila = el("div", "sp-fila");
    D.que = el("section", "sp-card sp-que"); D.que.setAttribute("aria-labelledby", "dq-tit"); fila.appendChild(D.que);
    D.brecha = el("section", "sp-card db"); D.brecha.setAttribute("aria-labelledby", "db-tit"); fila.appendChild(D.brecha);
    cuerpo.appendChild(fila);

    D.bComp.addEventListener("click", function () {
      var d = dolDef(dol.k), i = dolInfo(d);
      compartir("Dólar " + d.corto + " · Econochanta", i ? "Dólar " + d.corto + ": " + pesos(i.v) + " (venta)." : "Dólar " + d.corto, location.origin + location.pathname + "#dolares", D.bComp);
    });
    D.bImg.addEventListener("click", function () {
      var d = dolDef(dol.k), i = dolInfo(d); if (!i) return;
      var per = PER_DOL.filter(function (p) { return p[0] === dol.per; })[0];
      exportarPng(D.svg, "Dólar " + d.corto + ": " + pesos(i.v), "Precio de venta, " + per[3], "Fuente: " + (i.vivo ? "DolarAPI y " : "") + i.fuente, "dolar-" + d.id);
    });
    D.bCsv.addEventListener("click", function () {
      var d = dolDef(dol.k), i = dolInfo(d); if (!i) return;
      C.csv("dolar-" + d.id, [{ label: "Dólar " + d.corto + " (venta, " + i.fuente + ")", points: i.pts }]);
    });

    DOL.forEach(function (d) {
      S.cargar(d.key, 400).then(function (s) { dol.s[d.id] = s; }, function () { dol.err[d.id] = true; }).then(programarDol);
    });
    S.cotizacionesDolar().then(function (c) { dol.cot = c; }, function () { /* sin precio en vivo: queda el cierre */ }).then(programarDol);
    S.cargar("infIA", 30).then(function (s) { dol.inf = s; }, function () { dol.inf = null; }).then(programarDol);
    pintarDol();
  }

  function programarDol() { if (dol.pend) return; dol.pend = setTimeout(function () { dol.pend = null; pintarDol(); }, 60); }

  function pintarDol(soloSel) {
    var D = dol.dom; if (!D) return;
    var info = {}; DOL.forEach(function (d) { info[d.id] = dolInfo(d); });

    // titular y bajada
    var of = info.oficial, ia = dol.inf && dol.inf.ultimo ? dol.inf : null;
    var h1 = $("h-dolares"), sub = $("dol-sub"), eb = $("dol-eyebrow"), fu = $("dol-fuente");
    if (eb) eb.textContent = "Indicadores · Dólares · " + hoyLargo();
    if (h1 && of && of.y1 !== null) {
      var t = "En un año el dólar oficial " + (of.y1 >= 0 ? "subió " : "bajó ") + nf(Math.abs(of.y1), 0) + "%.";
      if (ia) t += " Los precios, " + nf(ia.ultimo.v, 0) + "%.";
      h1.textContent = t;
    } else if (h1 && of) h1.textContent = "El dólar oficial está a " + pesos(of.v) + ".";
    if (sub) {
      var partes = [];
      if (of && of.y1 !== null && ia) {
        var dif = of.y1 - ia.ultimo.v;
        partes.push(dif < -1 ? "Medido en lo que se puede comprar con él, hoy el dólar oficial está más barato que hace un año."
          : dif > 1 ? "Medido en lo que se puede comprar con él, hoy el dólar oficial está más caro que hace un año."
          : "Subió más o menos lo mismo que los precios.");
      }
      if (of && of.m30 !== null) partes.push(of.m30 > 1.5 ? "En los últimos 30 días subió " + nf(of.m30, 1) + "%." : of.m30 < -1.5 ? "En los últimos 30 días bajó " + nf(Math.abs(of.m30), 1) + "%." : "En los últimos 30 días casi no se movió (" + conSigno(of.m30, 1) + ").");
      sub.textContent = partes.join(" ");
    }
    if (fu) {
      var f = [];
      f.push(dol.cot ? "Precios de venta: DolarAPI" + (of && of.vivo ? ", consultado a las " + hora(of.vivo.fecha) : "") : "Precios de venta: último cierre de ArgentinaDatos (no respondió DolarAPI)");
      f.push("histórico: ArgentinaDatos");
      if (ia) f.push("inflación: INDEC, 12 meses a " + mesAnio(ia.ultimo.d) + " (último dato publicado)");
      fu.textContent = f.join(" · ") + ".";
    }

    // selector de dolares
    if (!soloSel) {
      D.picks.textContent = "";
      DOL.forEach(function (d) {
        var i = info[d.id], b = boton("", "dp__b"); b.setAttribute("aria-pressed", d.id === dol.k ? "true" : "false");
        b.appendChild(el("span", "dp__n", d.nombre));
        b.appendChild(el("span", "dp__v", i ? pesos(i.v) : dol.err[d.id] ? "sin dato" : "…"));
        var ch = el("span", "dp__c"); if (i) ch.appendChild(chip(i.hoy, i.hoy === null ? "" : conSigno(i.hoy, 1), " hoy")); b.appendChild(ch);
        b.setAttribute("aria-label", "Dólar " + d.corto + (i ? ", " + pesos(i.v) + (i.hoy !== null ? ", " + (i.hoy >= 0 ? "sube " : "baja ") + nf(Math.abs(i.hoy), 1) + "% hoy" : "") : ", sin dato"));
        b.addEventListener("click", function () {
          if (d.id === dol.k) return;
          var antes = info[dol.k] ? info[dol.k].v : null, nuevo = info[d.id];
          dol.k = d.id;
          if (nuevo) { dol.mostrado = d.id; contar(D.big, antes, nuevo.v, pesos); }
          pintarDol(true);
          anunciar("Dólar " + d.corto);
        });
        D.picks.appendChild(b);
      });
    } else {
      [].forEach.call(D.picks.children, function (b, j) { b.setAttribute("aria-pressed", DOL[j].id === dol.k ? "true" : "false"); });
    }

    // tarjeta del dolar elegido
    var d = dolDef(dol.k), i = info[dol.k];
    var per = PER_DOL.filter(function (p) { return p[0] === dol.per; })[0];
    D.tit.textContent = "Dólar " + d.corto + " · " + per[3];
    if (!i) {
      D.big.textContent = dol.err[d.id] ? "sin dato" : "…";
      D.nota.textContent = dol.err[d.id] ? "No pudimos traer este dólar. Probá de nuevo más tarde." : "Cargando…";
      D.cambios.textContent = ""; D.graf.textContent = ""; D.ejes.textContent = ""; D.stats.textContent = "";
      D.svg = null;
    } else {
      // la primera vez el numero cuenta desde cero; despues solo se actualiza si no esta contando
      if (dol.mostrado === null) { dol.mostrado = d.id; contar(D.big, 0, i.v, pesos); }
      else if (!D.big.__anim) D.big.textContent = pesos(i.v);
      D.nota.textContent = i.vivo ? "Precio de venta · DolarAPI, actualizado " + hora(i.vivo.fecha) : "Precio de venta · cierre del " + diaMes(i.fecha) + " (" + i.fuente + ")";
      D.cambios.textContent = "";
      [["Hoy", i.hoy, [0.25, 1, 3]], ["30 días", i.m30, [0.5, 2, 6]], ["12 meses", i.y1, [3, 10, 30]]].forEach(function (x) {
        var w = el("div"); w.appendChild(el("dt", "", x[0]));
        var dd = el("dd"); var c = chip(x[1], x[1] === null ? "" : conSigno(x[1], 1)); c.classList.add("hchip--xl"); dd.appendChild(c); w.appendChild(dd);
        D.cambios.appendChild(w);
      });

      var corte = new Date(fecha(i.fecha).getTime() - per[2] * 86400000).toISOString().slice(0, 10);
      var pts = i.pts.filter(function (p) { return p[0] >= corte; }); if (pts.length < 2) pts = i.pts.slice(-2);
      var etq = function (f, ult) { return ult && f === hoyISO() ? "hoy" : dol.per === "1a" ? diaMesAnio(f) : diaMes(f); };
      D.svg = grafico(D.graf, pts, { fmt: pesos, etiqueta: etq,
        aria: "Dólar " + d.corto + ": de " + pesos(pts[0][1]) + " el " + diaMes(pts[0][0]) + " a " + pesos(pts[pts.length - 1][1]) + " el " + diaMes(pts[pts.length - 1][0]) });
      D.ejes.textContent = ""; D.ejes.appendChild(el("span", "", etq(pts[0][0]))); D.ejes.appendChild(el("span", "", etq(pts[pts.length - 1][0], true)));
      var vals = pts.map(function (p) { return p[1]; }), prom = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      D.stats.textContent = "";
      [["Promedio del período", pesos(prom)], ["Hoy contra el promedio", conSigno((i.v / prom - 1) * 100, 1), "dg__vs"], ["Mínimo", pesos(Math.min.apply(null, vals))], ["Máximo", pesos(Math.max.apply(null, vals))]].forEach(function (x) {
        var w = el("div"); w.appendChild(el("dt", "", x[0])); w.appendChild(el("dd", x[2] || "", x[1])); D.stats.appendChild(w);
      });
    }

    // periodos
    D.pers.textContent = "";
    PER_DOL.forEach(function (p) {
      var b = boton(p[1], "seg"); b.setAttribute("aria-pressed", p[0] === dol.per ? "true" : "false");
      b.addEventListener("click", function () { if (dol.per === p[0]) return; dol.per = p[0]; pintarDol(true); var x = D.pers.querySelector('[aria-pressed="true"]'); if (x) x.focus(); anunciar("Gráfico: " + p[3]); });
      D.pers.appendChild(b);
    });

    // que es
    var g = glosa(d.id);
    D.que.textContent = "";
    var hq = el("h2", "sp-card__tit", "¿Qué es el dólar " + d.corto + "?"); hq.id = "dq-tit"; D.que.appendChild(hq);
    if (g) {
      D.que.appendChild(el("p", "sp-que__p", g.q));
      var pl = el("p", "sp-que__s"); pl.appendChild(el("strong", "", "Cómo leerlo: ")); pl.appendChild(document.createTextNode(g.l)); D.que.appendChild(pl);
      if (g.o) { var po = el("p", "sp-que__s"); po.appendChild(el("strong", "", "Ojo: ")); po.appendChild(document.createTextNode(g.o)); D.que.appendChild(po); }
    }
    var lk = el("a", "link sp-que__ir", "Ver la ficha completa, con tabla y fuente →"); lk.href = "#dolares:" + d.id; D.que.appendChild(lk);

    // brecha
    D.brecha.textContent = "";
    var hb = el("h2", "sp-card__tit", "¿Cuánto más caro que el oficial?"); hb.id = "db-tit"; D.brecha.appendChild(hb);
    D.brecha.appendChild(el("p", "sp-card__bajada", "La brecha: cuánto más cuesta cada dólar comparado con el oficial, con los precios de venta de ahora."));
    if (!of) D.brecha.appendChild(el("p", "hint", dol.err.oficial ? "Sin el dólar oficial no se puede calcular." : "Cargando…"));
    else {
      var filas = DOL.filter(function (x) { return x.id !== "oficial"; }).map(function (x) { var ii = info[x.id]; return { n: x.nombre, b: ii ? (ii.v / of.v - 1) * 100 : null }; });
      var tope = Math.max.apply(null, filas.map(function (f) { return f.b === null ? 0 : Math.abs(f.b); }).concat([1]));
      var ul = el("ul", "db__lista");
      filas.forEach(function (f, j) {
        var li = el("li", "db__fila");
        li.appendChild(el("span", "db__n", f.n));
        var pista = el("span", "db__pista"); pista.setAttribute("aria-hidden", "true");
        var barra = el("span", "db__barra"); barra.style.width = (f.b === null ? 0 : Math.max(Math.abs(f.b) / tope * 100, 1.5)) + "%"; barra.style.animationDelay = (j * 120) + "ms";
        pista.appendChild(barra); li.appendChild(pista);
        li.appendChild(el("span", "db__v", f.b === null ? "sin dato" : conSigno(f.b, 1)));
        ul.appendChild(li);
      });
      D.brecha.appendChild(ul);
    }
  }

  /* ================= INFLACIÓN ================= */

  var inf = { s: {}, err: {}, dom: null, pend: null, sel: null };
  var INF_KEYS = [["infM", 40], ["infIA", 40], ["salarios", 40], ["haberMin", 40], ["dOficial", 400], ["reservas", 400]];

  function armarInflacion() {
    var cuerpo = $("inf-cuerpo"); if (!cuerpo || inf.dom) return;
    var D = inf.dom = {};
    D.stats = el("div", "is"); cuerpo.appendChild(D.stats);

    var meses = el("section", "sp-card ib"); meses.setAttribute("aria-labelledby", "ib-tit");
    var cab = el("div", "ib__cab"), ct = el("div");
    var h = el("h2", "sp-card__tit sp-card__tit--xl", "Mes a mes, los últimos dos años"); h.id = "ib-tit"; ct.appendChild(h);
    ct.appendChild(el("p", "sp-card__bajada", "Pasá el mouse, tocá una barra o usá las flechas para ver cada mes."));
    cab.appendChild(ct);
    D.lect = el("div", "ib__lect"); D.lect.setAttribute("aria-live", "polite");
    cab.appendChild(D.lect);
    meses.appendChild(cab);
    D.barras = el("div", "ib__barras"); D.barras.tabIndex = 0; meses.appendChild(D.barras);
    D.ejes = el("div", "gl__ejes"); meses.appendChild(D.ejes);
    D.ley = el("p", "ib__ley"); meses.appendChild(D.ley);
    cuerpo.appendChild(meses);

    var f1 = el("div", "sp-fila");
    D.carrera = el("section", "sp-card ic"); D.carrera.setAttribute("aria-labelledby", "ic-tit"); f1.appendChild(D.carrera);
    D.que = el("section", "sp-card sp-que"); D.que.setAttribute("aria-labelledby", "iq-tit"); f1.appendChild(D.que);
    cuerpo.appendChild(f1);
    var f2 = el("div", "sp-fila");
    D.res = el("section", "sp-card ir"); D.res.setAttribute("aria-labelledby", "ir-tit"); f2.appendChild(D.res);
    D.prox = el("section", "sp-card ip"); D.prox.setAttribute("aria-labelledby", "ip-tit"); f2.appendChild(D.prox);
    cuerpo.appendChild(f2);

    INF_KEYS.forEach(function (k) {
      S.cargar(k[0], k[1]).then(function (s) { inf.s[k[0]] = s; }, function () { inf.err[k[0]] = true; }).then(programarInf);
    });
    pintarInf();
  }

  function programarInf() { if (inf.pend) return; inf.pend = setTimeout(function () { inf.pend = null; pintarInf(); }, 60); }

  function sinDato(caja, key, txt) { caja.appendChild(el("p", "hint", inf.err[key] ? "No pudimos traer " + txt + ". Probá de nuevo más tarde." : "Cargando…")); }

  // cuanto subio una serie mensual en 12 meses y contra que inflacion del mismo mes se compara
  function anual(key) {
    var s = inf.s[key]; if (!s || !s.points.length) return null;
    var u = s.points[s.points.length - 1], h = mismoMesAnterior(s.points, u[0]);
    if (!h || !h[1]) return null;
    var y = (u[1] / h[1] - 1) * 100, ia = inf.s.infIA ? delMes(inf.s.infIA.points, u[0]) : null;
    return { y: y, d: u[0], ia: ia ? ia[1] : null, real: ia ? ((1 + y / 100) / (1 + ia[1] / 100) - 1) * 100 : null };
  }

  function pintarInf() {
    var D = inf.dom; if (!D) return;
    var m = inf.s.infM, ia = inf.s.infIA;
    var h1 = $("h-inflacion"), sub = $("inf-sub"), eb = $("inf-eyebrow"), fu = $("inf-fuente");

    // titular
    if (m && m.points.length > 1) {
      var u = m.ultimo, c = u.v;
      if (eb) eb.textContent = "Indicadores · Inflación · dato de " + mesAnio(u.d) + ", publicado por el INDEC";
      if (h1) {
        h1.textContent = "";
        h1.appendChild(document.createTextNode("Los precios " + (c >= 0 ? "subieron " : "bajaron ")));
        h1.appendChild(el("span", "sp__acento", nf(Math.abs(c), 1) + "%"));
        h1.appendChild(document.createTextNode(" en " + mesNom(u.d) + "."));
      }
      if (fu) fu.textContent = "Fuente: " + (m.fuente || "INDEC") + ". El INDEC publica cada mes el índice de precios al consumidor (IPC) del mes anterior.";
    } else if (inf.err.infM && h1) {
      h1.textContent = "Inflación y reservas";
      if (sub) sub.textContent = "No pudimos traer el último dato de inflación. Abajo están todos los indicadores de la sección.";
    }
    if (sub && ia && ia.ultimo) {
      var ant = 10000, hoy = Math.round(ant * (1 + ia.ultimo.v / 100) / 10) * 10;
      sub.textContent = "En doce meses " + (ia.ultimo.v >= 0 ? "subieron " : "bajaron ") + nf(Math.abs(ia.ultimo.v), 1) + "%: lo que hace un año costaba " + pesos(ant) + ", hoy cuesta, en promedio, " + pesos(hoy) + ".";
    }

    // cuatro numeros
    D.stats.textContent = "";
    function stat(lab, val, chp, nota, j) {
      var c = el("div", "sp-card is__c"); c.style.animationDelay = (j * 80) + "ms";
      c.appendChild(el("p", "is__l", lab)); c.appendChild(el("p", "is__v", val));
      var p = el("p", "is__n"); if (chp) p.appendChild(chp); if (nota) p.appendChild(el("span", "", nota)); c.appendChild(p);
      D.stats.appendChild(c);
    }
    if (m && m.points.length > 1) {
      var cm = m.ultimo.v, pm = m.points[m.points.length - 2];
      stat(mayus(mesNom(m.ultimo.d)), nf(cm, 1) + "%", chip(cm - pm[1], conSigno(cm - pm[1], 1, " pp"), "", [0.1, 0.3, 0.6]), "contra " + mesNom(pm[0]) + " (" + nf(pm[1], 1) + "%)", 0);
    } else stat("Último mes", inf.err.infM ? "sin dato" : "…", null, "", 0);
    if (ia && ia.ultimo) {
      var a12 = mismoMesAnterior(ia.points, ia.ultimo.d);
      stat("Últimos 12 meses", nf(ia.ultimo.v, 1) + "%", a12 ? chip(ia.ultimo.v - a12[1], conSigno(ia.ultimo.v - a12[1], 1, " pp"), "", [1, 5, 15]) : null, a12 ? "contra un año antes (" + nf(a12[1], 1) + "%)" : "", 1);
    } else stat("Últimos 12 meses", inf.err.infIA ? "sin dato" : "…", null, "", 1);
    if (m && m.ultimo) {
      var r = m.ultimo.v / 100, anualiz = (Math.pow(1 + r, 12) - 1) * 100;
      stat("Si sigue a este ritmo", nf(anualiz, 1) + "%", null, "por año, si cada mes suben " + nf(m.ultimo.v, 1) + "%", 2);
      if (r > 0) {
        var mesesDup = Math.log(2) / Math.log(1 + r), txt = mesesDup < 24 ? Math.round(mesesDup) + " meses" : nf(Math.round(mesesDup / 12 * 2) / 2, Math.round(mesesDup / 6) % 2 ? 1 : 0) + " años";
        stat("Los precios se duplican en", txt, null, "si cada mes suben " + nf(m.ultimo.v, 1) + "%", 3);
      } else stat("Los precios se duplican en", "no aplica", null, "este mes los precios no subieron", 3);
    }

    pintarBarras();
    pintarCarrera();
    pintarQueEs();
    pintarReservas();
    pintarProximo();
  }

  function pintarBarras() {
    var D = inf.dom, m = inf.s.infM;
    D.barras.textContent = ""; D.ejes.textContent = ""; D.ley.textContent = ""; D.lect.textContent = "";
    if (!m || m.points.length < 3) { sinDato(D.barras, "infM", "la inflación mensual"); return; }
    var pts = m.points.slice(-24), n = pts.length;
    var mx = Math.max.apply(null, pts.map(function (p) { return p[1]; }).concat([0.5]));
    var pico = 0; pts.forEach(function (p, i) { if (p[1] > pts[pico][1]) pico = i; });
    D.barras.setAttribute("role", "slider");
    D.barras.setAttribute("aria-label", "Inflación mensual de " + mesAnio(pts[0][0]) + " a " + mesAnio(pts[n - 1][0]) + ". Usá las flechas para recorrer.");
    D.barras.setAttribute("aria-valuemin", "0"); D.barras.setAttribute("aria-valuemax", String(n - 1));
    var barras = pts.map(function (p, i) {
      var b = el("span", "ib__b" + (i === n - 1 ? " ib__b--ult" : i === pico ? " ib__b--pico" : ""));
      b.style.height = Math.max(0, p[1] / mx * 100).toFixed(1) + "%"; b.style.animationDelay = (i * 30) + "ms";
      b.addEventListener("pointerenter", function () { elegir(i); });
      b.addEventListener("pointerdown", function () { elegir(i); });
      D.barras.appendChild(b); return b;
    });
    var lm = el("p", "ib__mes"), lv = el("p", "ib__val"); D.lect.appendChild(lm); D.lect.appendChild(lv);
    function elegir(i, desdeTeclado) {
      inf.sel = i;
      D.barras.classList.add("eligiendo");
      barras.forEach(function (b, j) { b.classList.toggle("ib__b--sel", j === i); });
      lm.textContent = mayus(mesAnio(pts[i][0])); lv.textContent = nf(pts[i][1], 1) + "%";
      D.barras.setAttribute("aria-valuenow", String(i));
      D.barras.setAttribute("aria-valuetext", mesAnio(pts[i][0]) + ": " + nf(pts[i][1], 1) + "%");
    }
    function soltar() { inf.sel = null; D.barras.classList.remove("eligiendo"); barras.forEach(function (b) { b.classList.remove("ib__b--sel"); }); lm.textContent = mayus(mesAnio(pts[n - 1][0])); lv.textContent = nf(pts[n - 1][1], 1) + "%"; D.barras.setAttribute("aria-valuenow", String(n - 1)); D.barras.setAttribute("aria-valuetext", mesAnio(pts[n - 1][0]) + ": " + nf(pts[n - 1][1], 1) + "%"); }
    soltar();
    D.barras.onpointerleave = soltar;
    D.barras.onblur = soltar;
    D.barras.onkeydown = function (ev) {
      var c = inf.sel === null ? n - 1 : inf.sel, k = ev.key;
      if (k === "ArrowLeft" || k === "ArrowDown") { ev.preventDefault(); elegir(Math.max(0, c - 1), true); }
      else if (k === "ArrowRight" || k === "ArrowUp") { ev.preventDefault(); elegir(Math.min(n - 1, c + 1), true); }
      else if (k === "Home") { ev.preventDefault(); elegir(0, true); }
      else if (k === "End") { ev.preventDefault(); elegir(n - 1, true); }
      else if (k === "Escape") soltar();
    };
    D.ejes.appendChild(el("span", "", MESES_C[fecha(pts[0][0]).getMonth()] + " " + fecha(pts[0][0]).getFullYear()));
    D.ejes.appendChild(el("span", "", MESES_C[fecha(pts[Math.floor(n / 2)][0]).getMonth()] + " " + fecha(pts[Math.floor(n / 2)][0]).getFullYear()));
    D.ejes.appendChild(el("span", "", MESES_C[fecha(pts[n - 1][0]).getMonth()] + " " + fecha(pts[n - 1][0]).getFullYear()));
    if (pico !== n - 1) {
      D.ley.appendChild(el("i", "ib__sw ib__sw--pico"));
      D.ley.appendChild(document.createTextNode("El pico fue en " + mesAnio(pts[pico][0]) + " (" + nf(pts[pico][1], 1) + "%). "));
    }
    D.ley.appendChild(el("i", "ib__sw ib__sw--ult"));
    D.ley.appendChild(document.createTextNode(mayus(mesAnio(pts[n - 1][0])) + ": " + nf(pts[n - 1][1], 1) + "%." + (pico === n - 1 ? " Es el más alto de los últimos dos años." : "")));
  }

  function pintarCarrera() {
    var D = inf.dom, caja = D.carrera; caja.textContent = "";
    var h = el("h2", "sp-card__tit", "¿Quién le gana a los precios?"); h.id = "ic-tit"; caja.appendChild(h);
    caja.appendChild(el("p", "sp-card__bajada", "Cuánto subió cada cosa en doce meses, hasta su último dato publicado."));
    var ia = inf.s.infIA;
    if (!ia || !ia.ultimo) { sinDato(caja, "infIA", "la inflación de 12 meses"); return; }
    var filas = [{ n: "Precios", cuando: mesNom(ia.ultimo.d), v: ia.ultimo.v, c: "var(--sun)" }];
    var hab = anual("haberMin"), sal = anual("salarios");
    if (hab) filas.push({ n: "Jubilación mínima", cuando: mesNom(hab.d), v: hab.y, c: "var(--text-2)", real: hab.real, ia: hab.ia });
    if (sal) filas.push({ n: "Sueldos registrados", cuando: mesNom(sal.d), v: sal.y, c: "var(--violet)", real: sal.real, ia: sal.ia });
    var of = inf.s.dOficial;
    if (of && of.points.length > 2) {
      var u = of.points[of.points.length - 1], h365 = antesDe(of.points, u[0], 365);
      if (h365 && h365[0] < u[0]) filas.push({ n: "Dólar oficial", cuando: mesNom(u[0]) + " (al " + fecha(u[0]).getDate() + ")", v: (u[1] / h365[1] - 1) * 100, c: "var(--accent)" });
    }
    var tope = Math.max.apply(null, filas.map(function (f) { return Math.abs(f.v); }).concat([1]));
    var ul = el("ul", "ic__lista");
    filas.forEach(function (f, j) {
      var li = el("li", "ic__fila");
      var nom = el("span", "ic__n"); nom.appendChild(el("strong", "", f.n)); nom.appendChild(el("span", "", f.cuando)); li.appendChild(nom);
      var pista = el("span", "db__pista"); pista.setAttribute("aria-hidden", "true");
      var b = el("span", "db__barra"); b.style.width = Math.max(0, f.v / tope * 100).toFixed(1) + "%"; b.style.background = f.c; b.style.animationDelay = (300 + j * 120) + "ms";
      pista.appendChild(b); li.appendChild(pista);
      li.appendChild(el("span", "db__v", conSigno(f.v, 1)));
      ul.appendChild(li);
    });
    caja.appendChild(ul);
    var frases = [];
    [["Los sueldos registrados", sal], ["La jubilación mínima", hab]].forEach(function (x) {
      var r = x[1]; if (!r || r.real === null) return;
      var cuando = " (comparado con la inflación de 12 meses a " + mesNom(r.d) + ", " + nf(r.ia, 1) + "%)";
      frases.push(Math.abs(r.real) < 1 ? x[0] + " le empataron a los precios" + cuando + "." : x[0] + (r.real > 0 ? " quedaron " + nf(r.real, 1) + "% arriba" : " quedaron " + nf(Math.abs(r.real), 1) + "% abajo") + " de los precios" + cuando + ".");
    });
    if (frases.length) caja.appendChild(el("p", "ic__frase", frases.join(" ").replace("La jubilación mínima le empataron", "La jubilación mínima le empató").replace("La jubilación mínima quedaron", "La jubilación mínima quedó")));
    caja.appendChild(el("p", "sp-card__nota", "Fuentes: INDEC (precios y salarios), ANSES (haber mínimo), ArgentinaDatos (dólar). Son promedios: a cada persona le puede ir distinto."));
  }

  function pintarQueEs() {
    var caja = inf.dom.que; if (caja.childNodes.length) return;
    var h = el("h2", "sp-card__tit", "¿Qué es la inflación?"); h.id = "iq-tit"; caja.appendChild(h);
    var g = glosa("infM");
    caja.appendChild(el("p", "sp-que__p", "Es cuánto suben, en promedio, los precios de lo que compra un hogar: comida, alquiler, transporte, ropa, salud."));
    if (g) {
      var pc = el("p", "sp-que__s"); pc.appendChild(el("strong", "", "Cómo se mide: ")); pc.appendChild(document.createTextNode(g.c)); caja.appendChild(pc);
      if (g.o) { var po = el("p", "sp-que__s"); po.appendChild(el("strong", "", "Ojo: ")); po.appendChild(document.createTextNode(g.o)); caja.appendChild(po); }
    }
    if (!g || !g.o) { var po2 = el("p", "sp-que__s"); po2.appendChild(el("strong", "", "Ojo: ")); po2.appendChild(document.createTextNode("es un promedio. Si gastás mucho en alquiler o en remedios, tu inflación puede ser otra.")); caja.appendChild(po2); }
    var a = el("a", "link sp-que__ir", "Calculá tu inflación personal →"); a.href = "#miplata"; caja.appendChild(a);
  }

  var LECT = { bien: ["✓", "Buena señal"], mal: ["!", "Señal de alerta"], mixto: ["⇄", "Mixto"], neutro: ["=", "Neutral"] };

  function pintarReservas() {
    var caja = inf.dom.res; caja.textContent = "";
    var s = inf.s.reservas;
    var cab = el("div", "ir__cab");
    var h = el("h2", "sp-card__tit", "Reservas del Banco Central"); h.id = "ir-tit"; cab.appendChild(h);
    caja.appendChild(cab);
    if (!s || s.points.length < 3) { sinDato(caja, "reservas", "las reservas"); return; }
    var L = window.EconoLectura, lec = L ? L.leer("reservas", { reservas: { ok: true, s: s } }) : null;
    if (lec && LECT[lec.v]) {
      var t = el("span", "lect lect--" + lec.v); t.appendChild(el("span", "lect__icono", LECT[lec.v][0])); t.appendChild(document.createTextNode(" " + LECT[lec.v][1]));
      cab.appendChild(t);
      caja.classList.add("ir--" + lec.v);
    }
    var u = s.points[s.points.length - 1], p = s.points[s.points.length - 2], h365 = antesDe(s.points, u[0], 365);
    caja.appendChild(el("p", "ir__v", "US$ " + nf(u[1], 0) + " M"));
    var det = diaMes(u[0]) + " · " + conSigno(u[1] - p[1], 0, " M") + " en el día";
    if (h365 && h365[0] < u[0]) det += " · " + conSigno(u[1] - h365[1], 0, " M") + " en un año";
    caja.appendChild(el("p", "ir__d", det));
    if (lec) caja.appendChild(el("p", "ir__t", lec.t));
    var pts = s.points.slice(-90), vals = pts.map(function (x) { return x[1]; }), mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = (mx - mn) || 1;
    var d = pts.map(function (x, i) { return (i ? "L" : "M") + (i * 300 / (pts.length - 1)).toFixed(1) + " " + (50 - (x[1] - mn) / rg * 42).toFixed(1); }).join(" ");
    var g = sv("svg", { viewBox: "0 0 300 56", preserveAspectRatio: "none", "aria-hidden": "true", "class": "ir__spk" });
    g.appendChild(sv("path", { d: d + " L300 56 L0 56 Z", "class": "ir__ar" }));
    var ln = sv("path", { d: d, pathLength: "1", "class": "ir__ln", "vector-effect": "non-scaling-stroke" });
    ln.addEventListener("animationend", function () { ln.style.strokeDasharray = "none"; });
    g.appendChild(ln);
    caja.appendChild(el("p", "sp-card__nota ir__nota", "Fuente: " + (s.fuente || "BCRA") + ". Son reservas brutas: incluyen dólares que el Banco Central debe devolver. La señal es una regla simple (subieron o bajaron más de 1% en 30 días), no una opinión."));
    caja.appendChild(g);
  }

  function pintarProximo() {
    var caja = inf.dom.prox; caja.textContent = "";
    var h = el("h2", "sp-card__tit", "Próximo dato"); h.id = "ip-tit"; caja.appendChild(h);
    var m = inf.s.infM;
    if (!m || !m.ultimo) { sinDato(caja, "infM", "el último dato publicado"); return; }
    var d = fecha(m.ultimo.d); d.setMonth(d.getMonth() + 1);
    caja.appendChild(el("p", "ip__mes", "Inflación de " + MESES_L[d.getMonth()]));
    caja.appendChild(el("p", "ip__t", "La publica el INDEC el mes siguiente. La fecha exacta está en su calendario de difusión; acá la vas a ver cuando salga."));
    var a = el("a", "btn ip__btn", "Ver el calendario del INDEC"); a.href = "https://www.indec.gob.ar/indec/web/Calendario-Fecha-0"; a.target = "_blank"; a.rel = "noopener noreferrer";
    caja.appendChild(a);
  }

  /* ---------- API ---------- */

  // se llama desde el router: arma la portada la primera vez y la esconde en celular cuando hay una ficha abierta
  function mostrar(vista, sub) {
    var sec = $("vista-" + vista); if (!sec) return;
    if (vista === "dolares") armarDolares();
    else if (vista === "inflacion") armarInflacion();
    else return;
    sec.classList.toggle("con-ficha", !!sub);
    if (sub && !window.matchMedia("(max-width: 820px)").matches) {
      var mesa = $("mesa-" + vista);
      if (mesa && mesa.getBoundingClientRect().top > window.innerHeight * 0.6) mesa.scrollIntoView({ block: "start", behavior: REDUCE ? "auto" : "smooth" });
    }
  }

  window.EconoSecciones = { mostrar: mostrar };
})();
