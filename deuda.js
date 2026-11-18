/*
 * Deuda del Tesoro y del Banco Central con terceros, y la suma de los dos.
 * Tesoro: deuda bruta menos la parte en manos del propio Estado (BCRA, FGS de la ANSES, Banco Nación y otros).
 * BCRA: su deuda en títulos (BOPREAL, LEBAC, LEDIV y letras en pesos) y pases pasivos.
 * Datos: data/deuda.json (scripts/build_deuda.py: Secretaría de Finanzas y API de estadísticas del BCRA).
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
  // miles de millones con un decimal: 276985 → "277,0"
  function mm(v) { return (v / 1000).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function coma(v, d) { return v.toLocaleString("es-AR", { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }); }
  function pct(s) { return parseFloat(String(s).replace("%", "").replace(",", ".")); }
  function tes(p) { return p.privado + p.multi; }
  function bc(p) { return p.bcra ? p.bcra.total : 0; }
  function fechaLarga(f) { return Number(f.slice(8, 10)) + " de " + MES_L[Number(f.slice(5, 7)) - 1] + " de " + f.slice(0, 4); }
  function fechaCorta(f) { return TRIM[f.slice(5, 7)] + " " + f.slice(2, 4); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, txt) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (txt != null) e.textContent = txt;
    return e;
  }

  // dos líneas: Tesoro + BCRA (llena) y solo Tesoro (punteada). El ancho es el de la caja, para que la letra no cambie de tamaño.
  function lineas(pts, ancho) {
    var W = Math.max(300, Math.round(ancho || 560)), H = 210, x0 = 14, x1 = W - 14, y0 = 40, y1 = 162;
    var st = pts.map(tes), ss = pts.map(function (p) { return tes(p) + bc(p); });
    var lo = Math.floor(Math.min.apply(null, st) * 0.95 / 10000) * 10000, hi = Math.ceil(Math.max.apply(null, ss) * 1.03 / 10000) * 10000;
    function X(i) { return x0 + (x1 - x0) * i / (pts.length - 1); }
    function Y(v) { return y1 - (y1 - y0) * (v - lo) / (hi - lo); }
    function path(v) { return v.map(function (x, i) { return (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(x).toFixed(1); }).join(" "); }
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img",
      "aria-label": "Deuda del Tesoro y el BCRA sumados, de " + fechaLarga(pts[0].fecha) + " a " + fechaLarga(pts[pts.length - 1].fecha) + ": de " + m(ss[0]) + " a " + m(ss[ss.length - 1]) + " millones de dólares" });
    svg.appendChild(s("line", { x1: x0, x2: x1, y1: y1, y2: y1, "class": "deuda__base" }));
    svg.appendChild(s("path", { d: path(st), "class": "deuda__lt" }));
    svg.appendChild(s("path", { d: path(ss), "class": "deuda__ln" }));
    var angosto = W < 460;
    pts.forEach(function (p, i) {
      var ult = i === pts.length - 1;
      if (!angosto || i % 2 === 0 || ult) svg.appendChild(s("text", { x: X(i), y: H - 14, "text-anchor": i === 0 ? "start" : ult ? "end" : "middle", "class": "deuda__lab" }, fechaCorta(p.fecha)));
      svg.appendChild(s("circle", { cx: X(i), cy: Y(ss[i]), r: i === 0 || ult ? 5 : 3, "class": "deuda__pt" + (ult ? " deuda__pt--fin" : "") }));
    });
    svg.appendChild(s("text", { x: X(0), y: Y(ss[0]) - 14, "class": "deuda__an" }, mm(ss[0])));
    svg.appendChild(s("text", { x: X(pts.length - 1), y: Y(ss[ss.length - 1]) - 14, "text-anchor": "end", "class": "deuda__an" }, mm(ss[ss.length - 1])));
    svg.appendChild(s("text", { x: X(0), y: Y(st[0]) + 20, "class": "deuda__lab" }, "solo Tesoro"));
    return svg;
  }

  function html(d) {
    var pts = d.puntos, u = pts[pts.length - 1], p0 = pts[0];
    var T = tes(u), Bc = bc(u), Su = T + Bc, T0 = tes(p0), B0 = bc(p0), S0 = T0 + B0;
    var pbiT = pct(u.pbi.privado) + pct(u.pbi.multi);
    var PBI = u.total / (pct(u.pbi.total) / 100);           // el PBI que usa el informe de Finanzas
    var pbiB = Bc / PBI * 100, pbiS = pbiT + pbiB;
    var tot = u.total, wPr = u.privado / tot * 100, wMu = u.multi / tot * 100, wAg = u.agencias / tot * 100;
    var org = [], o = d.organismos || {}, resto = u.multi;
    ["FMI", "BID", "Banco Mundial", "CAF"].forEach(function (n) { if (o[n]) { org.push([n, o[n]]); resto -= o[n]; } });
    if (org.length) org.push(["Otros", resto]);
    var maxO = org.length ? org[0][1] : 1;
    var orgs = org.map(function (x) { return '<div class="deuda__org"><span>' + esc(x[0]) + '</span><span class="deuda__ob"><i style="width:' + (x[1] / maxO * 100).toFixed(1) + '%"></i></span><b>' + mm(x[1]) + "</b></div>"; }).join("");
    var sube = (Su / S0 - 1) * 100;
    var bcTxt = u.bcra ? "US$ " + mm(u.bcra.titulos) + " mil M en BOPREAL, LEBAC y LEDIV, y US$ " + coma(u.bcra.letras_pesos / 1000, 2) + " mil M en letras en pesos" + (u.bcra.pases ? ", más US$ " + coma(u.bcra.pases / 1000, 2) + " mil M en pases" : "") : "sin dato";
    return '' +
      '<div><h2 class="deuda__tit" id="deuda-tit">¿Cuánto deben el Tesoro y el Banco Central?</h2>' +
      '<p class="deuda__resp">Entre los dos le deben <b>US$ ' + mm(Su) + ' mil millones</b> a privados y a organismos internacionales: el <b>' + coma(pbiS) + '% del PBI</b>.</p>' +
      '<p class="deuda__baj">Al ' + fechaLarga(u.fecha) + ', sin contar lo que el Estado se debe a sí mismo.</p></div>' +

      '<div class="deuda__tres">' +
        '<div class="deuda__t"><p class="deuda__tl">Tesoro nacional</p><p class="deuda__tv">US$ ' + mm(T) + ' mil M</p><p class="deuda__tn">' + coma(pbiT) + '% del PBI · bonos, letras y préstamos</p></div>' +
        '<div class="deuda__op" aria-hidden="true">+</div>' +
        '<div class="deuda__t"><p class="deuda__tl">Banco Central</p><p class="deuda__tv">US$ ' + mm(Bc) + ' mil M</p><p class="deuda__tn">' + coma(pbiB) + '% del PBI · BOPREAL, LEBAC, LEDIV y letras en pesos</p></div>' +
        '<div class="deuda__op" aria-hidden="true">=</div>' +
        '<div class="deuda__t deuda__t--suma"><p class="deuda__tl">Los dos juntos</p><p class="deuda__tv">US$ ' + mm(Su) + ' mil M</p><p class="deuda__tn">' + coma(pbiS) + '% del PBI</p></div>' +
      '</div>' +

      '<div><h3 class="deuda__h">Cómo se llega a la deuda del Tesoro</h3>' +
        '<div class="deuda__llaves" style="grid-template-columns:' + (wPr + wMu).toFixed(2) + 'fr ' + wAg.toFixed(2) + 'fr">' +
          '<div class="deuda__llave deuda__llave--neta"><b>Deuda neta · US$ ' + mm(T) + ' mil M</b><span>Lo que se le debe a terceros</span></div>' +
          '<div class="deuda__llave deuda__llave--estado"><b>− US$ ' + mm(u.agencias) + ' mil M</b><span>Se lo debe a sí mismo: no cuenta</span></div>' +
        '</div>' +
        '<div class="deuda__barra" role="img" aria-label="Deuda bruta del Tesoro de ' + m(tot) + ' millones: ' + m(u.privado) + ' con privados, ' + m(u.multi) + ' con organismos internacionales y ' + m(u.agencias) + ' en manos del propio Estado">' +
          '<span class="deuda__s deuda__s--pr" style="width:' + wPr.toFixed(2) + '%"><b>Privados</b> ' + mm(u.privado) + '</span>' +
          '<span class="deuda__s deuda__s--mu" style="width:' + wMu.toFixed(2) + '%"><b>Organismos</b> ' + mm(u.multi) + '</span>' +
          '<span class="deuda__s deuda__s--ag" style="width:' + wAg.toFixed(2) + '%"><b>BCRA, ANSES, Banco Nación y otros</b> ' + mm(u.agencias) + '</span>' +
        '</div>' +
        '<p class="deuda__cuenta"><span>Deuda total del Tesoro <b>' + mm(tot) + '</b></span><i>−</i><span>la que tiene el propio Estado <b>' + mm(u.agencias) + '</b></span><i>=</i><span class="deuda__res">deuda neta <b>' + mm(T) + '</b></span><em>en miles de millones de dólares</em></p>' +
        '<h3 class="deuda__h deuda__h--sep">Y la del Banco Central</h3>' +
        '<div class="deuda__cmp"><span>Tesoro</span><span class="deuda__cb"><i class="deuda__cb--t" style="width:100%"></i></span><b>' + mm(T) + '</b></div>' +
        '<div class="deuda__cmp"><span>Banco Central</span><span class="deuda__cb"><i class="deuda__cb--b" style="width:' + (Bc / T * 100).toFixed(2) + '%"></i></span><b>' + mm(Bc) + '</b></div>' +
        '<p class="deuda__p">A la misma escala: la deuda del BCRA es el <b>' + coma(Bc / Su * 100) + '%</b> del total. Son ' + bcTxt + '. Los BOPREAL son bonos que el BCRA emitió desde 2024 para que las empresas cobraran deudas por importaciones.</p>' +
      '</div>' +

      '<div class="deuda__dos">' +
        '<div><h3 class="deuda__h">¿A quién le debe el Tesoro?</h3><div class="deuda__quien">' +
          '<div class="deuda__q"><div class="deuda__qp">' + coma(u.privado / T * 100, 0) + '%</div><div><b>Privados · US$ ' + mm(u.privado) + ' mil M</b><p>Quienes tienen bonos y letras del Tesoro. Incluye US$ ' + coma(u.elegible / 1000) + ' mil M que no entraron a los canjes de 2005 y 2010.</p></div></div>' +
          '<div class="deuda__q deuda__q--mu"><div class="deuda__qp">' + coma(u.multi / T * 100, 0) + '%</div><div><b>Organismos internacionales · US$ ' + mm(u.multi) + ' mil M</b>' + (orgs ? '<div class="deuda__orgs">' + orgs + '</div>' : "") + '</div></div>' +
        '</div></div>' +
        '<div><h3 class="deuda__h">¿Cómo viene?</h3>' +
          '<p class="deuda__p">Los dos juntos ' + (sube >= 0 ? "subieron" : "bajaron") + ' <b>' + coma(Math.abs(sube)) + '%</b> desde ' + MES_L[Number(p0.fecha.slice(5, 7)) - 1] + ' de ' + p0.fecha.slice(0, 4) + '. El Tesoro ' + (T >= T0 ? "sumó" : "bajó") + ' US$ ' + mm(Math.abs(T - T0)) + ' mil M y el BCRA ' + (Bc >= B0 ? "subió" : "bajó") + ' US$ ' + mm(Math.abs(Bc - B0)) + ' mil M.</p>' +
          '<div class="deuda__linea"></div>' +
          '<p class="deuda__ley"><span><i class="deuda__ley-s"></i>Tesoro + BCRA</span><span><i class="deuda__ley-t"></i>Solo Tesoro</span><span>en miles de millones de dólares</span></p>' +
        '</div>' +
      '</div>' +

      '<div class="deuda__por"><b>¿Por qué se resta lo que tiene el Estado?</b> El BCRA, el fondo de la ANSES (FGS) y el Banco Nación compraron bonos y letras del Tesoro. Esa deuda queda dentro del propio Estado: no hay que buscar la plata afuera para pagarla. Por eso, al sumar el BCRA, solo se agrega lo que el BCRA le debe a terceros.</div>' +
      '<p class="deuda__fuente">Fuentes: Tesoro, <a href="' + esc(d.url) + '" target="_blank" rel="noopener">Secretaría de Finanzas</a> («Deuda Bruta de la Administración Central por acreedor», informes trimestrales, y planilla del último trimestre, hoja A.2.1). BCRA, API de estadísticas: stock de LEBAC, LEDIV y BOPREAL, letras en pesos y pases pasivos al último día de cada trimestre; las letras en pesos pasan a dólares con el tipo de cambio de referencia del BCRA. El % del PBI del BCRA usa el mismo PBI del informe de Finanzas. Sale una vez por trimestre, con unos tres meses de atraso.</p>' +
      '<p class="deuda__fuente">No incluye: el swap con el Banco Central de China, los préstamos REPO con bancos ni otras obligaciones del balance del BCRA, porque no están como serie en la API; tampoco la deuda de empresas públicas y fondos fiduciarios. La base monetaria no es deuda.</p>';
  }

  function pintar(caja) {
    if (!caja || caja.__deuda) return;
    caja.__deuda = true;
    caja.appendChild(el("p", "hint", "Cargando la deuda…"));
    cargar().then(function (d) {
      caja.textContent = "";
      var card = el("section", "sp-card deuda__card"); card.setAttribute("aria-labelledby", "deuda-tit");
      card.innerHTML = html(d);
      caja.appendChild(card);
      var g = card.querySelector(".deuda__linea");
      if (g) g.appendChild(lineas(d.puntos, g.clientWidth));
    }).catch(function () {
      caja.__deuda = false;
      caja.textContent = "";
      caja.appendChild(el("p", "hint", "No se pudo cargar la deuda. Probá de nuevo en un rato."));
    });
  }

  window.EconoDeuda = {
    pintar: pintar,
    // para la tarjeta del Inicio: Tesoro + BCRA del último trimestre
    ultimo: function () {
      return cargar().then(function (d) {
        var u = d.puntos[d.puntos.length - 1], v = tes(u) + bc(u);
        return { neta: v, fecha: u.fecha, texto: "US$ " + mm(v) + " mil M", corta: fechaCorta(u.fecha) };
      });
    }
  };
})();
