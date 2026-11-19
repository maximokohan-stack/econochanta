/*
 * Deuda del Tesoro y del Banco Central con terceros, y la suma de los dos.
 * Arriba lo principal (la respuesta y Tesoro + BCRA = total); el resto en tarjetas que se abren de a una (tarjetas.js).
 * Datos: data/deuda.json (scripts/build_deuda.py: Secretaría de Finanzas y API del BCRA) y la población del INDEC
 * (data/indec_extra.json).
 */
(function () {
  "use strict";

  var MES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var TRIM = { "03": "mar", "06": "jun", "09": "sep", "12": "dic" };
  var datos = null, pedido = null;

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
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function m(v) { return Math.round(v).toLocaleString("es-AR"); }
  function mm(v) { return (v / 1000).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function coma(v, d) { d = d == null ? 1 : d; return Number(v).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function pct(s) { return parseFloat(String(s).replace("%", "").replace(",", ".")); }
  function tes(p) { return p.privado + p.multi; }
  function bc(p) { return p.bcra ? p.bcra.total : 0; }
  function fechaLarga(f) { return Number(f.slice(8, 10)) + " de " + MES_L[Number(f.slice(5, 7)) - 1] + " de " + f.slice(0, 4); }
  function fechaCorta(f) { return TRIM[f.slice(5, 7)] + " " + f.slice(2, 4); }

  var NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, txt) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; }

  // línea de dos series con etiquetas en las puntas; el ancho es el de la caja para que la letra no cambie de tamaño
  function dosLineas(a, b, etiq, ancho, opc) {
    opc = opc || {};
    var W = Math.max(300, Math.round(ancho || 600)), H = opc.alto || 210, x0 = opc.ejeY ? 44 : 14, x1 = W - 14, y0 = 36, y1 = H - 46;
    var todos = a.concat(b || []), lo = opc.lo != null ? opc.lo : Math.min.apply(null, todos) * 0.95, hi = opc.hi != null ? opc.hi : Math.max.apply(null, todos) * 1.04;
    function X(i) { return x0 + (x1 - x0) * i / (a.length - 1); }
    function Y(v) { return y1 - (y1 - y0) * (v - lo) / (hi - lo); }
    function path(v) { return v.map(function (x, i) { return (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(x).toFixed(1); }).join(" "); }
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": opc.aria || "" });
    if (opc.ejeY) opc.ejeY.forEach(function (v) {
      svg.appendChild(s("line", { x1: x0, x2: x1, y1: Y(v), y2: Y(v), "class": "deuda__base" }));
      svg.appendChild(s("text", { x: x0 - 8, y: Y(v) + 4, "text-anchor": "end", "class": "deuda__lab" }, v + "%"));
    });
    else svg.appendChild(s("line", { x1: x0, x2: x1, y1: y1, y2: y1, "class": "deuda__base" }));
    if (b) svg.appendChild(s("path", { d: path(b), "class": "deuda__lt" }));
    svg.appendChild(s("path", { d: path(a), "class": "deuda__ln" }));
    var paso = Math.max(1, Math.ceil(etiq.length / Math.max(3, Math.floor(W / 90))));
    etiq.forEach(function (t, i) {
      var ult = i === etiq.length - 1;
      if (i % paso === 0 || ult) svg.appendChild(s("text", { x: X(i), y: H - 16, "text-anchor": i === 0 ? "start" : ult ? "end" : "middle", "class": "deuda__lab" }, t));
    });
    (opc.notas || []).forEach(function (n) {
      var v = (n.b ? b : a)[n.i];
      svg.appendChild(s("circle", { cx: X(n.i), cy: Y(v), r: 4, "class": "deuda__pt" + (n.b ? "" : " deuda__pt--fin") }));
      svg.appendChild(s("text", { x: X(n.i) + (n.dx || 0), y: Y(v) + (n.dy || -12), "text-anchor": n.ancla || "middle", "class": "deuda__an" }, n.t));
    });
    return svg;
  }

  function cabecera(d, pob) {
    var pts = d.puntos, u = pts[pts.length - 1];
    var T = tes(u), B = bc(u), S = T + B, PBI = u.total / (pct(u.pbi.total) / 100);
    var pT = pct(u.pbi.privado) + pct(u.pbi.multi), pB = B / PBI * 100, pS = pT + pB;
    return { u: u, T: T, B: B, S: S, pT: pT, pB: pB, pS: pS, PBI: PBI, pob: pob,
      html: '<div><h2 class="deuda__tit" id="deuda-tit">¿Cuánto deben el Tesoro y el Banco Central?</h2>' +
        '<p class="deuda__resp">Entre los dos le deben <b>US$ ' + mm(S) + ' mil millones</b> a privados y a organismos internacionales: el <b>' + coma(pS) + "% del PBI</b>.</p>" +
        '<p class="deuda__baj">Al ' + fechaLarga(u.fecha) + ", sin contar lo que el Estado se debe a sí mismo.</p></div>" +
        '<div class="deuda__tres">' +
        '<div class="deuda__t"><p class="deuda__tl">Tesoro nacional</p><p class="deuda__tv">US$ ' + mm(T) + ' mil M</p><p class="deuda__tn">' + coma(pT) + "% del PBI · bonos, letras y préstamos</p></div>" +
        '<div class="deuda__op" aria-hidden="true">+</div>' +
        '<div class="deuda__t"><p class="deuda__tl">Banco Central</p><p class="deuda__tv">US$ ' + mm(B) + ' mil M</p><p class="deuda__tn">' + coma(pB) + "% del PBI · BOPREAL, LEBAC, LEDIV y letras en pesos</p></div>" +
        '<div class="deuda__op" aria-hidden="true">=</div>' +
        '<div class="deuda__t deuda__t--suma"><p class="deuda__tl">Los dos juntos</p><p class="deuda__tv">US$ ' + mm(S) + ' mil M</p><p class="deuda__tn">' + coma(pS) + "% del PBI</p></div></div>" };
  }

  function tarjetas(d, K) {
    var E = window.EconoTarjetas, pts = d.puntos, u = K.u, p0 = pts[0], tot = u.total;
    var wPr = u.privado / tot * 100, wMu = u.multi / tot * 100, wAg = u.agencias / tot * 100;
    var S0 = tes(p0) + bc(p0), sube = (K.S / S0 - 1) * 100, mesesPbi = K.pS / 100 * 12;
    var V = d.vencimientos, H = d.historia, out = [];

    // 1. bruta o neta, con el interruptor
    out.push({ id: "bn", titulo: "Bruta o neta", valor: mm(tot) + " → " + mm(K.T), texto: "mil M de US$: lo que queda al sacar lo que el Estado se debe a sí mismo",
      mini: E.miniPartes([["nx-sa", wPr], ["nx-sb", wMu], ["nx-sc", wAg]]),
      detalle: function (c) {
        c.innerHTML = '<div class="deuda__seg" role="group" aria-label="Qué deuda mirar"><button type="button" data-m="neta" aria-pressed="true">Sin lo que el Estado se debe a sí mismo</button><button type="button" data-m="bruta" aria-pressed="false">Toda la deuda</button></div>' +
          '<div class="deuda__llaves deuda--neta-solo" style="grid-template-columns:' + (wPr + wMu).toFixed(2) + "fr " + wAg.toFixed(2) + 'fr">' +
          '<div class="deuda__llave deuda__llave--neta"><b>Deuda neta · US$ ' + mm(K.T) + " mil M</b><span>Lo que se le debe a terceros</span></div>" +
          '<div class="deuda__llave deuda__llave--estado"><b>− US$ ' + mm(u.agencias) + " mil M</b><span>Se lo debe a sí mismo: no cuenta</span></div></div>" +
          '<div class="deuda__llaves deuda--bruta-solo" style="grid-template-columns:1fr"><div class="deuda__llave deuda__llave--bruta"><b>Deuda bruta · US$ ' + mm(tot) + " mil M</b><span>Todo lo que debe el Tesoro, incluida la parte que tiene el propio Estado</span></div></div>" +
          '<div class="deuda__barra" role="img" aria-label="Deuda bruta del Tesoro de ' + m(tot) + " millones: " + m(u.privado) + " con privados, " + m(u.multi) + " con organismos internacionales y " + m(u.agencias) + ' en manos del propio Estado">' +
          '<span class="deuda__s deuda__s--pr" style="width:' + wPr.toFixed(2) + '%"><b>Privados</b> ' + mm(u.privado) + "</span>" +
          '<span class="deuda__s deuda__s--mu" style="width:' + wMu.toFixed(2) + '%"><b>Organismos</b> ' + mm(u.multi) + "</span>" +
          '<span class="deuda__s deuda__s--ag" style="width:' + wAg.toFixed(2) + '%"><b>BCRA, ANSES, Banco Nación y otros</b> ' + mm(u.agencias) + "</span></div>" +
          '<p class="deuda__cuenta deuda--neta-solo"><span>Deuda total del Tesoro <b>' + mm(tot) + "</b></span><i>−</i><span>la que tiene el propio Estado <b>" + mm(u.agencias) + '</b></span><i>=</i><span class="deuda__res">deuda neta <b>' + mm(K.T) + "</b></span><em>en miles de millones de dólares</em></p>" +
          '<p class="deuda__cuenta deuda--bruta-solo"><span>Deuda bruta del Tesoro <b>' + mm(tot) + "</b></span><span>= privados " + mm(u.privado) + " + organismos " + mm(u.multi) + " + el propio Estado " + mm(u.agencias) + "</span><em>en miles de millones de dólares</em></p>";
        var caja = c, bs = c.querySelectorAll(".deuda__seg button");
        function modo(x) { caja.classList.toggle("deuda--bruta", x === "bruta"); [].forEach.call(bs, function (b) { b.setAttribute("aria-pressed", b.dataset.m === x ? "true" : "false"); }); }
        [].forEach.call(bs, function (b) { b.addEventListener("click", function () { modo(b.dataset.m); }); });
        modo("neta");
      } });

    // 2. a quién le debe
    var org = [], o = d.organismos || {}, resto = u.multi;
    ["FMI", "BID", "Banco Mundial", "CAF"].forEach(function (n) { if (o[n]) { org.push([n, o[n]]); resto -= o[n]; } });
    if (org.length) org.push(["Otros", resto]);
    out.push({ id: "qu", titulo: "¿A quién le debe?", valor: coma(u.privado / K.T * 100, 0) + "% privados", texto: "y " + coma(u.multi / K.T * 100, 0) + "% organismos internacionales, con el FMI a la cabeza",
      mini: E.miniPartes([["nx-sa", u.privado / K.T * 100], ["nx-sb", u.multi / K.T * 100]]),
      detalle: function (c) {
        c.innerHTML = '<div class="deuda__quien"><div class="deuda__q"><div class="deuda__qp">' + coma(u.privado / K.T * 100, 0) + "%</div><div><b>Privados · US$ " + mm(u.privado) + " mil M</b><p>Quienes tienen bonos y letras del Tesoro. Incluye US$ " + coma(u.elegible / 1000) + " mil M que no entraron a los canjes de 2005 y 2010.</p></div></div>" +
          '<div class="deuda__q deuda__q--mu"><div class="deuda__qp">' + coma(u.multi / K.T * 100, 0) + "%</div><div><b>Organismos internacionales · US$ " + mm(u.multi) + " mil M</b>" +
          (org.length ? '<div class="deuda__orgs">' + org.map(function (x) { return '<div class="deuda__org"><span>' + esc(x[0]) + '</span><span class="deuda__ob"><i style="width:' + (x[1] / org[0][1] * 100).toFixed(1) + '%"></i></span><b>' + mm(x[1]) + "</b></div>"; }).join("") + "</div>" : "") + "</div></div></div>";
      } });

    // 3. vencimientos
    if (V && V.total && V.total.length) {
      var f0 = new Date(u.fecha + "T12:00:00"), etqM = V.meses.map(function (n, i) { var dd = new Date(f0.getFullYear(), f0.getMonth() + 1 + i, 1); return MES_L[dd.getMonth()].slice(0, 3) + " " + String(dd.getFullYear()).slice(2); });
      var imax = V.total.indexOf(Math.max.apply(null, V.total)), dMax = new Date(f0.getFullYear(), f0.getMonth() + 1 + imax, 1);
      out.push({ id: "ve", titulo: "¿Cuándo hay que pagar?", valor: "US$ " + mm(V.doce.total) + " mil M", texto: "vencen en los próximos 12 meses; el pico es " + MES_L[dMax.getMonth()] + " de " + dMax.getFullYear(),
        mini: E.miniBarras(V.total),
        detalle: function (c) {
          var hi = Math.max.apply(null, V.total) * 1.08, G = V.grupos;
          var barras = V.total.map(function (t, j) {
            return '<div class="deuda__vb' + (j === imax ? " deuda__vb--max" : "") + '"><span class="deuda__vv">' + coma(t / 1000) + '</span><span class="deuda__vc" style="height:' + (t / hi * 100).toFixed(1) + '%">' +
              '<i class="deuda__v-o" style="flex-basis:' + (G.otros[j] / t * 100).toFixed(1) + '%"></i><i class="deuda__v-m" style="flex-basis:' + (G.organismos[j] / t * 100).toFixed(1) + '%"></i><i class="deuda__v-b" style="flex-basis:' + (G.bonos[j] / t * 100).toFixed(1) + '%"></i></span><span class="deuda__vm">' + etqM[j] + "</span></div>";
          }).join("");
          var A = V.anual || {}, ha = A.total ? Math.max.apply(null, A.total) * 1.1 : 1;
          var anual = A.total ? A.total.map(function (v, j) { return '<div class="deuda__ab"><span class="deuda__vv">' + coma(v / 1000, 0) + '</span><span class="deuda__ac" style="height:' + (v / ha * 100).toFixed(1) + '%"></span><span class="deuda__vm">' + esc(String(A.anios[j]).replace("/2089", "+").replace(/^(\d{4})\/\d{4}$/, "$1+")) + "</span></div>"; }).join("") : "";
          c.innerHTML = '<p class="deuda__p">En los próximos 12 meses vencen <b>US$ ' + mm(V.doce.total) + " mil M</b>: US$ " + mm(V.doce.capital) + " mil M de capital y US$ " + mm(V.doce.interes) + " mil M de intereses. El mes más pesado es <b>" + MES_L[dMax.getMonth()] + " de " + dMax.getFullYear() + "</b>, con US$ " + mm(V.total[imax]) + " mil M.</p>" +
            '<div class="deuda__venc" role="img" aria-label="Vencimientos mensuales del Tesoro de los próximos 12 meses">' + barras + "</div>" +
            '<p class="deuda__ley"><span><i class="deuda__ley-b"></i>Bonos y letras</span><span><i class="deuda__ley-m"></i>Organismos internacionales</span><span><i class="deuda__ley-o"></i>Otros (adelantos del BCRA, avales, bancos)</span><span>en miles de millones de dólares</span></p>' +
            (anual ? '<h4 class="deuda__h">Y por año</h4><div class="deuda__anual" role="img" aria-label="Vencimientos anuales del Tesoro">' + anual + '</div><p class="deuda__ley"><span>' + esc(A.anios[0]) + ": solo lo que falta del año · en miles de millones de dólares</span></p>" : "") +
            '<p class="deuda__fuente">Incluye toda la deuda del Tesoro, también la que está en manos del propio Estado, que en general se renueva en lugar de pagarse. La planilla no separa los vencimientos por quién tiene la deuda.</p>';
        } });
    }

    // 4. historia
    if (H && H.length > 3) {
      var hN = H[H.length - 1], h19 = H.filter(function (x) { return x.anio === "2019"; })[0], h23 = H.filter(function (x) { return x.anio === "2023"; })[0];
      out.push({ id: "hi", titulo: "¿Está alta o baja?", valor: coma(hN.neta) + "% del PBI", texto: "sin lo del propio Estado" + (h19 ? "; en 2019 era " + coma(h19.neta) + "%" : ""),
        mini: E.miniLinea(H.map(function (x) { return x.neta; })),
        detalle: function (c) {
          var iMinB = 0, iMinN = 0; H.forEach(function (x, i) { if (x.total < H[iMinB].total) iMinB = i; if (x.neta < H[iMinN].neta) iMinN = i; });
          c.innerHTML = '<p class="deuda__p">Sin contar lo que el Estado se debe a sí mismo, la deuda del Tesoro es el <b>' + coma(hN.neta) + "% del PBI</b>" + (h19 && h23 ? ": menos que en 2019 (" + coma(h19.neta) + "%) o en 2023 (" + coma(h23.neta) + "%)" : "") + ". El mínimo fue " + coma(H[iMinN].neta) + "% en " + H[iMinN].anio + ".</p>" +
            '<div class="deuda__linea"></div><p class="deuda__ley"><span><i class="deuda__ley-s"></i>Sin lo que el Estado se debe a sí mismo</span><span><i class="deuda__ley-t"></i>Toda la deuda (bruta)</span><span>en % del PBI, a fin de cada año</span></p>' +
            '<p class="deuda__fuente">Solo el Tesoro. En 2004 la deuda todavía incluía los bonos en default que se canjearon en 2005. El salto de fines de 2023 es por la devaluación de diciembre: el PBI se pasa a dólares con el tipo de cambio de fin de año, que saltó, y eso agranda la proporción.</p>';
          var l = c.querySelector(".deuda__linea"), n = H.length - 1, notas = [{ i: n, t: coma(hN.neta) + "% neta", dy: 22, ancla: "end" }, { i: n, b: true, t: coma(hN.total) + "% bruta", dy: -16, ancla: "end" }];
          if (h23) notas.push({ i: H.indexOf(h23), b: true, t: coma(h23.total) + "% a fines de 2023", ancla: "end" });
          notas.push({ i: 0, b: true, t: coma(H[0].total) + "% en " + H[0].anio, ancla: "start", dx: 6 });
          l.appendChild(dosLineas(H.map(function (x) { return x.neta; }), H.map(function (x) { return x.total; }), H.map(function (x) { return x.anio.replace(/^I+V?T /, ""); }), l.clientWidth,
            { lo: 0, hi: 165, ejeY: [0, 50, 100, 150], alto: 280, notas: notas, aria: "Deuda del Tesoro en % del PBI desde " + H[0].anio + ": bruta y sin lo que el Estado se debe a sí mismo" }));
        } });
    }

    // 5. para dimensionarlo
    var porHab = K.pob ? K.S * 1e6 / K.pob : null;
    out.push({ id: "di", titulo: "Para dimensionarlo", valor: "≈ " + coma(mesesPbi) + " meses", texto: "de todo lo que produce el país" + (porHab ? "; US$ " + m(porHab) + " por habitante" : ""),
      mini: '<span class="nx-cal" aria-hidden="true">' + Array.apply(null, Array(12)).map(function (_, k) { return '<i class="' + (k < Math.floor(mesesPbi) ? "on" : "") + '"></i>'; }).join("") + "</span>",
      detalle: function (c) {
        c.innerHTML = '<div class="deuda__esc"><div class="deuda__e"><p class="deuda__ev">≈ ' + coma(mesesPbi) + ' meses</p><p class="deuda__en">de todo lo que produce el país. La deuda del Tesoro y el BCRA (' + coma(K.pS) + "% del PBI) es como juntar todo lo que produce la Argentina en ese tiempo.</p></div>" +
          (porHab ? '<div class="deuda__e"><p class="deuda__ev">US$ ' + m(porHab) + ' por habitante</p><p class="deuda__en">Si se repartiera entre los ' + coma(K.pob / 1e6) + " millones de habitantes que proyecta el INDEC para " + u.fecha.slice(0, 4) + ". No es lo que debe cada persona: es una forma de dimensionar el total.</p></div>" : "") +
          (V ? '<div class="deuda__e"><p class="deuda__ev">US$ ' + m(V.doce.interes / 12) + ' M por mes</p><p class="deuda__en">de intereses en los próximos 12 meses (US$ ' + mm(V.doce.interes) + " mil M en total), por toda la deuda del Tesoro. Es lo que cuesta tenerla, sin devolver nada del capital.</p></div>" : "") + "</div>";
      } });

    // 6. cómo viene
    out.push({ id: "co", titulo: "¿Cómo viene?", valor: (sube >= 0 ? "+" : "−") + coma(Math.abs(sube)) + "%", texto: "desde " + MES_L[Number(p0.fecha.slice(5, 7)) - 1] + " de " + p0.fecha.slice(0, 4) + ", Tesoro y BCRA juntos",
      mini: E.miniLinea(pts.map(function (p) { return tes(p) + bc(p); })),
      detalle: function (c) {
        c.innerHTML = '<p class="deuda__p">Los dos juntos ' + (sube >= 0 ? "subieron" : "bajaron") + " <b>" + coma(Math.abs(sube)) + "%</b>. El Tesoro " + (K.T >= tes(p0) ? "sumó" : "bajó") + " US$ " + mm(Math.abs(K.T - tes(p0))) + " mil M y el BCRA " + (K.B >= bc(p0) ? "subió" : "bajó") + " US$ " + mm(Math.abs(K.B - bc(p0))) + " mil M.</p>" +
          '<div class="deuda__linea"></div><p class="deuda__ley"><span><i class="deuda__ley-s"></i>Tesoro + BCRA</span><span><i class="deuda__ley-t"></i>Solo Tesoro</span><span>en miles de millones de dólares</span></p>';
        var l = c.querySelector(".deuda__linea"), sv = pts.map(function (p) { return tes(p) + bc(p); }), n = sv.length - 1;
        l.appendChild(dosLineas(sv, pts.map(tes), pts.map(function (p) { return fechaCorta(p.fecha); }), l.clientWidth,
          { notas: [{ i: 0, t: mm(sv[0]), ancla: "start" }, { i: n, t: mm(sv[n]), ancla: "end" }], aria: "Deuda del Tesoro y el BCRA sumados, de " + m(sv[0]) + " a " + m(sv[n]) + " millones de dólares" }));
      } });

    // 7. banco central
    out.push({ id: "bc", titulo: "Banco Central", valor: "US$ " + mm(K.B) + " mil M", texto: "el " + coma(K.B / K.S * 100) + "% del total: BOPREAL, LEBAC, LEDIV y letras en pesos",
      mini: E.miniPartes([["nx-sa", 100 - K.B / K.S * 100], ["nx-sd", K.B / K.S * 100]]),
      detalle: function (c) {
        var b = u.bcra || {};
        c.innerHTML = '<div class="deuda__cmp"><span>Tesoro</span><span class="deuda__cb"><i class="deuda__cb--t" style="width:100%"></i></span><b>' + mm(K.T) + "</b></div>" +
          '<div class="deuda__cmp"><span>Banco Central</span><span class="deuda__cb"><i class="deuda__cb--b" style="width:' + (K.B / K.T * 100).toFixed(2) + '%"></i></span><b>' + mm(K.B) + "</b></div>" +
          '<p class="deuda__p">A la misma escala: la deuda del BCRA es el <b>' + coma(K.B / K.S * 100) + "%</b> del total. Son US$ " + mm(b.titulos || 0) + " mil M en BOPREAL, LEBAC y LEDIV, y US$ " + coma((b.letras_pesos || 0) / 1000, 2) + " mil M en letras en pesos. Los BOPREAL son bonos que el BCRA emitió desde 2024 para que las empresas cobraran deudas por importaciones.</p>";
      } });

    // 8. por qué se resta
    out.push({ id: "po", titulo: "¿Por qué se resta?", valor: "Lo que el Estado se debe a sí mismo", texto: "BCRA, ANSES y Banco Nación tienen bonos del Tesoro: no cuenta", mini: "",
      detalle: function (c) {
        c.innerHTML = '<p class="deuda__p">El BCRA, el fondo de la ANSES (FGS) y el Banco Nación compraron bonos y letras del Tesoro. Esa deuda queda dentro del propio Estado: no hay que buscar la plata afuera para pagarla. Por eso, al sumar el BCRA, solo se agrega lo que el BCRA le debe a terceros.</p>';
      } });
    return out;
  }

  function pintar(caja) {
    if (!caja || caja.__deuda) return;
    caja.__deuda = true;
    caja.appendChild(el("p", "hint", "Cargando la deuda…"));
    var pob = fetch("data/indec_extra.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    Promise.all([cargar(), pob]).then(function (r) {
      var d = r[0], px = r[1] && r[1].datos && r[1].datos.poblacion, anio = d.puntos[d.puntos.length - 1].fecha.slice(0, 4), p = null;
      if (px) px.forEach(function (x) { if (x[0] === anio) p = x[1]; });
      caja.textContent = "";
      var card = el("section", "sp-card deuda__card"); card.setAttribute("aria-labelledby", "deuda-tit");
      var K = cabecera(d, p);
      card.innerHTML = K.html;
      var sub = el("div", "deuda__sub"); card.appendChild(sub);
      if (window.EconoTarjetas) window.EconoTarjetas.grilla(sub, { titulo: "Para entenderla mejor", clase: "nx--est", tarjetas: tarjetas(d, K) });
      var fu = el("details", "deuda__fu");
      fu.innerHTML = '<summary>Fuentes y qué no incluye</summary><p class="deuda__fuente">Tesoro: <a href="' + esc(d.url) + '" target="_blank" rel="noopener">Secretaría de Finanzas</a> («Deuda Bruta de la Administración Central por acreedor», informes trimestrales, y la planilla del último trimestre). BCRA: API de estadísticas, stock de LEBAC, LEDIV y BOPREAL, letras en pesos y pases pasivos al último día de cada trimestre; las letras en pesos pasan a dólares con el tipo de cambio de referencia. El % del PBI del BCRA usa el mismo PBI del informe de Finanzas. Población: proyección del INDEC al 1 de julio. Sale una vez por trimestre, con unos tres meses de atraso.</p>' +
        '<p class="deuda__fuente">No incluye el swap con el Banco Central de China, los préstamos REPO con bancos ni otras obligaciones del balance del BCRA, porque no están como serie en la API; tampoco la deuda de empresas públicas y fondos fiduciarios. La base monetaria no es deuda.</p>';
      card.appendChild(fu);
      caja.appendChild(card);
    }).catch(function () {
      caja.__deuda = false;
      caja.textContent = "";
      caja.appendChild(el("p", "hint", "No se pudo cargar la deuda. Probá de nuevo en un rato."));
    });
  }

  window.EconoDeuda = {
    pintar: pintar,
    ultimo: function () {
      return cargar().then(function (d) {
        var u = d.puntos[d.puntos.length - 1], v = tes(u) + bc(u);
        return { neta: v, fecha: u.fecha, texto: "US$ " + mm(v) + " mil M", corta: fechaCorta(u.fecha) };
      });
    }
  };
})();
