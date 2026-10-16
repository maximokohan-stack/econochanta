/*
 * Tablero: tablas de indicadores ("matrices") con filas que se expanden y muestran su grafico.
 * Se usan en dos vistas: Tablero (todo) y Banco Central. Mas la vista Acciones y bonos.
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
      case "M ARS": return (v < 0 ? "-" : "") + "$ " + (Math.abs(v) >= 1e6 ? num(Math.abs(v) / 1e6, 2) + " bill." : num(Math.abs(v), 0) + " M");
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

  function suma(s, dias) {
    var r = recortar(s, dias);
    return r.points.reduce(function (a, p) { return a + p[1]; }, 0);
  }

  function mk(key, unit, dec, label, pts, fuente) {
    var n = pts.length;
    return { key: key, label: label, unit: unit, dec: dec, fuente: fuente || "", points: pts,
      ultimo: { d: pts[n - 1][0], v: pts[n - 1][1] }, previo: n > 1 ? { d: pts[n - 2][0], v: pts[n - 2][1] } : null };
  }

  function dirClase(v) { return v === undefined || v === null ? "flat" : v > 0.0001 ? "up" : v < -0.0001 ? "down" : "flat"; }
  function flecha(v) { return v > 0.0001 ? "▲ " : v < -0.0001 ? "▼ " : "■ "; }
  function delta(txt, v) { return el("span", "delta " + dirClase(v), txt ? flecha(v) + txt : "-"); }
  function esqueleto(alto) { var d = el("div", "skeleton"); d.style.height = alto + "px"; d.setAttribute("aria-hidden", "true"); return d; }
  function chip(texto, activo, onClick) {
    var b = el("button", "chip", texto); b.type = "button"; b.setAttribute("aria-pressed", activo ? "true" : "false"); b.addEventListener("click", onClick); return b;
  }

  /* ---------- catalogos de filas ---------- */

  // t: level (variacion %), rate (diferencia en puntos), ipc (variacion mensual de un indice), flow (flujo diario)
  var FILAS_TABLERO = [
    { id: "oficial", g: "Dólar", label: "Dólar oficial", key: "dOficial", t: "level" },
    { id: "mep", g: "Dólar", label: "Dólar MEP", key: "dMep", t: "level" },
    { id: "ccl", g: "Dólar", label: "Dólar CCL", key: "dCcl", t: "level" },
    { id: "blue", g: "Dólar", label: "Dólar blue", key: "dBlue", t: "level" },
    { id: "brecha", g: "Dólar", label: "Brecha CCL contra oficial", derive: "brecha", t: "rate" },

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
    { id: "saldo", g: "Comercio exterior", label: "Saldo comercial", derive: "saldo", t: "level", bars: true, signed: true },

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

  var FILAS_BCRA = [
    { id: "reservas", g: "Reservas y tipo de cambio", label: "Reservas internacionales", key: "reservas", t: "level" },
    { id: "reservasSinDEG", g: "Reservas y tipo de cambio", label: "Reservas, sin DEG 2009", key: "reservasSinDEG", t: "level" },
    { id: "compras", g: "Reservas y tipo de cambio", label: "Compras de divisas (variación diaria)", key: "comprasDivisas", t: "flow", bars: true, signed: true },
    { id: "tcMay", g: "Reservas y tipo de cambio", label: "Tipo de cambio mayorista de referencia", key: "tcMay", t: "level" },
    { id: "tcMin", g: "Reservas y tipo de cambio", label: "Tipo de cambio minorista", key: "tcMin", t: "level" },

    { id: "base", g: "Base monetaria", label: "Base monetaria", key: "baseMon", t: "level" },
    { id: "circ", g: "Base monetaria", label: "Circulación monetaria", key: "circulacion", t: "level" },
    { id: "factTotal", g: "Base monetaria", label: "Factores de explicación, total diario", key: "factTotal", t: "flow", bars: true, signed: true },
    { id: "factCompras", g: "Base monetaria", label: "Efecto de las compras de divisas", key: "factCompras", t: "flow", bars: true, signed: true },
    { id: "factOtras", g: "Base monetaria", label: "Efecto de otras operaciones", key: "factOtras", t: "flow", bars: true, signed: true },

    { id: "badlar", g: "Tasas de interés", label: "BADLAR bancos privados", key: "badlar", t: "rate" },
    { id: "tamar", g: "Tasas de interés", label: "TAMAR bancos privados", key: "tamar", t: "rate" },
    { id: "tasaDep", g: "Tasas de interés", label: "Depósitos a 30 días", key: "tasaDep", t: "rate" },
    { id: "tasaPases", g: "Tasas de interés", label: "Pases entre terceros a 1 día", key: "tasaPases", t: "rate" },
    { id: "tasaBaibar", g: "Tasas de interés", label: "BAIBAR, préstamos entre bancos", key: "tasaBaibar", t: "rate" },
    { id: "tasaAdelantos", g: "Tasas de interés", label: "Adelantos en cuenta corriente", key: "tasaAdelantos", t: "rate" },
    { id: "tasaPers", g: "Tasas de interés", label: "Préstamos personales", key: "tasaPers", t: "rate" },

    { id: "depositos", g: "Depósitos", label: "Depósitos en efectivo, total", key: "depositos", t: "level" },
    { id: "depCC", g: "Depósitos", label: "En cuenta corriente", key: "depCC", t: "level" },
    { id: "depCA", g: "Depósitos", label: "En caja de ahorro", key: "depCA", t: "level" },
    { id: "depPlazo", g: "Depósitos", label: "A plazo", key: "depPlazo", t: "level" },
    { id: "m2", g: "Depósitos", label: "M2 privado, interanual", key: "m2IA", t: "rate" },

    { id: "prestamos", g: "Crédito al sector privado", label: "Préstamos, total", key: "prestamos", t: "level" },
    { id: "credAdelantos", g: "Crédito al sector privado", label: "Adelantos", key: "credAdelantos", t: "level" },
    { id: "credDocumentos", g: "Crédito al sector privado", label: "Documentos", key: "credDocumentos", t: "level" },
    { id: "credHipotecarios", g: "Crédito al sector privado", label: "Hipotecarios", key: "credHipotecarios", t: "level" },
    { id: "credPrendarios", g: "Crédito al sector privado", label: "Prendarios", key: "credPrendarios", t: "level" }
  ];

  /* ---------- mesa (lista de indicadores a la izquierda, detalle a la derecha) ---------- */

  function rangosDe(it) {
    return it.mensual ? [["2 años", 730], ["3 años", 1095], ["5 años", 1825]] : [["3 meses", 90], ["1 año", 365], ["3 años", 1095], ["5 años", 1825]];
  }

  /* cfg: { filas, raiz, vista } */
  function crearMesa(cfg) {
    var filas = cfg.filas, vista = cfg.vista;
    var items = [], porId = {}, pendiente = null;
    var estado = { actual: null, q: "", rango: {}, detalleOk: null };
    var dom = {};

    function armarItem(f, s, extra) {
      var it = f.__it;
      it.s = s; it.ok = true; it.error = false;
      it.fmt = function (v) { return fmtUnit(s.unit, v, s.dec); };
      it.valor = it.fmt(s.ultimo.v);
      it.fecha = fechaDato(s);
      it.mensual = esMensual(s);
      if (f.t === "flow") {
        if (s.previo) { it.dPrev = s.ultimo.v - s.previo.v; it.dPrevTxt = (it.dPrev > 0 ? "+" : "") + it.fmt(it.dPrev); }
        var acum = suma(s, 30);
        it.d12 = acum; it.d12Txt = "30 d: " + (acum > 0 ? "+" : "") + it.fmt(acum);
      } else {
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
      }
      it.spark = s.points.slice(it.mensual ? -24 : -30);
    }

    function cargarFila(f) {
      if (f.derive === "brecha") {
        return Promise.all([S.cargar("dCcl", 1300), S.cargar("dOficial", 1300)]).then(function (r) {
          var of = {}; r[1].points.forEach(function (p) { of[p[0]] = p[1]; });
          var pts = r[0].points.filter(function (p) { return of[p[0]]; }).map(function (p) { return [p[0], (p[1] / of[p[0]] - 1) * 100]; });
          armarItem(f, mk("brecha", "%", 1, f.label, pts, "ArgentinaDatos"));
        });
      }
      if (f.derive === "saldo") {
        return Promise.all([S.cargar("expo", 400), S.cargar("impo", 400)]).then(function (r) { armarItem(f, S.restar(r[0], r[1], f.label)); });
      }
      return S.cargar(f.key, 1300).then(function (s) {
        if (f.t === "ipc") {
          var base = mk(f.key, "%", 1, f.label, S.variacionesMensuales(s), s.fuente);
          armarItem(f, base, { cum12: S.variacion(s, 12) });
        } else armarItem(f, s);
      });
    }

    function armarEsqueleto() {
      var m = el("div", "mesa"); dom.mesa = m;
      var lista = el("aside", "mesa__lista"); lista.setAttribute("aria-label", "Indicadores");
      var top = el("div", "mesa__top");
      dom.sub = el("p", "mesa__sub", "Cargando indicadores…"); top.appendChild(dom.sub);
      dom.buscar = el("input", "mesa__buscar"); dom.buscar.type = "search"; dom.buscar.placeholder = "Buscar indicador"; dom.buscar.setAttribute("aria-label", "Buscar indicador");
      top.appendChild(dom.buscar);
      lista.appendChild(top);
      dom.filas = el("div", "mesa__filas"); lista.appendChild(dom.filas);
      m.appendChild(lista);
      dom.detalle = el("section", "mesa__detalle"); dom.detalle.tabIndex = -1; dom.detalle.setAttribute("aria-label", "Detalle del indicador");
      m.appendChild(dom.detalle);
      cfg.raiz.appendChild(m);
    }

    function pintarLista() {
      var box = dom.filas; box.textContent = "";
      var g = "";
      items.forEach(function (it) {
        if (estado.q && it.label.toLowerCase().indexOf(estado.q) === -1) return;
        if (it.g !== g) { g = it.g; box.appendChild(el("div", "mesa__grupo", g)); }
        var b = el("button", "fila"); b.type = "button";
        if (it.id === estado.actual) b.setAttribute("aria-current", "true");
        b.appendChild(el("span", "fila__nombre", it.label));
        if (it.ok) {
          b.appendChild(el("span", "fila__val", it.valor));
          var sp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          sp.setAttribute("class", "fila__spark"); sp.setAttribute("aria-hidden", "true");
          C.spark(sp, it.spark, it.dPrev > 0 ? "var(--up)" : it.dPrev < 0 ? "var(--down)" : "var(--text-2)");
          b.appendChild(sp);
          b.appendChild(el("span", "fila__meta", it.fecha));
          b.appendChild(el("span", "fila__chg " + dirClase(it.dPrev), it.dPrevTxt ? flecha(it.dPrev) + it.dPrevTxt : ""));
        } else {
          b.appendChild(el("span", "fila__val fila__msg", it.error ? "sin dato" : "…"));
        }
        b.addEventListener("click", function () { location.hash = "#" + vista + ":" + it.id; });
        box.appendChild(b);
      });
      if (!box.firstChild) box.appendChild(el("p", "mesa__vacio", "Sin resultados."));
    }

    function pintarDetalle() {
      var it = porId[estado.actual];
      var box = dom.detalle; box.textContent = "";
      if (!it) return;
      var volver = el("button", "mesa__volver", "← Indicadores"); volver.type = "button";
      volver.addEventListener("click", function () { location.hash = "#" + vista; });
      box.appendChild(volver);
      box.appendChild(el("div", "kicker", it.g));
      box.appendChild(el("h2", "mesa__titulo", it.label));
      if (!it.ok) {
        if (it.error) {
          var err = el("div", "chart__error"); err.appendChild(el("p", "", "No se pudo cargar este indicador."));
          var rb = el("button", "btn btn--ghost btn--sm", "Reintentar"); rb.type = "button";
          rb.addEventListener("click", function () { it.error = false; pintarDetalle(); pintarLista(); iniciarFila(it.__f); });
          err.appendChild(rb); box.appendChild(err);
        } else box.appendChild(esqueleto(260));
        return;
      }
      estado.detalleOk = it.id;
      box.appendChild(el("div", "big", it.valor));
      var chg = el("div", "pastillas");
      if (it.dPrevTxt) chg.appendChild(el("span", "pastilla " + dirClase(it.dPrev), flecha(it.dPrev) + it.dPrevTxt + (it.mensual ? " vs período anterior" : " vs día anterior")));
      if (it.d12Txt) chg.appendChild(el("span", "pastilla " + dirClase(it.d12), flecha(it.d12) + it.d12Txt + (it.t === "flow" ? "" : " en 12 meses")));
      chg.appendChild(el("span", "pastilla flat", "Dato de " + it.fecha));
      box.appendChild(chg);

      var rs = rangosDe(it);
      var rg = estado.rango[it.id];
      if (!rg || !rs.some(function (r) { return r[1] === rg; })) rg = rs[Math.min(1, rs.length - 1)][1];
      var rbox = el("div", "chips chips--sm"); rbox.setAttribute("role", "group"); rbox.setAttribute("aria-label", "Período");
      rs.forEach(function (r) { rbox.appendChild(chip(r[0], r[1] === rg, function () { estado.rango[it.id] = r[1]; pintarDetalle(); })); });
      box.appendChild(rbox);

      var cb = el("div", "mesa__grafico chart"); box.appendChild(cb);
      var serieRango = recortar(it.s, rg);
      var vals = serieRango.points.map(function (p) { return p[1]; });
      var prom = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;

      var st = el("div", "stats");
      [["Último", it.valor], ["Mínimo", it.fmt(Math.min.apply(null, vals))], ["Máximo", it.fmt(Math.max.apply(null, vals))], ["Promedio", it.fmt(prom)], ["Puntos", String(vals.length)]].forEach(function (x) {
        var d = el("div", "stat"); d.appendChild(el("span", "", x[0])); d.appendChild(el("b", "", x[1])); st.appendChild(d);
      });
      box.appendChild(st);

      var t = el("table", "tabla"); var th = el("thead"), trh = el("tr");
      trh.appendChild(el("th", "", "Fecha")); trh.appendChild(el("th", "num", it.label)); th.appendChild(trh); t.appendChild(th);
      var tb = el("tbody");
      it.s.points.slice(-12).reverse().forEach(function (p) {
        var r = el("tr"); r.appendChild(el("td", "", C.fechaLarga(p[0], it.mensual))); r.appendChild(el("td", "num", it.fmt(p[1]))); tb.appendChild(r);
      });
      t.appendChild(tb);
      var w = el("div", "tabla__wrap"); w.appendChild(t); box.appendChild(w);

      var tools = el("div", "mesa__pie");
      tools.appendChild(el("span", "hint", "Fuente: " + (it.s.fuente || "datos públicos")));
      var csv = el("button", "btn btn--ghost btn--xs", "Descargar CSV"); csv.type = "button";
      csv.addEventListener("click", function () { C.csv(it.id, [it.s]); });
      tools.appendChild(csv);
      box.appendChild(tools);

      if (it.bars || it.t === "ipc") {
        C.bars(cb, { points: serieRango.points, fmt: it.fmt, titulo: it.label, height: 280,
          color: it.signed ? function (v) { return v >= 0 ? "var(--c1)" : "var(--c2)"; } : undefined,
          tickFmt: it.s.unit === "M ARS" ? function (v) { return Math.abs(v) >= 1e6 ? num(v / 1e6, 1) + " bill." : num(v, 0); } : undefined });
      } else {
        C.line(cb, { series: [serieRango], area: true, fmt: it.fmt, titulo: it.label, height: 280 });
      }
    }

    function actualizarSub() {
      var n = items.filter(function (i) { return i.ok; }).length;
      dom.sub.textContent = n + " de " + items.length + " indicadores · datos al " + new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long" });
    }

    function programarPintar() {
      if (pendiente) return;
      pendiente = setTimeout(function () {
        pendiente = null;
        pintarLista();
        var it = porId[estado.actual];
        if (it && it.ok && estado.detalleOk !== it.id) pintarDetalle();
        actualizarSub();
      }, 120);
    }

    function iniciarFila(f) {
      var it = f.__it;
      return cargarFila(f).then(programarPintar, function () { it.error = true; it.ok = false; programarPintar(); });
    }

    function seleccionar(id) {
      if (!porId[id]) return;
      estado.actual = id; estado.detalleOk = null;
      pintarLista(); pintarDetalle();
    }

    function armar() {
      filas.forEach(function (f) {
        var it = { id: f.id, g: f.g, label: f.label, t: f.t, ok: false, bars: f.bars, signed: f.signed, __f: f };
        f.__it = it; items.push(it); porId[f.id] = it;
      });
      armarEsqueleto();
      seleccionar(filas[0].id);
      dom.buscar.addEventListener("input", function (e) { estado.q = e.target.value.trim().toLowerCase(); pintarLista(); });
      filas.forEach(iniciarFila);
    }

    // abrir un indicador desde la URL; en celular muestra el detalle a pantalla completa
    function abrir(id) {
      if (!porId[id]) return;
      dom.mesa.classList.add("showing");
      if (estado.actual !== id) seleccionar(id);
      if (window.matchMedia("(max-width: 820px)").matches) window.scrollTo(0, 0);
    }

    function cerrar() { if (dom.mesa) dom.mesa.classList.remove("showing"); }

    return { armar: armar, abrir: abrir, cerrar: cerrar };
  }

  /* ---------- tarjeta con grafico ---------- */

  // cfg: { titulo, keys, n, rangos, defRango, armar(map, dias) -> { tipo: line|bars, series|points, fmt, ... }, nota }
  function tarjeta(padre, cfg) {
    var card = el("article", "card chartcard" + (cfg.ancho === "full" ? " chartcard--full" : ""));
    var cab = el("div", "chartcard__head");
    cab.appendChild(el("h2", "label", cfg.titulo));
    var acciones = el("div", "chartcard__actions"); cab.appendChild(acciones);
    card.appendChild(cab);
    var rbox = el("div", "chips chips--sm");
    var cuerpo = el("div", "chart");
    var pie = el("p", "hint");
    if (cfg.rangos) card.appendChild(rbox);
    card.appendChild(cuerpo); card.appendChild(pie);
    padre.appendChild(card);

    var rango = cfg.defRango === undefined ? (cfg.rangos ? cfg.rangos[0][1] : 0) : cfg.defRango;
    var mapa = null;

    function pintarRangos() {
      rbox.textContent = "";
      (cfg.rangos || []).forEach(function (r) { rbox.appendChild(chip(r[0], r[1] === rango, function () { rango = r[1]; pintarRangos(); dibujar(); })); });
    }

    function dibujar() {
      var v = cfg.armar(mapa, rango);
      if (!v) { cuerpo.textContent = ""; cuerpo.appendChild(el("p", "chart__empty", "No hay datos disponibles.")); return; }
      if (v.tipo === "bars") C.bars(cuerpo, { points: v.points, fmt: v.fmt, tickFmt: v.tickFmt, color: v.color, titulo: cfg.titulo, height: 240 });
      else C.line(cuerpo, { series: v.series, fmt: v.fmt, tickFmt: v.tickFmt, zero: v.zero, area: v.area, titulo: cfg.titulo, height: 260 });
      var series = v.series || [mk("x", "", 1, cfg.titulo, v.points, "BCRA")];
      acciones.textContent = "";
      var b = el("button", "btn btn--ghost btn--xs", "CSV"); b.type = "button";
      b.setAttribute("aria-label", "Descargar datos de " + cfg.titulo + " en CSV");
      b.addEventListener("click", function () { C.csv(cfg.csv || cfg.keys[0], series); });
      acciones.appendChild(b);
      var s0 = mapa[cfg.keys[0]];
      pie.textContent = (cfg.nota ? cfg.nota + " " : "") + "Fuente: " + (s0 ? s0.fuente : "BCRA") + (s0 ? ". Último dato: " + fechaDato(s0) + "." : "");
    }

    function cargar() {
      cuerpo.textContent = ""; cuerpo.appendChild(esqueleto(cfg.alto || 240));
      S.cargarVarias(cfg.keys, cfg.n || 800).then(function (r) {
        mapa = r.series;
        if (!cfg.keys.some(function (k) { return mapa[k]; })) {
          cuerpo.textContent = "";
          var err = el("div", "chart__error"); err.appendChild(el("p", "", "No se pudo cargar este gráfico."));
          var b = el("button", "btn btn--ghost btn--sm", "Reintentar"); b.type = "button"; b.addEventListener("click", cargar);
          err.appendChild(b); cuerpo.appendChild(err);
          return;
        }
        pintarRangos(); dibujar();
      });
    }
    cargar();
  }

  /* ---------- Acciones y bonos ---------- */

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

  function armarMercados() {
    var g = el("div", "grid2");
    $("mercados-contenido").appendChild(g);
    tablaMercado(g, "arg_stocks", "Acciones argentinas", "No se pudieron cargar las acciones.");
    tablaMercado(g, "arg_bonds", "Bonos y letras", "No se pudieron cargar los bonos.");
  }

  /* ---------- Banco Central ---------- */

  var FACTORES = [
    ["factCompras", "Compras de divisas al sector privado"], ["factTesoro", "Compras de divisas al Tesoro"], ["factPases", "Operaciones de pases"],
    ["factLeliq", "LELIQ y NOTALQ"], ["factIntereses", "Intereses, primas y cuentas"], ["factOtras", "Otras operaciones"], ["factTotal", "Total"]
  ];

  function tablaFactores(padre) {
    var card = el("article", "card");
    card.appendChild(el("h2", "label", "Qué movió la base monetaria"));
    var cuerpo = el("div"); cuerpo.appendChild(esqueleto(220)); card.appendChild(cuerpo);
    var pie = el("p", "hint"); card.appendChild(pie);
    padre.appendChild(card);
    S.cargarVarias(FACTORES.map(function (f) { return f[0]; }), 400).then(function (r) {
      var t = el("table", "tabla tabla--factores");
      var th = el("thead"), trh = el("tr");
      ["Factor", "Último día", "30 días", "90 días"].forEach(function (x, i) { trh.appendChild(el("th", i ? "num" : "", x)); });
      th.appendChild(trh); t.appendChild(th);
      var tb = el("tbody"), ultima = "";
      FACTORES.forEach(function (f) {
        var s = r.series[f[0]];
        var tr = el("tr", f[0] === "factTotal" ? "total" : "");
        tr.appendChild(el("td", "", f[1]));
        if (!s) { for (var i = 0; i < 3; i++) tr.appendChild(el("td", "num", "-")); }
        else {
          var fmt = function (v) { return (v > 0 ? "+" : "") + fmtUnit("M ARS", v, 0); };
          [s.ultimo.v, suma(s, 30), suma(s, 90)].forEach(function (v) {
            var c = el("td", "num"); c.appendChild(delta(fmt(v), v)); tr.appendChild(c);
          });
          ultima = fechaDato(s);
        }
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      cuerpo.textContent = "";
      var w = el("div", "tabla__wrap"); w.appendChild(t); cuerpo.appendChild(w);
      pie.textContent = "Positivo: el factor expande la base monetaria. Negativo: la contrae. Fuente: BCRA. Último dato: " + (ultima || "sin dato") + ".";
    });
  }

  var PRIORIDAD = ["USD", "EUR", "BRL", "CLP", "UYU", "CNY", "GBP", "JPY", "CHF", "MXN"];

  function tablaMonedas(padre) {
    var card = el("article", "card");
    card.appendChild(el("h2", "label", "Cotizaciones de monedas del BCRA"));
    var buscar = el("input", "mkt__search"); buscar.type = "search"; buscar.placeholder = "Buscar moneda"; buscar.setAttribute("aria-label", "Buscar moneda");
    card.appendChild(buscar);
    var cuerpo = el("div"); cuerpo.appendChild(esqueleto(240)); card.appendChild(cuerpo);
    var pie = el("p", "hint"); card.appendChild(pie);
    padre.appendChild(card);
    var datos = [];

    function dibujar() {
      var q = buscar.value.trim().toLowerCase();
      var f = datos.filter(function (d) { return !q || d.codigoMoneda.toLowerCase().indexOf(q) !== -1 || d.descripcion.toLowerCase().indexOf(q) !== -1; });
      cuerpo.textContent = "";
      if (!f.length) { cuerpo.appendChild(el("p", "chart__empty", "Sin resultados.")); return; }
      var t = el("table", "tabla");
      var th = el("thead"), trh = el("tr");
      ["Moneda", "En pesos", "En dólares"].forEach(function (x, i) { trh.appendChild(el("th", i ? "num" : "", x)); });
      th.appendChild(trh); t.appendChild(th);
      var tb = el("tbody");
      f.forEach(function (d) {
        var tr = el("tr");
        var c = el("td"); c.appendChild(el("b", "mkt__sym", d.codigoMoneda)); c.appendChild(document.createTextNode(" " + d.descripcion.toLowerCase().replace(/^./, function (m) { return m.toUpperCase(); }))); tr.appendChild(c);
        tr.appendChild(el("td", "num", "$ " + num(d.tipoCotizacion, d.tipoCotizacion < 10 ? 3 : 2)));
        tr.appendChild(el("td", "num", d.tipoPase > 0 ? "US$ " + num(d.tipoPase, d.tipoPase < 0.1 ? 4 : 3) : "-"));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      var w = el("div", "tabla__wrap tabla__wrap--alto"); w.appendChild(t); cuerpo.appendChild(w);
    }
    buscar.addEventListener("input", dibujar);

    S.monedas().then(function (r) {
      datos = r.detalle.filter(function (d) { return d.tipoCotizacion > 0; }).sort(function (a, b) {
        var ia = PRIORIDAD.indexOf(a.codigoMoneda), ib = PRIORIDAD.indexOf(b.codigoMoneda);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return a.descripcion < b.descripcion ? -1 : 1;
      });
      dibujar();
      pie.textContent = "Cotización en pesos de cada moneda y su valor en dólares (tipo de pase). Fuente: BCRA, estadísticas cambiarias, al " + r.fecha + ".";
    }, function () {
      cuerpo.textContent = "";
      var err = el("div", "chart__error"); err.appendChild(el("p", "", "No se pudieron cargar las cotizaciones."));
      var b = el("button", "btn btn--ghost btn--sm", "Reintentar"); b.type = "button"; b.addEventListener("click", function () { padre.removeChild(card); tablaMonedas(padre); });
      err.appendChild(b); cuerpo.appendChild(err);
    });
  }

  var bcraMesa = null;

  function armarBCRA() {
    var raiz = $("bcra-contenido");
    bcraMesa = crearMesa({ filas: FILAS_BCRA, raiz: raiz, vista: "bcra" });
    bcraMesa.armar();

    var g = el("div", "grid2"); raiz.appendChild(g);
    var rangosTasa = [["3 meses", 90], ["6 meses", 180], ["1 año", 365]];
    tarjeta(g, { titulo: "Tasas de interés del mercado (TNA)", keys: ["badlar", "tamar", "tasaPases", "tasaAdelantos"], n: 800, rangos: rangosTasa, defRango: 180, csv: "tasas-bcra",
      armar: function (m, d) {
        var a = ["badlar", "tamar", "tasaPases", "tasaAdelantos"].map(function (k) { return m[k] ? recortar(m[k], d) : null; }).filter(Boolean);
        return a.length ? { tipo: "line", series: a, fmt: function (x) { return num(x, 1) + "%"; } } : null;
      } });
    tarjeta(g, { titulo: "Compras de divisas (USD millones por día)", keys: ["comprasDivisas"], n: 800, rangos: [["30 días", 30], ["90 días", 90], ["1 año", 365]], defRango: 90,
      nota: "Azul: el BCRA compró. Naranja: vendió.",
      armar: function (m, d) {
        return m.comprasDivisas ? { tipo: "bars", points: recortar(m.comprasDivisas, d).points, fmt: function (x) { return num(x, 0) + " M"; }, color: function (v) { return v >= 0 ? "var(--c1)" : "var(--c2)"; } } : null;
      } });
    tarjeta(g, { titulo: "Tipo de cambio: mayorista y minorista", keys: ["tcMay", "tcMin"], n: 800, rangos: [["3 meses", 90], ["1 año", 365], ["2 años", 730]], defRango: 365, csv: "tipo-de-cambio-bcra",
      armar: function (m, d) {
        var a = ["tcMay", "tcMin"].map(function (k) { return m[k] ? recortar(m[k], d) : null; }).filter(Boolean);
        return a.length ? { tipo: "line", series: a, fmt: function (x) { return "$ " + num(x, 0); } } : null;
      } });
    tarjeta(g, { titulo: "Depósitos por tipo (billones de pesos)", keys: ["depCC", "depCA", "depPlazo"], n: 800, rangos: [["6 meses", 180], ["1 año", 365], ["2 años", 730]], defRango: 365, csv: "depositos-bcra",
      armar: function (m, d) {
        var a = ["depCC", "depCA", "depPlazo"].map(function (k) {
          if (!m[k]) return null; var r = recortar(m[k], d);
          var o = {}; Object.keys(r).forEach(function (x) { o[x] = r[x]; }); o.points = r.points.map(function (p) { return [p[0], p[1] / 1e6]; }); o.unit = "bill."; o.dec = 2; return o;
        }).filter(Boolean);
        return a.length ? { tipo: "line", series: a, fmt: function (x) { return num(x, 1) + " bill."; } } : null;
      } });
    tarjeta(g, { titulo: "Crédito por tipo (billones de pesos)", keys: ["credAdelantos", "credDocumentos", "credHipotecarios", "credPrendarios"], n: 800, rangos: [["6 meses", 180], ["1 año", 365], ["2 años", 730]], defRango: 365, csv: "credito-bcra",
      armar: function (m, d) {
        var a = ["credAdelantos", "credDocumentos", "credHipotecarios", "credPrendarios"].map(function (k) {
          if (!m[k]) return null; var r = recortar(m[k], d);
          var o = {}; Object.keys(r).forEach(function (x) { o[x] = r[x]; }); o.points = r.points.map(function (p) { return [p[0], p[1] / 1e6]; }); o.unit = "bill."; o.dec = 2; return o;
        }).filter(Boolean);
        return a.length ? { tipo: "line", series: a, fmt: function (x) { return num(x, 1) + " bill."; } } : null;
      } });

    var g2 = el("div", "grid2"); raiz.appendChild(g2);
    tablaFactores(g2);
    tablaMonedas(g2);
  }

  /* ---------- API ---------- */

  var tableroMesa = null, mercadosListo = false;

  function mostrar(vista, sub) {
    if (vista === "tablero") {
      if (!tableroMesa) {
        tableroMesa = crearMesa({ filas: FILAS_TABLERO, raiz: $("mesa-tablero"), vista: "tablero" });
        tableroMesa.armar();
      }
      if (sub) tableroMesa.abrir(sub); else tableroMesa.cerrar();
    } else if (vista === "bcra") {
      if (!bcraMesa) armarBCRA();
      if (sub) bcraMesa.abrir(sub); else bcraMesa.cerrar();
    } else if (vista === "mercados") {
      if (!mercadosListo) { mercadosListo = true; armarMercados(); }
    }
  }

  window.EconoTablero = { mostrar: mostrar };
})();
