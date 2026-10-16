/*
 * Tablero: una tabla con todos los indicadores, agrupados, con filas que se expanden
 * y muestran su grafico. Mas la vista Mercados (acciones y bonos en vivo).
 * Cada fila carga su serie por separado y se completa cuando llega.
 */
(function () {
  "use strict";

  var S = window.EconoSeries, C = window.EconoCharts;

  /* ---------- utilidades ---------- */

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
  function num(v, d) { var dec = d === undefined ? 0 : d; return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function signo(v, d) { return (v > 0 ? "+" : "") + num(v, d); }
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function fmtUnit(unit, v, dec) {
    var d = dec === undefined ? 0 : dec;
    switch (unit) {
      case "%": return num(v, d) + "%";
      case "ARS": return "$ " + num(v, d);
      case "M ARS": return Math.abs(v) >= 1e6 ? (v < 0 ? "-" : "") + "$ " + num(Math.abs(v) / 1e6, 2) + " bill." : "$ " + num(v, 0) + " M";
      case "M USD": return "USD " + num(v, 0) + " M";
      case "pb": return num(v, 0) + " pb";
      default: return num(v, d);
    }
  }

  function esMensual(s) { return C.mensual(s.points); }
  function fechaDato(s) {
    var d = new Date(s.ultimo.d + "T12:00:00");
    return esMensual(s) ? MESES[d.getMonth()] + " " + d.getFullYear() : d.getDate() + " " + MESES[d.getMonth()];
  }

  function valorHace(s, meses) {
    var ult = s.points[s.points.length - 1];
    var d = new Date(ult[0] + "T12:00:00"); d.setMonth(d.getMonth() - meses);
    var obj = d.toISOString().slice(0, 10), ref = null;
    for (var i = s.points.length - 1; i >= 0; i--) if (s.points[i][0] <= obj) { ref = s.points[i]; break; }
    return ref ? ref[1] : null;
  }

  function recortar(s, dias) {
    var ult = new Date(s.points[s.points.length - 1][0] + "T12:00:00").getTime();
    var corte = new Date(ult - dias * 86400000).toISOString().slice(0, 10);
    var pts = s.points.filter(function (p) { return p[0] >= corte; });
    var o = {}; Object.keys(s).forEach(function (k) { o[k] = s[k]; });
    o.points = pts.length > 1 ? pts : s.points.slice(-2);
    return o;
  }

  function mk(key, unit, dec, label, pts, fuente) {
    var n = pts.length;
    return { key: key, label: label, unit: unit, dec: dec, fuente: fuente || "", points: pts,
      ultimo: { d: pts[n - 1][0], v: pts[n - 1][1] }, previo: n > 1 ? { d: pts[n - 2][0], v: pts[n - 2][1] } : null };
  }

  /* ---------- catalogo de filas ---------- */

  // t: level (variacion %), rate (diferencia en puntos), ipc (variacion mensual de un indice)
  var FILAS = [
    { id: "oficial", g: "Dólar", label: "Dólar oficial", key: "dOficial", t: "level" },
    { id: "mep", g: "Dólar", label: "Dólar MEP", key: "dMep", t: "level" },
    { id: "ccl", g: "Dólar", label: "Dólar CCL", key: "dCcl", t: "level" },
    { id: "blue", g: "Dólar", label: "Dólar blue", key: "dBlue", t: "level" },
    { id: "brecha", g: "Dólar", label: "Brecha CCL contra oficial", derive: "brecha", keys: ["dCcl", "dOficial"], t: "rate" },

    { id: "infM", g: "Precios", label: "Inflación mensual", key: "infM", t: "rate", bars: true },
    { id: "infIA", g: "Precios", label: "Inflación interanual", key: "infIA", t: "rate" },
    { id: "nucleo", g: "Precios", label: "Núcleo, mensual", key: "ipcNucleo", t: "ipc" },
    { id: "regulados", g: "Precios", label: "Regulados, mensual", key: "ipcRegulados", t: "ipc" },
    { id: "estacionales", g: "Precios", label: "Estacionales, mensual", key: "ipcEstacionales", t: "ipc" },
    { id: "transporte", g: "Precios", label: "Transporte, mensual", key: "ipcTransporte", t: "ipc" },
    { id: "salud", g: "Precios", label: "Salud, mensual", key: "ipcSalud", t: "ipc" },
    { id: "educacion", g: "Precios", label: "Educación, mensual", key: "ipcEducacion", t: "ipc" },
    { id: "prendas", g: "Precios", label: "Prendas y calzado, mensual", key: "ipcPrendas", t: "ipc" },
    { id: "equipamiento", g: "Precios", label: "Equipamiento del hogar, mensual", key: "ipcEquipamiento", t: "ipc" },
    { id: "comunicaciones", g: "Precios", label: "Comunicaciones, mensual", key: "ipcComunicaciones", t: "ipc" },
    { id: "bebidas", g: "Precios", label: "Bebidas y tabaco, mensual", key: "ipcBebidas", t: "ipc" },
    { id: "uva", g: "Precios", label: "UVA", key: "uva", t: "level" },
    { id: "cer", g: "Precios", label: "CER", key: "cer", t: "level" },

    { id: "emae", g: "Actividad", label: "EMAE, desestacionalizado", key: "emae", t: "level" },
    { id: "ipi", g: "Actividad", label: "Industria (IPI)", key: "ipi", t: "level" },
    { id: "cemento", g: "Actividad", label: "Construcción (cemento)", key: "cemento", t: "level" },
    { id: "pbi", g: "Actividad", label: "PBI trimestral", key: "pbi", t: "level" },

    { id: "desoc", g: "Empleo y salarios", label: "Desocupación", key: "desocupacion", t: "rate" },
    { id: "salarios", g: "Empleo y salarios", label: "Índice de salarios, registrado", key: "salarios", t: "level" },
    { id: "salPriv", g: "Empleo y salarios", label: "Salarios, privado registrado", key: "salPrivado", t: "level" },
    { id: "salNoReg", g: "Empleo y salarios", label: "Salarios, privado no registrado", key: "salNoReg", t: "level" },
    { id: "salPub", g: "Empleo y salarios", label: "Salarios, sector público", key: "salPublico", t: "level" },
    { id: "ripte", g: "Empleo y salarios", label: "RIPTE", key: "ripte", t: "level" },
    { id: "smvm", g: "Empleo y salarios", label: "Salario mínimo", key: "smvm", t: "level" },
    { id: "haber", g: "Empleo y salarios", label: "Haber mínimo jubilatorio", key: "haberMin", t: "level" },

    { id: "resPrim", g: "Fiscal", label: "Resultado primario", key: "resPrimario", t: "level", bars: true, signed: true },
    { id: "recaud", g: "Fiscal", label: "Recaudación tributaria", key: "recaudacion", t: "level" },
    { id: "recaudIA", g: "Fiscal", label: "Recaudación, variación interanual", key: "recaudacionIA", t: "rate" },

    { id: "expo", g: "Comercio exterior", label: "Exportaciones", key: "expo", t: "level" },
    { id: "impo", g: "Comercio exterior", label: "Importaciones", key: "impo", t: "level" },
    { id: "saldo", g: "Comercio exterior", label: "Saldo comercial", derive: "saldo", keys: ["expo", "impo"], t: "level", bars: true, signed: true },

    { id: "reservas", g: "Dinero y tasas", label: "Reservas internacionales", key: "reservas", t: "level" },
    { id: "base", g: "Dinero y tasas", label: "Base monetaria", key: "baseMon", t: "level" },
    { id: "circ", g: "Dinero y tasas", label: "Circulación monetaria", key: "circulacion", t: "level" },
    { id: "m2", g: "Dinero y tasas", label: "M2 privado, interanual", key: "m2IA", t: "rate" },
    { id: "depositos", g: "Dinero y tasas", label: "Depósitos en efectivo", key: "depositos", t: "level" },
    { id: "prestamos", g: "Dinero y tasas", label: "Préstamos al sector privado", key: "prestamos", t: "level" },
    { id: "badlar", g: "Dinero y tasas", label: "Tasa BADLAR", key: "badlar", t: "rate" },
    { id: "tamar", g: "Dinero y tasas", label: "Tasa TAMAR", key: "tamar", t: "rate" },
    { id: "tasaDep", g: "Dinero y tasas", label: "Tasa de depósitos a 30 días", key: "tasaDep", t: "rate" },
    { id: "tasaPers", g: "Dinero y tasas", label: "Tasa de préstamos personales", key: "tasaPers", t: "rate" },

    { id: "riesgo", g: "Mercados", label: "Riesgo país", key: "riesgo", t: "rate" }
  ];

  var items = [], porId = {};
  var estado = { grupo: "Todos", orden: "g", q: "", abiertos: {}, rango: {} };
  var cargado = false, pendiente = null;

  function dirClase(v) { return v === undefined || v === null ? "flat" : v > 0.0001 ? "up" : v < -0.0001 ? "down" : "flat"; }
  function flecha(v) { return v > 0.0001 ? "▲ " : v < -0.0001 ? "▼ " : "■ "; }

  function armarItem(f, s, extra) {
    var it = f.__it;
    it.s = s;
    it.ok = true;
    it.fmt = function (v) { return fmtUnit(s.unit, v, s.dec); };
    it.valor = it.fmt(s.ultimo.v);
    it.fecha = fechaDato(s);
    it.mensual = esMensual(s);
    var n = s.points.length;
    if (s.previo) {
      if (f.t === "level") { it.dPrev = (s.ultimo.v / s.previo.v - 1) * 100; it.dPrevTxt = signo(it.dPrev, 2) + "%"; }
      else { it.dPrev = s.ultimo.v - s.previo.v; it.dPrevTxt = signo(it.dPrev, s.unit === "pb" ? 0 : 1) + (s.unit === "pb" ? " pb" : " pp"); }
    }
    if (extra && extra.cum12 !== undefined && extra.cum12 !== null) {
      it.d12 = extra.cum12; it.d12Txt = signo(extra.cum12, 1) + "% acum.";
    } else {
      var h = valorHace(s, 12);
      if (h !== null) {
        if (f.t === "level" && h !== 0) { it.d12 = (s.ultimo.v / h - 1) * 100; it.d12Txt = signo(it.d12, 1) + "%"; }
        else if (f.t === "rate") { it.d12 = s.ultimo.v - h; it.d12Txt = signo(it.d12, s.unit === "pb" ? 0 : 1) + (s.unit === "pb" ? " pb" : " pp"); }
      }
    }
    it.spark = s.points.slice(it.mensual ? -24 : -30);
    it.cum12 = extra && extra.cum12;
  }

  function cargarFila(f) {
    var it = f.__it;
    if (f.derive === "brecha") {
      return Promise.all([S.cargar("dCcl", 1300), S.cargar("dOficial", 1300)]).then(function (r) {
        var of = {}; r[1].points.forEach(function (p) { of[p[0]] = p[1]; });
        var pts = r[0].points.filter(function (p) { return of[p[0]]; }).map(function (p) { return [p[0], (p[1] / of[p[0]] - 1) * 100]; });
        armarItem(f, mk("brecha", "%", 1, f.label, pts, "ArgentinaDatos"));
      });
    }
    if (f.derive === "saldo") {
      return Promise.all([S.cargar("expo", 400), S.cargar("impo", 400)]).then(function (r) {
        armarItem(f, S.restar(r[0], r[1], f.label));
      });
    }
    return S.cargar(f.key, 1300).then(function (s) {
      if (f.t === "ipc") {
        var pts = S.variacionesMensuales(s);
        var base = mk(f.key, "%", 1, f.label, pts, s.fuente);
        base.indice = s;
        armarItem(f, base, { cum12: S.variacion(s, 12) });
      } else armarItem(f, s);
    });
  }

  /* ---------- render de la tabla ---------- */

  function filtrados() {
    var lista = items.filter(function (i) {
      return (estado.grupo === "Todos" || i.g === estado.grupo) && (!estado.q || i.label.toLowerCase().indexOf(estado.q) !== -1);
    });
    if (estado.orden === "prev") lista = lista.slice().sort(function (a, b) { return (b.dPrev === undefined ? -1e9 : b.dPrev) - (a.dPrev === undefined ? -1e9 : a.dPrev); });
    if (estado.orden === "d12") lista = lista.slice().sort(function (a, b) { return (b.d12 === undefined ? -1e9 : b.d12) - (a.d12 === undefined ? -1e9 : a.d12); });
    return lista;
  }

  function delta(txt, v) { return el("span", "delta " + dirClase(v), txt ? flecha(v) + txt : "-"); }

  function rangosDe(it) {
    return it.mensual ? [["2 años", 730], ["3 años", 1095], ["5 años", 1825]] : [["3 meses", 90], ["1 año", 365], ["3 años", 1095], ["5 años", 1825]];
  }

  function detalle(it) {
    var tr = el("tr", "detail"); var td = el("td"); td.colSpan = 6;
    var rs = rangosDe(it);
    var rg = estado.rango[it.id];
    if (!rg || !rs.some(function (r) { return r[1] === rg; })) rg = rs[Math.min(1, rs.length - 1)][1];

    var chips = el("div", "chips chips--sm"); chips.setAttribute("role", "group"); chips.setAttribute("aria-label", "Período de " + it.label);
    rs.forEach(function (r) {
      var b = el("button", "chip", r[0]); b.type = "button"; b.setAttribute("aria-pressed", r[1] === rg ? "true" : "false");
      b.addEventListener("click", function (e) { e.stopPropagation(); estado.rango[it.id] = r[1]; pintar(); });
      chips.appendChild(b);
    });
    td.appendChild(chips);

    var g = el("div", "detail__grid");
    var ch = el("div", "chart"); g.appendChild(ch);
    var facts = el("div", "facts");
    var vals = it.s.points.map(function (p) { return p[1]; });
    var enRango = recortar(it.s, rg).points.map(function (p) { return p[1]; });
    [["Último dato", it.valor + " (" + it.fecha + ")"],
     ["Mínimo del período", it.fmt(Math.min.apply(null, enRango))],
     ["Máximo del período", it.fmt(Math.max.apply(null, enRango))],
     ["Fuente", it.s.fuente || "datos públicos"]].forEach(function (x) {
      var d = el("div"); d.appendChild(el("span", "", x[0])); d.appendChild(el("b", "", x[1])); facts.appendChild(d);
    });
    var csv = el("button", "chip", "Descargar CSV"); csv.type = "button";
    csv.addEventListener("click", function (e) { e.stopPropagation(); C.csv(it.id, [it.s]); });
    facts.appendChild(csv);
    g.appendChild(facts);
    td.appendChild(g);

    var det = el("details", "datos");
    det.appendChild(el("summary", "", "Ver datos"));
    var t = el("table", "tabla"); var th = el("thead"), trh = el("tr");
    trh.appendChild(el("th", "", "Fecha")); trh.appendChild(el("th", "num", it.label)); th.appendChild(trh); t.appendChild(th);
    var tb = el("tbody");
    it.s.points.slice(-12).reverse().forEach(function (p) {
      var r = el("tr"); r.appendChild(el("td", "", C.fechaLarga(p[0], it.mensual))); r.appendChild(el("td", "num", it.fmt(p[1]))); tb.appendChild(r);
    });
    t.appendChild(tb);
    var w = el("div", "tabla__wrap"); w.appendChild(t); det.appendChild(w);
    td.appendChild(det);
    tr.appendChild(td);

    var serieRango = recortar(it.s, rg);
    setTimeout(function () {
      if (it.bars) {
        C.bars(ch, { points: serieRango.points, fmt: it.fmt, titulo: it.label, height: 220,
          color: it.signed ? function (v) { return v >= 0 ? "var(--c1)" : "var(--c2)"; } : undefined,
          tickFmt: it.s.unit === "M ARS" ? function (v) { return num(v / 1e6, 1) + " bill."; } : undefined });
      } else if (it.t === "ipc") {
        C.bars(ch, { points: serieRango.points, fmt: it.fmt, titulo: it.label, height: 220 });
      } else {
        C.line(ch, { series: [serieRango], area: true, fmt: it.fmt, titulo: it.label, height: 220 });
      }
    }, 0);
    return tr;
  }

  function pintar() {
    var body = $("tbody"); if (!body) return;
    body.textContent = "";
    var lista = filtrados();
    var g = "";
    lista.forEach(function (it) {
      if (estado.orden === "g" && it.g !== g) {
        g = it.g;
        var gr = el("tr", "g"); var gc = el("td", "", g + " (" + lista.filter(function (x) { return x.g === g; }).length + ")"); gc.colSpan = 6; gr.appendChild(gc); body.appendChild(gr);
      }
      var abierta = !!estado.abiertos[it.id];
      var tr = el("tr", "item" + (abierta ? " open" : "") + (it.ok ? "" : " pend"));
      tr.id = "fila-" + it.id;
      var c1 = el("td", "first");
      var b = el("button"); b.type = "button"; b.setAttribute("aria-expanded", abierta ? "true" : "false");
      if (!it.ok) b.disabled = !it.error;
      b.appendChild(el("span", "caret", "▸")); b.appendChild(document.createTextNode(it.label));
      c1.appendChild(b); tr.appendChild(c1);
      if (it.ok) {
        tr.appendChild(el("td", "n", it.valor));
        tr.appendChild(el("td", "per", it.fecha));
        var c3 = el("td", "n"); c3.appendChild(delta(it.dPrevTxt, it.dPrev)); tr.appendChild(c3);
        var c4 = el("td", "n d12"); c4.appendChild(delta(it.d12Txt, it.d12)); tr.appendChild(c4);
        var c5 = el("td", "tend"); var sp = document.createElementNS("http://www.w3.org/2000/svg", "svg"); sp.setAttribute("class", "spark"); sp.setAttribute("aria-hidden", "true");
        C.spark(sp, it.spark, "var(--c1)"); c5.appendChild(sp); tr.appendChild(c5);
        var alternar = function () { estado.abiertos[it.id] = !estado.abiertos[it.id]; pintar(); };
        b.addEventListener("click", function (e) { e.stopPropagation(); alternar(); });
        tr.addEventListener("click", alternar);
      } else {
        var msg = it.error ? "sin dato" : "cargando…";
        var c = el("td", "n msg", msg); c.colSpan = 5; tr.appendChild(c);
        if (it.error) {
          var rb = el("button", "chip chip--mini", "Reintentar"); rb.type = "button";
          rb.addEventListener("click", function () { it.error = false; pintar(); iniciarFila(it.__f); });
          c.appendChild(document.createTextNode(" ")); c.appendChild(rb);
        }
      }
      body.appendChild(tr);
      if (abierta && it.ok) body.appendChild(detalle(it));
    });
    if (!lista.length) { var e = el("tr"); var ec = el("td", "msg", "Sin resultados."); ec.colSpan = 6; e.appendChild(ec); body.appendChild(e); }
    resumen();
  }

  function resumen() {
    var s = $("resumen"); if (!s) return;
    var ok = items.filter(function (i) { return i.ok; });
    var suben = ok.filter(function (i) { return i.dPrev > 0.0001; }).length;
    var bajan = ok.filter(function (i) { return i.dPrev < -0.0001; }).length;
    s.textContent = "";
    [[ok.length + " de " + items.length, "indicadores cargados"], [String(suben), "suben vs anterior"], [String(bajan), "bajan vs anterior"]].forEach(function (x) {
      var d = el("div", "sum"); d.appendChild(el("b", "", x[0])); d.appendChild(el("span", "", x[1])); s.appendChild(d);
    });
  }

  function pintarChips() {
    var box = $("grupos"); if (!box) return;
    box.textContent = "";
    var grupos = ["Todos"]; FILAS.forEach(function (f) { if (grupos.indexOf(f.g) === -1) grupos.push(f.g); });
    grupos.forEach(function (g) {
      var b = el("button", "chip", g); b.type = "button"; b.setAttribute("aria-pressed", g === estado.grupo ? "true" : "false");
      b.addEventListener("click", function () { estado.grupo = g; estado.orden = "g"; pintarChips(); pintar(); });
      box.appendChild(b);
    });
  }

  function programarPintar() {
    if (pendiente) return;
    pendiente = setTimeout(function () { pendiente = null; pintar(); }, 120);
  }

  function iniciarFila(f) {
    var it = f.__it;
    return cargarFila(f).then(function () { programarPintar(); }, function (e) { it.error = true; it.ok = false; it.errMsg = e && e.message; programarPintar(); });
  }

  function armarTablero() {
    FILAS.forEach(function (f) {
      var it = { id: f.id, g: f.g, label: f.label, t: f.t, ok: false, bars: f.bars, signed: f.signed, __f: f };
      f.__it = it; items.push(it); porId[f.id] = it;
    });
    pintarChips();
    pintar();
    $("buscar").addEventListener("input", function (e) { estado.q = e.target.value.trim().toLowerCase(); pintar(); });
    Array.prototype.forEach.call(document.querySelectorAll("#matriz thead button"), function (b) {
      b.addEventListener("click", function () { estado.orden = estado.orden === b.dataset.s ? "g" : b.dataset.s; pintar(); });
    });
    Promise.all(FILAS.map(iniciarFila)).then(function () {
      cargado = true;
      var maxFecha = items.filter(function (i) { return i.ok; }).length;
      $("sub").textContent = maxFecha + " de " + items.length + " indicadores con datos al " + new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long" }) + ". Tocá una fila para ver su gráfico.";
    });
  }

  /* ---------- Mercados ---------- */

  function esqueleto(alto) { var d = el("div", "skeleton"); d.style.height = alto + "px"; d.setAttribute("aria-hidden", "true"); return d; }

  function chip(texto, activo, onClick) {
    var b = el("button", "chip", texto); b.type = "button"; b.setAttribute("aria-pressed", activo ? "true" : "false"); b.addEventListener("click", onClick); return b;
  }

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
    card.appendChild(el("p", "hint", "Precios con demora. Fuente: data912."));
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
        var c = el("td", "num"); c.appendChild(delta(signo(r.pct_change, 2) + "%", r.pct_change)); tr.appendChild(c);
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
      var err = el("div", "chart__error"); err.appendChild(el("p", "", vacio)); cuerpo.appendChild(err);
    });
  }

  var mercadosListo = false;
  function armarMercados() {
    var v = $("mercados-contenido");
    var g = el("div", "grid2");
    v.appendChild(g);
    tablaMercado(g, "arg_stocks", "Acciones argentinas", "No se pudieron cargar las acciones.");
    tablaMercado(g, "arg_bonds", "Bonos y letras", "No se pudieron cargar los bonos.");
  }

  /* ---------- API ---------- */

  var tableroListo = false;

  function mostrar(vista, sub) {
    if (vista === "tablero") {
      if (!tableroListo) { tableroListo = true; armarTablero(); }
      if (sub && porId[sub]) {
        estado.abiertos[sub] = true;
        if (estado.grupo !== "Todos" && estado.grupo !== porId[sub].g) estado.grupo = "Todos";
        pintarChips(); pintar();
        var f = $("fila-" + sub); if (f) f.scrollIntoView({ block: "center" });
      }
    } else if (vista === "mercados") {
      if (!mercadosListo) { mercadosListo = true; armarMercados(); }
    }
  }

  window.EconoTablero = { mostrar: mostrar };
})();
