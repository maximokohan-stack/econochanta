/*
 * Mesas de indicadores (lista a la izquierda, detalle a la derecha). Hay una por seccion de Argentina
 * (Dolares, Inflacion y reservas, Tasas y pesos, Cuentas del Estado, Actividad y empleo) y otra del Banco Central,
 * mas la portada y la vista Acciones y bonos.
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
    var n = s.points.length, paso = n > 2 ? (new Date(s.points[n - 1][0]).getTime() - new Date(s.points[0][0]).getTime()) / 86400000 / (n - 1) : 0;
    if (paso > 70 && paso < 120) return (Math.floor(d.getMonth() / 3) + 1) + "º trim " + d.getFullYear();
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

  // suma que se reinicia cada enero
  function acumAnual(pts) {
    var anio = "", acc = 0;
    return pts.map(function (p) { var a = p[0].slice(0, 4); if (a !== anio) { anio = a; acc = 0; } acc += p[1]; return [p[0], acc]; });
  }
  // suma de los ultimos n datos (12 por defecto)
  function movil12(pts, n) {
    var k = n || 12, out = [];
    for (var i = k - 1; i < pts.length; i++) {
      var t = 0; for (var j = i - k + 1; j <= i; j++) t += pts[j][1];
      out.push([pts[i][0], t]);
    }
    return out;
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

    { id: "resPrim", g: "Fiscal", label: "Resultado primario", key: "resPrimario", t: "abs", bars: true, signed: true },
    { id: "resFin", g: "Fiscal", label: "Resultado financiero", derive: "resFin", t: "abs", bars: true, signed: true },
    { id: "intereses", g: "Fiscal", label: "Intereses netos de la deuda", key: "fIntereses", t: "level", bars: true },
    { id: "resPrimAcum", g: "Fiscal", label: "Resultado primario, acumulado del año", derive: "resPrimAcum", t: "abs", signed: true },
    { id: "resFinAcum", g: "Fiscal", label: "Resultado financiero, acumulado del año", derive: "resFinAcum", t: "abs", signed: true },
    { id: "resPrim12", g: "Fiscal", label: "Resultado primario, últimos 12 meses", derive: "resPrim12", t: "abs", signed: true },
    { id: "resFin12", g: "Fiscal", label: "Resultado financiero, últimos 12 meses", derive: "resFin12", t: "abs", signed: true },
    { id: "recaud", g: "Fiscal", label: "Recaudación tributaria", key: "recaudacion", t: "level" },
    { id: "recaudIA", g: "Fiscal", label: "Recaudación, variación interanual", key: "recaudacionIA", t: "rate" },
    { id: "iva", g: "Fiscal", label: "IVA, neto de reintegros", key: "fIva", t: "level" },
    { id: "ganancias", g: "Fiscal", label: "Impuesto a las Ganancias", key: "fGanancias", t: "level" },
    { id: "aportes", g: "Fiscal", label: "Aportes y contribuciones a la seguridad social", key: "fAportes", t: "level" },
    { id: "derExp", g: "Fiscal", label: "Derechos de exportación", key: "fDerExp", t: "level" },
    { id: "debCred", g: "Fiscal", label: "Impuesto a los débitos y créditos bancarios", key: "fDebCred", t: "level" },
    { id: "bienesPers", g: "Fiscal", label: "Bienes personales", key: "fBienesPers", t: "level" },
    { id: "jubil", g: "Fiscal", label: "Jubilaciones y pensiones contributivas", key: "fJubil", t: "level" },
    { id: "pami", g: "Fiscal", label: "Prestaciones del PAMI (INSSJP)", key: "fPami", t: "level" },
    { id: "asig", g: "Fiscal", label: "Asignaciones familiares y universales", key: "fAsig", t: "level" },
    { id: "pensNC", g: "Fiscal", label: "Pensiones no contributivas", key: "fPensNC", t: "level" },
    { id: "salEstado", g: "Fiscal", label: "Salarios del Estado nacional", key: "fSalarios", t: "level" },

    { id: "bpCC", g: "Balance de pagos", label: "Cuenta corriente", key: "bpCC", t: "abs", bars: true, signed: true },
    { id: "bpCC12", g: "Balance de pagos", label: "Cuenta corriente, últimos 4 trimestres", derive: "bpCC12", t: "abs", signed: true },
    { id: "bpCF", g: "Balance de pagos", label: "Cuenta financiera", key: "bpCF", t: "abs", bars: true, signed: true },
    { id: "bpCap", g: "Balance de pagos", label: "Cuenta capital", key: "bpCap", t: "abs", bars: true, signed: true },
    { id: "bpBienes", g: "Balance de pagos", label: "Balance de bienes", key: "bpBienes", t: "abs", bars: true, signed: true },
    { id: "bpServicios", g: "Balance de pagos", label: "Balance de servicios", key: "bpServicios", t: "abs", bars: true, signed: true },
    { id: "bpIngresos", g: "Balance de pagos", label: "Ingresos primarios y secundarios", derive: "bpIngresos", t: "abs", bars: true, signed: true },
    { id: "bpEyO", g: "Balance de pagos", label: "Errores y omisiones netos", key: "bpEyO", t: "abs", bars: true, signed: true },
    { id: "bpReservas", g: "Balance de pagos", label: "Activos de reserva (variación)", key: "bpReservas", t: "abs", bars: true, signed: true },
    { id: "expo", g: "Comercio exterior", label: "Exportaciones", key: "expo", t: "level" },
    { id: "impo", g: "Comercio exterior", label: "Importaciones", key: "impo", t: "level" },
    { id: "saldo", g: "Comercio exterior", label: "Saldo comercial", derive: "saldo", t: "abs", bars: true, signed: true },

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

  /* ---------- secciones de Argentina (la estructura sigue a la de pulsomacro) ---------- */

  var DEFS = {};
  FILAS_TABLERO.concat(FILAS_BCRA).forEach(function (f) { if (!DEFS[f.id]) DEFS[f.id] = f; });

  // cada seccion abre su propia mesa; los grupos de abajo son los filtros de esa mesa
  var SECCIONES = [
    { id: "dolares", nombre: "Dólares", desc: "Oficial, MEP, CCL y blue, la brecha y las compras del BCRA",
      titulo: "Dólares de un vistazo", clave: ["oficial", "mep", "ccl", "blue", "brecha", "tcMay", "compras"],
      grupos: [["Cotizaciones", ["oficial", "mep", "ccl", "blue", "tcMay"]], ["Brecha", ["brecha"]], ["Compras del BCRA", ["compras"]]] },
    { id: "inflacion", nombre: "Inflación y reservas", desc: "Precios, núcleo y regulados, rubros, UVA y CER, reservas y riesgo país",
      titulo: "Inflación y reservas de un vistazo", clave: ["infM", "infIA", "nucleo", "regulados", "reservas", "riesgo"],
      grupos: [["Inflación", ["infM", "infIA", "nucleo", "regulados", "estacionales"]],
        ["Inflación por rubro", ["transporte", "salud", "educacion", "prendas", "equipamiento", "comunicaciones", "bebidas"]],
        ["Índices de ajuste", ["uva", "cer"]], ["Reservas y riesgo país", ["reservas", "reservasSinDEG", "riesgo"]]] },
    { id: "tasas", nombre: "Tasas y pesos", desc: "Tasas en pesos, base monetaria, depósitos y préstamos",
      titulo: "Tasas y pesos de un vistazo", clave: ["badlar", "tamar", "tasaDep", "base", "depositos", "prestamos"],
      grupos: [["Tasas en pesos", ["badlar", "tamar", "tasaDep", "tasaPers"]], ["Base monetaria y agregados", ["base", "circ", "m2", "depositos", "prestamos"]]] },
    { id: "estado", nombre: "Cuentas del Estado", desc: "Resultado fiscal, ingresos y gastos en tortas, comercio exterior y balance de pagos (cuenta corriente y financiera)",
      titulo: "Cuentas del Estado de un vistazo", clave: ["resPrim", "resFin", "resPrim12", "recaud", "iva", "jubil", "saldo"],
      grupos: [["Resultado fiscal", ["resPrim", "resFin", "intereses", "resPrimAcum", "resFinAcum", "resPrim12", "resFin12"]],
        ["Ingresos", ["recaud", "recaudIA", "iva", "ganancias", "aportes", "derExp", "debCred", "bienesPers"]],
        ["Gastos", ["jubil", "pami", "asig", "pensNC", "salEstado"]],
        ["Comercio exterior", ["expo", "impo", "saldo"]],
        ["Balance de pagos", ["bpCC", "bpCC12", "bpCF", "bpCap", "bpBienes", "bpServicios", "bpIngresos", "bpEyO", "bpReservas"]]] },
    { id: "actividad", nombre: "Actividad y empleo", desc: "EMAE, industria, construcción, PBI, desocupación y salarios",
      titulo: "Actividad y empleo de un vistazo", clave: ["emae", "ipi", "cemento", "pbi", "desoc", "salarios", "smvm"],
      grupos: [["Actividad", ["emae", "ipi", "cemento", "pbi"]], ["Empleo", ["desoc"]],
        ["Salarios y haberes", ["salarios", "salPriv", "salNoReg", "salPub", "ripte", "smvm", "haber"]]] }
  ];
  var SEC_OTRAS = [
    { id: "bcra", nombre: "Banco Central", desc: "Reservas, base monetaria, tasas, depósitos, crédito y 39 monedas" },
    { id: "mercados", nombre: "Acciones y bonos", desc: "Acciones líderes y bonos soberanos en vivo, con búsqueda" }
  ];

  function filasDe(sec) {
    var out = [];
    sec.grupos.forEach(function (gr) {
      gr[1].forEach(function (id) {
        var d = DEFS[id], c = {};
        Object.keys(d).forEach(function (k) { c[k] = d[k]; });
        c.g = gr[0]; out.push(c);
      });
    });
    return out;
  }

  // a que seccion pertenece cada indicador (para los links de la portada y los links viejos #tablero:id)
  var SEC_DE = {};
  SECCIONES.forEach(function (s) { s.grupos.forEach(function (g) { g[1].forEach(function (id) { if (!SEC_DE[id]) SEC_DE[id] = s.id; }); }); });

  /* ---------- mesa (lista de indicadores a la izquierda, detalle a la derecha) ---------- */

  // Hacia que lado esta "lo bueno" de cada indicador. Lo que no figura se muestra neutro.
  var MAL_SI_SUBE = ["brecha", "infM", "infIA", "nucleo", "regulados", "estacionales", "transporte", "salud", "educacion", "prendas",
    "equipamiento", "comunicaciones", "bebidas", "desoc", "riesgo", "intereses"];
  var BIEN_SI_SUBE = ["emae", "ipi", "cemento", "pbi", "salarios", "salPriv", "salNoReg", "salPub", "ripte", "smvm", "haber",
    "bpCC", "bpCC12", "bpBienes", "resPrim", "resFin", "resPrimAcum", "resFinAcum", "resPrim12", "resFin12", "bpCC", "bpCC12", "bpBienes", "recaud", "expo", "saldo", "reservas", "reservasSinDEG", "compras"];

  function sentidoDe(id) { return MAL_SI_SUBE.indexOf(id) !== -1 ? "mal" : BIEN_SI_SUBE.indexOf(id) !== -1 ? "bien" : "neutro"; }

  // clase de color de una variacion segun el sentido del indicador
  function tonoDe(sentido, v) {
    if (v === undefined || v === null || Math.abs(v) < 0.0001) return "flat";
    if (sentido === "neutro") return "tono-neutro";
    return (v > 0) === (sentido === "bien") ? "tono-bien" : "tono-mal";
  }
  // una variacion que se muestra como cero (por ejemplo -0,0 pp) no es una suba ni una baja
  function esNulo(txt) {
    if (txt === undefined) return false;
    var n = parseFloat(String(txt).replace(/[^0-9,.\-]/g, "").replace(",", "."));
    return n === 0;
  }
  function flechaDe(txt, v) { return esNulo(txt) ? "■ " : flecha(v); }
  function colorSpark(clase) { return clase === "tono-bien" ? "var(--up)" : clase === "tono-mal" ? "var(--down)" : "var(--text-2)"; }

  var FAVS_KEY = "econochanta:v1:favoritos";
  var favs = {};
  try { favs = JSON.parse(localStorage.getItem(FAVS_KEY) || "{}") || {}; } catch (e) { favs = {}; }
  function guardarFavs() { try { localStorage.setItem(FAVS_KEY, JSON.stringify(favs)); } catch (e) { /* sin storage */ } }
  var mesas = [];

  function anunciar(texto) { var a = $("anuncio"); if (a) { a.textContent = ""; setTimeout(function () { a.textContent = texto; }, 30); } }

  // dias entre un punto y el siguiente, para saber si la serie es diaria, mensual o trimestral
  function pasoDias(s) {
    var n = s.points.length;
    if (n < 3) return 1;
    return (new Date(s.points[n - 1][0]).getTime() - new Date(s.points[0][0]).getTime()) / 86400000 / (n - 1);
  }
  // dias desde el fin del periodo que cubre el ultimo dato (un dato mensual fechado el dia 1 cubre todo el mes)
  function rezagoDias(s) {
    var paso = pasoDias(s);
    var fin = new Date(s.ultimo.d + "T12:00:00").getTime() + (paso > 3 ? paso * 86400000 : 0);
    return Math.max(0, Math.round((Date.now() - fin) / 86400000));
  }
  function esViejo(it) {
    var paso = pasoDias(it.s);
    var limite = paso <= 3 ? 6 : paso <= 40 ? 75 : 150;
    return rezagoDias(it.s) > limite;
  }

  var MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function mesDe(it) { return MESES_LARGO[new Date(it.s.ultimo.d + "T12:00:00").getMonth()]; }
  function sinSigno(t) { return String(t).replace(/^[+\-−]\s?/, ""); }

  // una frase que resume el ultimo movimiento del indicador
  function frase(it) {
    var ref = it.mensual ? "del período anterior" : "de ayer";
    var partes = [];
    if (it.t === "flow") {
      partes.push("El último dato fue de " + it.valor + ".");
      if (it.d12Txt) partes.push("En los últimos 30 días acumula " + it.d12Txt.replace("30 d: ", "") + ".");
      return partes.join(" ");
    }
    if (it.dPrevTxt !== undefined) {
      if (esNulo(it.dPrevTxt)) partes.push("No cambió respecto " + ref + ".");
      else partes.push((it.dPrev > 0 ? "Subió " : "Bajó ") + sinSigno(it.dPrevTxt) + " respecto " + ref + ".");
    }
    if (it.d12Txt) partes.push(/acum/.test(it.d12Txt) ? "Acumula " + sinSigno(it.d12Txt.replace(" acum.", "")) + " en 12 meses." : "Frente a hace 12 meses: " + it.d12Txt + ".");
    return partes.join(" ");
  }

  function rangosDe(it) {
    return it.mensual ? [["2 años", 730], ["3 años", 1095], ["5 años", 1825]] : [["3 meses", 90], ["1 año", 365], ["3 años", 1095], ["5 años", 1825]];
  }

  /* ---------- "que mide y como se lee" ---------- */

  var GUIA_KEY = "econochanta:v1:guia-cerrada";
  function guiaCerrada() { try { return localStorage.getItem(GUIA_KEY) === "1"; } catch (e) { return false; } }
  function guardarGuia(cerrada) { try { localStorage.setItem(GUIA_KEY, cerrada ? "1" : "0"); } catch (e) { /* sin storage */ } }

  // una cuenta con el ultimo dato para que el numero se entienda
  function enNumeros(it) {
    if (!it.s) return null;
    var v = it.s.ultimo.v;
    switch (it.id) {
      case "infM": return "Si la inflación de " + mesDe(it) + " (" + it.valor + ") se repitiera todos los meses, los precios subirían " + num((Math.pow(1 + v / 100, 12) - 1) * 100, 0) + "% en un año.";
      case "infIA": return "Lo que hace un año costaba $100 hoy cuesta, en promedio, $" + num(100 + v, 0) + ".";
      case "riesgo": return "Hoy son " + num(v, 0) + " puntos: Argentina pagaría " + num(v / 100, 2) + " puntos porcentuales por año más que EE. UU.";
      case "brecha": return "Hoy, por cada $100 que cuesta un dólar oficial, el dólar CCL cuesta $" + num(100 + v, 0) + ".";
      case "badlar": case "tamar": case "tasaDep": case "tasaPers":
        return "Una tasa nominal anual de " + it.valor + " equivale a unos " + num(v * 30 / 365, 1) + "% por cada 30 días. Compará ese número con la inflación mensual.";
      default: return null;
    }
  }

  function guiaDe(it, abierta) {
    var g = window.EconoGlosario && window.EconoGlosario[it.id];
    if (!g) return null;
    var d = el("details", "guia");
    d.open = abierta !== undefined ? abierta : !guiaCerrada();
    d.appendChild(el("summary", "guia__titulo", "¿Qué mide y cómo se lee?"));
    [["Qué es", g.q], ["Cómo se mide", g.c], ["Cómo leerlo", g.l]].forEach(function (x) {
      var p = el("p", "guia__p"); p.appendChild(el("b", "", x[0] + ". ")); p.appendChild(document.createTextNode(x[1])); d.appendChild(p);
    });
    var n = enNumeros(it);
    if (n) { var pn = el("p", "guia__p guia__num"); pn.appendChild(el("b", "", "En números de hoy. ")); pn.appendChild(document.createTextNode(n)); d.appendChild(pn); }
    if (g.o) { var po = el("p", "guia__p guia__ojo"); po.appendChild(el("b", "", "Ojo. ")); po.appendChild(document.createTextNode(g.o)); d.appendChild(po); }
    return d;
  }

  /* cfg: { filas, raiz, vista, titulo, clave: [ids de los indicadores del resumen], frases(porId) -> [texto] } */
  function crearMesa(cfg) {
    var filas = cfg.filas, vista = cfg.vista;
    var items = [], porId = {}, pendiente = null;
    var estado = { actual: "resumen", q: "", grupo: "Todos", rango: {}, detalleOk: null };
    var dom = {};
    var hashDe = cfg.hashDe || function (it) { return "#" + vista + ":" + it.id; };

    function armarItem(f, s, extra) {
      var it = f.__it;
      it.s = s; it.ok = true; it.error = false;
      it.sentido = sentidoDe(f.id);
      it.fmt = function (v) { return fmtUnit(s.unit, v, s.dec); };
      it.valor = it.fmt(s.ultimo.v);
      it.fecha = fechaDato(s);
      it.mensual = esMensual(s);
      it.viejo = esViejo(it);
      if (f.t === "flow") {
        if (s.previo) { it.dPrev = s.ultimo.v - s.previo.v; it.dPrevTxt = (it.dPrev > 0 ? "+" : "") + it.fmt(it.dPrev); }
        var acum = suma(s, 30);
        it.d12 = acum; it.d12Txt = "30 d: " + (acum > 0 ? "+" : "") + it.fmt(acum);
      } else if (f.t === "abs") {
        // una diferencia en las mismas unidades (para resultados que pueden ser negativos, donde un porcentaje no tiene sentido)
        var conSigno = function (d) { return (d > 0 ? "+" : "") + it.fmt(d); };
        if (s.previo) { it.dPrev = s.ultimo.v - s.previo.v; it.dPrevTxt = conSigno(it.dPrev); }
        var h0 = valorHace(s, 12);
        if (h0 !== null) { it.d12 = s.ultimo.v - h0; it.d12Txt = conSigno(it.d12); }
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
      it.tonoPrev = esNulo(it.dPrevTxt) ? "flat" : tonoDe(it.sentido, it.dPrev);
      it.tono12 = esNulo(it.d12Txt) ? "flat" : f.t === "flow" ? tonoDe("neutro", it.d12) : tonoDe(it.sentido, it.d12);
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
      if (f.derive === "resFin" || f.derive === "resFinAcum" || f.derive === "resFin12") {
        return Promise.all([S.cargar("resPrimario", 1300), S.cargar("fIntereses", 1300)]).then(function (r) {
          var fin = S.restar(r[0], r[1], f.label);
          var pts = f.derive === "resFinAcum" ? acumAnual(fin.points) : f.derive === "resFin12" ? movil12(fin.points) : fin.points;
          armarItem(f, mk(f.id, "M ARS", 0, f.label, pts, "Secretaría de Hacienda (IMIG)"));
        });
      }
      if (f.derive === "resPrimAcum" || f.derive === "resPrim12") {
        return S.cargar("resPrimario", 1300).then(function (r) {
          var pts = f.derive === "resPrimAcum" ? acumAnual(r.points) : movil12(r.points);
          armarItem(f, mk(f.id, "M ARS", 0, f.label, pts, "Secretaría de Hacienda (IMIG)"));
        });
      }
      if (f.derive === "bpCC12") {
        return S.cargar("bpCC", 1300).then(function (r) { armarItem(f, mk(f.id, "M USD", 0, f.label, movil12(r.points, 4), "INDEC, balance de pagos")); });
      }
      if (f.derive === "bpIngresos") {
        // lo que queda de la cuenta corriente al restar bienes y servicios: intereses, utilidades y transferencias
        return Promise.all([S.cargar("bpCC", 1300), S.cargar("bpBienes", 1300), S.cargar("bpServicios", 1300)]).then(function (r) {
          var b = {}, sv = {};
          r[1].points.forEach(function (p) { b[p[0]] = p[1]; });
          r[2].points.forEach(function (p) { sv[p[0]] = p[1]; });
          var pts = r[0].points.filter(function (p) { return b[p[0]] !== undefined && sv[p[0]] !== undefined; }).map(function (p) { return [p[0], p[1] - b[p[0]] - sv[p[0]]]; });
          armarItem(f, mk(f.id, "M USD", 0, f.label, pts, "INDEC, balance de pagos"));
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

    function etiqueta(it) {
      if (!it.ok) return it.label + ", " + (it.error ? "sin dato" : "cargando");
      var t = it.label + ", " + it.valor;
      if (it.dPrevTxt !== undefined) t += ", " + (esNulo(it.dPrevTxt) ? "sin cambios" : (it.dPrev > 0 ? "sube " : "baja ") + sinSigno(it.dPrevTxt)) + " respecto " + (it.mensual ? "del período anterior" : "de ayer");
      t += ", dato de " + it.fecha;
      if (it.viejo) t += ", desactualizado";
      return t;
    }

    function armarEsqueleto() {
      var m = el("div", "mesa"); dom.mesa = m;
      var lista = el("aside", "mesa__lista"); lista.setAttribute("aria-label", "Indicadores");
      var top = el("div", "mesa__top");
      dom.sub = el("p", "mesa__sub", "Cargando indicadores…"); top.appendChild(dom.sub);
      dom.buscar = el("input", "mesa__buscar"); dom.buscar.type = "search"; dom.buscar.placeholder = "Buscar indicador"; dom.buscar.setAttribute("aria-label", "Buscar indicador");
      top.appendChild(dom.buscar);
      dom.chips = el("div", "chips chips--sm mesa__grupos"); dom.chips.setAttribute("role", "group"); dom.chips.setAttribute("aria-label", "Filtrar por grupo");
      top.appendChild(dom.chips);
      lista.appendChild(top);
      dom.filas = el("div", "mesa__filas"); lista.appendChild(dom.filas);
      m.appendChild(lista);
      dom.detalle = el("section", "mesa__detalle"); dom.detalle.setAttribute("aria-label", "Detalle");
      m.appendChild(dom.detalle);
      cfg.raiz.appendChild(m);
      // los titulos de grupo se pegan justo debajo del buscador, que cambia de alto con el ancho
      var ajustar = function () { lista.style.setProperty("--top-h", top.offsetHeight + "px"); };
      ajustar();
      if (typeof ResizeObserver === "function") new ResizeObserver(ajustar).observe(top);
    }

    function gruposDisponibles() {
      var g = ["Todos"];
      if (Object.keys(favs).some(function (id) { return porId[id]; })) g.push("★ Favoritos");
      filas.forEach(function (f) { if (g.indexOf(f.g) === -1) g.push(f.g); });
      return g;
    }

    function pintarChips() {
      dom.chips.textContent = "";
      gruposDisponibles().forEach(function (g) {
        var n = g === "★ Favoritos" ? Object.keys(favs).filter(function (id) { return porId[id]; }).length : null;
        dom.chips.appendChild(chip(n === null ? g : g + " (" + n + ")", g === estado.grupo, function () { estado.grupo = g; pintarChips(); pintarLista(); }));
      });
    }

    function filaDe(it, esFav) {
      var b = el("button", "fila"); b.type = "button"; b.dataset.id = it.id;
      if (it.id === estado.actual) b.setAttribute("aria-current", "true");
      b.setAttribute("aria-label", etiqueta(it));
      var nombre = el("span", "fila__nombre", (favs[it.id] ? "★ " : "") + it.label);
      b.appendChild(nombre);
      if (it.ok) {
        b.appendChild(el("span", "fila__val", it.valor));
        var sp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        sp.setAttribute("class", "fila__spark"); sp.setAttribute("aria-hidden", "true");
        C.spark(sp, it.spark, colorSpark(it.tonoPrev));
        b.appendChild(sp);
        b.appendChild(el("span", "fila__meta" + (it.viejo ? " fila__meta--viejo" : ""), it.fecha + (it.viejo ? " · desactualizado" : "")));
        b.appendChild(el("span", "fila__chg " + it.tonoPrev, it.dPrevTxt ? flechaDe(it.dPrevTxt, it.dPrev) + it.dPrevTxt : ""));
      } else {
        b.appendChild(el("span", "fila__val fila__msg", it.error ? "sin dato" : "…"));
      }
      b.addEventListener("click", function () { location.hash = hashDe(it); });
      return b;
    }

    function pintarLista() {
      var box = dom.filas; box.textContent = "";
      var resumen = el("button", "fila fila--resumen"); resumen.type = "button"; resumen.dataset.id = "resumen";
      if (estado.actual === "resumen") resumen.setAttribute("aria-current", "true");
      resumen.appendChild(el("span", "fila__nombre", "Resumen del día"));
      resumen.appendChild(el("span", "fila__meta", "Los indicadores clave de un vistazo"));
      resumen.addEventListener("click", function () { location.hash = "#" + vista + ":resumen"; });
      box.appendChild(resumen);

      var lista = items.filter(function (it) {
        if (estado.q && it.label.toLowerCase().indexOf(estado.q) === -1) return false;
        if (estado.grupo === "★ Favoritos") return !!favs[it.id];
        return estado.grupo === "Todos" || it.g === estado.grupo;
      });
      if (estado.grupo === "Todos" && !estado.q) {
        var misFavs = items.filter(function (it) { return favs[it.id]; });
        if (misFavs.length) {
          box.appendChild(el("h3", "mesa__grupo", "★ Favoritos"));
          misFavs.forEach(function (it) { box.appendChild(filaDe(it, true)); });
        }
      }
      var g = "";
      lista.forEach(function (it) {
        if (estado.grupo !== "★ Favoritos" && it.g !== g) { g = it.g; box.appendChild(el("h3", "mesa__grupo", g)); }
        box.appendChild(filaDe(it, false));
      });
      if (!lista.length) box.appendChild(el("p", "mesa__vacio", "Sin resultados."));
    }

    /* ---- resumen ---- */

    function tarjeta(it) {
      var b = el("button", "tarjeta"); b.type = "button";
      b.setAttribute("aria-label", etiqueta(it));
      b.appendChild(el("span", "tarjeta__nombre", it.label));
      if (it.ok) {
        // el recuadro se pinta segun si el ultimo movimiento mejora o empeora, y mas intenso cuanto mas se movio
        var esc = it.t === "rate" ? 1.5 : it.t === "level" ? 2 : (Math.abs(it.s.ultimo.v) || 1) * 0.8;
        b.classList.add(it.tonoPrev === "tono-bien" ? "calor-bien" : it.tonoPrev === "tono-mal" ? "calor-mal" : "calor-neutro");
        b.style.setProperty("--k", Math.min(1, Math.abs(it.dPrev || 0) / esc).toFixed(2));
        b.appendChild(el("span", "tarjeta__val", it.valor));
        b.appendChild(el("span", "tarjeta__chg " + it.tonoPrev, it.dPrevTxt ? flechaDe(it.dPrevTxt, it.dPrev) + it.dPrevTxt : "sin variación"));
        var sp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        sp.setAttribute("class", "tarjeta__spark"); sp.setAttribute("aria-hidden", "true");
        C.spark(sp, it.spark, colorSpark(it.tonoPrev));
        b.appendChild(sp);
      } else b.appendChild(el("span", "tarjeta__val tarjeta__val--msg", it.error ? "sin dato" : "…"));
      b.addEventListener("click", function () { location.hash = hashDe(it); });
      return b;
    }

    function pintarResumen() {
      var box = dom.detalle; box.textContent = "";
      var volver = el("button", "mesa__volver", "← Indicadores"); volver.type = "button";
      volver.addEventListener("click", function () { location.hash = "#" + vista; });
      box.appendChild(volver);
      box.appendChild(el("div", "kicker", "Resumen"));
      var h = el("h2", "mesa__titulo", cfg.titulo); h.tabIndex = -1; box.appendChild(h);
      var frases = (cfg.frases ? cfg.frases(porId) : []).filter(Boolean);
      if (frases.length) {
        var ul = el("ul", "resumen__frases");
        frases.forEach(function (t) { ul.appendChild(el("li", "", t)); });
        box.appendChild(ul);
      } else box.appendChild(el("p", "hint", "Cargando datos…"));

      var misFavs = items.filter(function (it) { return favs[it.id]; });
      if (misFavs.length) {
        box.appendChild(el("h3", "resumen__sub", "★ Tus favoritos"));
        var gf = el("div", "tarjetas"); misFavs.forEach(function (it) { gf.appendChild(tarjeta(it)); }); box.appendChild(gf);
      }
      box.appendChild(el("h3", "resumen__sub", "Indicadores clave"));
      var gc = el("div", "tarjetas");
      cfg.clave.forEach(function (id) { if (porId[id]) gc.appendChild(tarjeta(porId[id])); });
      box.appendChild(gc);
      box.appendChild(el("p", "leyenda", "▲ sube · ▼ baja. Verde: mejora para la economía. Rojo: empeora. Gris: no se califica (el dólar, las tasas o los agregados monetarios, por ejemplo). Tocá un indicador para ver su gráfico, qué mide y cómo se lee, y para marcarlo como favorito."));
    }

    /* ---- detalle ---- */

    function pintarDetalle() {
      var it = porId[estado.actual];
      var box = dom.detalle; box.textContent = "";
      if (!it) return;
      var volver = el("button", "mesa__volver", "← Indicadores"); volver.type = "button";
      volver.addEventListener("click", function () { location.hash = "#" + vista; });
      box.appendChild(volver);

      var cab = el("div", "mesa__cab");
      var tit = el("div");
      tit.appendChild(el("div", "kicker", it.g));
      var h = el("h2", "mesa__titulo", it.label); h.tabIndex = -1; tit.appendChild(h);
      cab.appendChild(tit);
      var acc = el("div", "mesa__acciones");
      var fav = el("button", "btn btn--ghost btn--xs", favs[it.id] ? "★ Favorito" : "☆ Marcar favorito"); fav.type = "button";
      fav.setAttribute("aria-pressed", favs[it.id] ? "true" : "false");
      fav.addEventListener("click", function () {
        if (favs[it.id]) delete favs[it.id]; else favs[it.id] = true;
        guardarFavs();
        anunciar(favs[it.id] ? it.label + " agregado a favoritos" : it.label + " quitado de favoritos");
        mesas.forEach(function (m) { m.refrescarFavs(); });
        pintarDetalle();
        var b = box.querySelector(".mesa__acciones .btn"); if (b) b.focus();
      });
      acc.appendChild(fav);
      var cp = el("button", "btn btn--ghost btn--xs", "Copiar link"); cp.type = "button";
      cp.addEventListener("click", function () {
        var url = location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { anunciar("Link copiado"); cp.textContent = "Link copiado"; setTimeout(function () { cp.textContent = "Copiar link"; }, 1800); }, function () { anunciar("No se pudo copiar el link"); });
        else anunciar("Tu navegador no permite copiar automáticamente");
      });
      acc.appendChild(cp);
      cab.appendChild(acc);
      box.appendChild(cab);

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
      box.appendChild(el("p", "mesa__frase", frase(it)));
      var chg = el("div", "pastillas");
      if (it.dPrevTxt) chg.appendChild(el("span", "pastilla " + it.tonoPrev, flechaDe(it.dPrevTxt, it.dPrev) + it.dPrevTxt + (it.mensual ? " vs período anterior" : " vs día anterior")));
      if (it.d12Txt) chg.appendChild(el("span", "pastilla " + it.tono12, flechaDe(it.d12Txt, it.d12) + it.d12Txt + (it.t === "flow" ? "" : " en 12 meses")));
      var dias = rezagoDias(it.s);
      chg.appendChild(el("span", "pastilla " + (it.viejo ? "viejo" : "flat"), "Dato de " + it.fecha + (it.viejo ? " (hace " + dias + " días, desactualizado)" : "")));
      box.appendChild(chg);

      var guia = guiaDe(it);
      if (guia) {
        guia.addEventListener("toggle", function () { guardarGuia(!guia.open); });
        box.appendChild(guia);
      }

      var rs = rangosDe(it);
      var rg = estado.rango[it.id];
      if (!rg || !rs.some(function (r) { return r[1] === rg; })) rg = rs[Math.min(1, rs.length - 1)][1];
      var rbox = el("div", "chips chips--sm"); rbox.setAttribute("role", "group"); rbox.setAttribute("aria-label", "Período");
      rs.forEach(function (r) { rbox.appendChild(chip(r[0], r[1] === rg, function () { estado.rango[it.id] = r[1]; pintarDetalle(); var b = dom.detalle.querySelector('.chips[aria-label="Período"] .chip[aria-pressed="true"]'); if (b) b.focus(); })); });
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
      var c1 = el("th", "", "Fecha"); c1.scope = "col"; var c2 = el("th", "num", it.label); c2.scope = "col";
      trh.appendChild(c1); trh.appendChild(c2); th.appendChild(trh);
      t.appendChild(el("caption", "sr-only", "Últimos 12 datos de " + it.label));
      t.appendChild(th);
      var tb = el("tbody");
      it.s.points.slice(-12).reverse().forEach(function (p) {
        var r = el("tr"); r.appendChild(el("td", "", C.fechaLarga(p[0], it.mensual))); r.appendChild(el("td", "num", it.fmt(p[1]))); tb.appendChild(r);
      });
      t.appendChild(tb);
      var w = el("div", "tabla__wrap"); w.appendChild(t); box.appendChild(w);

      var tools = el("div", "mesa__pie");
      tools.appendChild(el("span", "hint", "Fuente: " + (it.s.fuente || "datos públicos") + (it.sentido === "neutro" ? ". Este indicador no se califica con colores." : "")));
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

    function pintarVista() { if (estado.actual === "resumen") pintarResumen(); else pintarDetalle(); }

    function actualizarSub() {
      var n = items.filter(function (i) { return i.ok; }).length;
      dom.sub.textContent = n + " de " + items.length + " indicadores · datos al " + new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long" });
    }

    function programarPintar() {
      if (pendiente) return;
      pendiente = setTimeout(function () {
        pendiente = null;
        pintarLista();
        if (estado.actual === "resumen") pintarResumen();
        else { var it = porId[estado.actual]; if (it && it.ok && estado.detalleOk !== it.id) pintarDetalle(); }
        actualizarSub();
        if (cfg.alCambiar) cfg.alCambiar();
      }, 120);
    }

    function iniciarFila(f) {
      var it = f.__it;
      return cargarFila(f).then(programarPintar, function () { it.error = true; it.ok = false; programarPintar(); });
    }

    function seleccionar(id) {
      if (id !== "resumen" && !porId[id]) return;
      estado.actual = id; estado.detalleOk = null;
      pintarLista(); pintarVista();
    }

    // flechas arriba y abajo recorren la lista sin salir de ella
    function teclado(ev) {
      var k = ev.key;
      if (k !== "ArrowDown" && k !== "ArrowUp" && k !== "Home" && k !== "End") return;
      var filasDom = [].slice.call(dom.filas.querySelectorAll(".fila"));
      if (!filasDom.length) return;
      var i = filasDom.indexOf(document.activeElement);
      if (ev.target === dom.buscar) { if (k !== "ArrowDown") return; i = -1; }
      else if (i === -1) return;
      ev.preventDefault();
      var n = k === "ArrowDown" ? Math.min(filasDom.length - 1, i + 1) : k === "ArrowUp" ? Math.max(0, i - 1) : k === "Home" ? 0 : filasDom.length - 1;
      filasDom[n].focus();
    }

    function armar() {
      filas.forEach(function (f) {
        var it = { id: f.id, g: f.g, label: f.label, t: f.t, ok: false, bars: f.bars, signed: f.signed, sentido: sentidoDe(f.id), __f: f };
        f.__it = it; items.push(it); porId[f.id] = it;
      });
      armarEsqueleto();
      pintarChips();
      seleccionar("resumen");
      dom.buscar.addEventListener("input", function (e) { estado.q = e.target.value.trim().toLowerCase(); pintarLista(); });
      dom.buscar.addEventListener("keydown", teclado);
      dom.filas.addEventListener("keydown", teclado);
      if (!cfg.sinRegistro) mesas.push({ refrescarFavs: function () { if (estado.grupo === "★ Favoritos" && !Object.keys(favs).some(function (id) { return porId[id]; })) estado.grupo = "Todos"; pintarChips(); pintarLista(); if (estado.actual === "resumen") pintarResumen(); } });
      filas.forEach(iniciarFila);
    }

    function esMovil() { return window.matchMedia("(max-width: 820px)").matches; }

    // abrir un indicador (o el resumen) desde la URL; en celular ocupa toda la pantalla
    function abrir(id) {
      if (id !== "resumen" && !porId[id]) return;
      dom.mesa.classList.add("showing");
      if (estado.actual !== id) seleccionar(id);
      if (esMovil()) {
        window.scrollTo(0, 0);
        var h = dom.detalle.querySelector(".mesa__titulo"); if (h) h.focus({ preventScroll: true });
      }
    }

    // volver a la lista; devuelve el foco a la fila que se estaba mirando
    function cerrar() {
      if (!dom.mesa || !dom.mesa.classList.contains("showing")) return;
      dom.mesa.classList.remove("showing");
      var fila = dom.filas.querySelector('.fila[aria-current="true"]');
      if (fila && esMovil()) fila.focus({ preventScroll: true });
    }

    return { armar: armar, abrir: abrir, cerrar: cerrar, tarjeta: tarjeta, items: items, porId: porId };
  }


  /* ---------- textos del resumen ---------- */

  var CLAVE_BCRA = ["reservas", "tcMay", "base", "badlar", "tamar", "depositos", "prestamos", "m2"];

  function frasesTablero(P) {
    var ok = function (id) { return P[id] && P[id].ok; };
    var out = [];
    if (ok("oficial") && ok("brecha")) out.push("El dólar oficial cotiza a " + P.oficial.valor + (P.oficial.dPrevTxt ? " (" + P.oficial.dPrevTxt + " respecto de ayer)" : "") + " y la brecha del CCL es de " + P.brecha.valor + ".");
    if (ok("infM") && ok("infIA")) out.push("La inflación de " + mesDe(P.infM) + " fue de " + P.infM.valor + " y acumula " + P.infIA.valor + " en doce meses.");
    if (ok("riesgo") && ok("reservas")) out.push("El riesgo país está en " + P.riesgo.valor + " y las reservas suman " + P.reservas.valor + ".");
    if (ok("emae") && ok("desoc")) out.push("La actividad (EMAE) de " + mesDe(P.emae) + " " + (P.emae.d12 >= 0 ? "creció " : "cayó ") + sinSigno(P.emae.d12Txt) + " frente a un año atrás y la desocupación es de " + P.desoc.valor + ".");
    return out;
  }

  function frasesBCRA(P) {
    var ok = function (id) { return P[id] && P[id].ok; };
    var out = [];
    if (ok("reservas") && ok("tcMay")) out.push("Las reservas suman " + P.reservas.valor + " y el tipo de cambio mayorista de referencia está en " + P.tcMay.valor + ".");
    if (ok("badlar") && ok("tamar")) out.push("La tasa BADLAR está en " + P.badlar.valor + " y la TAMAR en " + P.tamar.valor + ".");
    if (ok("depositos") && ok("prestamos")) out.push("Los depósitos en efectivo suman " + P.depositos.valor + " y los préstamos al sector privado " + P.prestamos.valor + ".");
    if (ok("compras")) out.push("En los últimos 30 días el BCRA " + (P.compras.d12 >= 0 ? "compró " : "vendió ") + P.compras.fmt(Math.abs(P.compras.d12)) + " en divisas.");
    return out;
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

  function armarBCRA() {
    var raiz = $("bcra-contenido");
    bcraMesa = crearMesa({ filas: FILAS_BCRA, raiz: raiz, vista: "bcra", titulo: "Banco Central de un vistazo", clave: CLAVE_BCRA, frases: frasesBCRA });
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

  /* ---------- frases de cada seccion ---------- */

  var FRASES = {
    dolares: function (P) {
      var ok = function (id) { return P[id] && P[id].ok; };
      var out = [];
      if (ok("oficial") && ok("mep") && ok("ccl") && ok("blue")) out.push("El oficial cotiza a " + P.oficial.valor + ", el MEP a " + P.mep.valor + ", el CCL a " + P.ccl.valor + " y el blue a " + P.blue.valor + ".");
      if (ok("brecha")) out.push("La brecha del CCL con el oficial es de " + P.brecha.valor + ".");
      if (ok("compras")) out.push("En los últimos 30 días el BCRA " + (P.compras.d12 >= 0 ? "compró " : "vendió ") + P.compras.fmt(Math.abs(P.compras.d12)) + " en divisas.");
      return out;
    },
    inflacion: function (P) {
      var ok = function (id) { return P[id] && P[id].ok; };
      var out = [];
      if (ok("infM") && ok("infIA")) out.push("La inflación de " + mesDe(P.infM) + " fue de " + P.infM.valor + " y acumula " + P.infIA.valor + " en doce meses.");
      if (ok("nucleo") && ok("regulados")) out.push("El núcleo subió " + P.nucleo.valor + " en el mes y los regulados " + P.regulados.valor + ".");
      if (ok("riesgo") && ok("reservas")) out.push("El riesgo país está en " + P.riesgo.valor + " y las reservas suman " + P.reservas.valor + ".");
      return out;
    },
    tasas: function (P) {
      var ok = function (id) { return P[id] && P[id].ok; };
      var out = [];
      if (ok("badlar") && ok("tamar")) out.push("La tasa BADLAR está en " + P.badlar.valor + " y la TAMAR en " + P.tamar.valor + ".");
      if (ok("base") && ok("circ")) out.push("La base monetaria es de " + P.base.valor + " y la circulación de " + P.circ.valor + ".");
      if (ok("depositos") && ok("prestamos")) out.push("Los depósitos en efectivo suman " + P.depositos.valor + " y los préstamos al sector privado " + P.prestamos.valor + ".");
      return out;
    },
    estado: function (P) {
      var ok = function (id) { return P[id] && P[id].ok; };
      var out = [];
      if (ok("resPrim") && ok("resFin")) out.push("En " + mesDe(P.resPrim) + " el resultado primario fue de " + P.resPrim.valor + " y el financiero, de " + P.resFin.valor + ".");
      else if (ok("resPrim")) out.push("El resultado primario de " + mesDe(P.resPrim) + " fue de " + P.resPrim.valor + ".");
      if (ok("resPrimAcum")) out.push("En lo que va del año, el resultado primario acumula " + P.resPrimAcum.valor + ".");
      if (ok("recaudIA")) out.push("La recaudación tributaria de " + mesDe(P.recaudIA) + " varió " + P.recaudIA.valor + " frente a un año atrás.");
      if (ok("expo") && ok("impo") && ok("saldo")) out.push("En " + mesDe(P.saldo) + " se exportó " + P.expo.valor + " y se importó " + P.impo.valor + ": saldo comercial de " + P.saldo.valor + ".");
      return out;
    },
    actividad: function (P) {
      var ok = function (id) { return P[id] && P[id].ok; };
      var out = [];
      if (ok("emae") && P.emae.d12Txt) out.push("La actividad (EMAE) de " + mesDe(P.emae) + " " + (P.emae.d12 >= 0 ? "creció " : "cayó ") + sinSigno(P.emae.d12Txt) + " frente a un año atrás.");
      if (ok("desoc")) out.push("La desocupación es de " + P.desoc.valor + ".");
      if (ok("salarios") && P.salarios.d12Txt) out.push("El índice de salarios de " + mesDe(P.salarios) + " varió " + P.salarios.d12Txt + " en doce meses.");
      if (ok("smvm")) out.push("El salario mínimo es de " + P.smvm.valor + ".");
      return out;
    }
  };

  /* ---------- portada y menu de secciones ---------- */

  function tiles(raiz, extra) {
    var ul = el("ul", "menu menu--grid");
    SECCIONES.concat(SEC_OTRAS, extra || []).forEach(function (s) {
      var li = el("li"), a = el("a"); a.href = "#" + s.id;
      a.appendChild(el("strong", "", s.nombre)); a.appendChild(el("span", "", s.desc));
      li.appendChild(a); ul.appendChild(li);
    });
    raiz.appendChild(ul);
  }

  var OTRAS_INICIO = [
    { id: "noticias", nombre: "Noticias", desc: "Titulares de la economía por tema y por medio" },
    { id: "calcular", nombre: "Calculadoras", desc: "Plazo fijo contra dólar, sueldo contra inflación" },
    { id: "miplata", nombre: "Tu plata", desc: "Cómo te afecta todo esto, según tu perfil" },
    { id: "glosario", nombre: "Glosario", desc: "Qué mide cada indicador, cómo se calcula y cómo leerlo" }
  ];
  var IDS_DOLARES = ["oficial", "blue", "mep", "ccl", "brecha"];
  var IDS_DATOS = ["infM", "infIA", "riesgo", "reservas", "emae", "desoc", "resPrim", "saldo"];

  /* ---------- buscador de la portada ---------- */

  // palabras que la gente usa y no estan en el nombre del indicador
  var ALIAS = {
    oficial: "dolar banco nacion cotizacion", mep: "dolar bolsa", ccl: "dolar contado con liqui liquidacion", blue: "dolar paralelo informal cueva",
    brecha: "diferencia dolar cepo", tcMay: "dolar mayorista", compras: "bcra compra dolares divisas reservas",
    infM: "precios ipc suben aumentos costo de vida", infIA: "precios ipc anual aumentos costo de vida", nucleo: "precios ipc", regulados: "tarifas combustibles precios ipc",
    uva: "credito hipotecario alquiler cuota", cer: "ajuste por inflacion indexacion", reservas: "dolares bcra caja", riesgo: "embi bonos deuda confianza",
    badlar: "plazo fijo tasa interes", tamar: "plazo fijo tasa interes", tasaDep: "plazo fijo tasa interes", tasaPers: "prestamo credito tasa interes",
    base: "emision pesos", circ: "billetes efectivo", emae: "actividad pbi economia crece", pbi: "actividad economia crecimiento", desoc: "desempleo trabajo empleo",
    salarios: "sueldos paritarias", ripte: "sueldos", smvm: "sueldo minimo salario minimo", haber: "jubilacion minima jubilados",
    resPrim: "superavit deficit fiscal ahorro gasto", resFin: "superavit deficit fiscal", intereses: "deuda pagos", recaud: "impuestos afip arca",
    iva: "impuesto", ganancias: "impuesto", derExp: "retenciones campo agro impuesto", debCred: "impuesto al cheque", jubil: "jubilados anses gasto",
    pami: "jubilados obra social", asig: "auh hijos anses", pensNC: "pensiones asistencia", salEstado: "empleados publicos sueldos",
    expo: "comercio exterior ventas al exterior", impo: "comercio exterior compras al exterior", saldo: "balanza comercial superavit",
    bpCC: "ccte cta cte cuenta corriente balance de pagos", bpCC12: "ccte cta cte cuenta corriente balance de pagos", bpCF: "financiera cuenta financiera balance de pagos",
    bpCap: "balance de pagos", bpBienes: "balanza comercial balance de pagos", bpServicios: "turismo balance de pagos", bpIngresos: "intereses utilidades remesas balance de pagos",
    bpEyO: "balance de pagos", bpReservas: "balance de pagos"
  };

  function norm(t) { return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  function armarBuscador() {
    var input = $("buscador-input"), lista = $("buscador-lista"), estado = $("buscador-estado");
    if (!input) return;
    var corpus = [];
    SECCIONES.concat(SEC_OTRAS, OTRAS_INICIO).forEach(function (s) {
      corpus.push({ tipo: "seccion", nombre: s.nombre, donde: s.id === "bcra" || s.id === "mercados" || secPorIdTemp(s.id) ? "Argentina" : "Sección", desc: s.desc, href: "#" + s.id, n: norm(s.nombre), x: norm(s.desc) });
    });
    Object.keys(DEFS).forEach(function (id) {
      var d = DEFS[id], g = window.EconoGlosario && window.EconoGlosario[id];
      var sec = SEC_DE[id] ? (SECCIONES.filter(function (x) { return x.id === SEC_DE[id]; })[0] || {}).nombre : "Banco Central";
      corpus.push({ tipo: "indicador", nombre: d.label, donde: "Argentina › " + sec, desc: g ? g.q : "", href: "#" + (SEC_DE[id] || "bcra") + ":" + id,
        n: norm(d.label), x: norm((ALIAS[id] || "") + " " + (g ? g.q + " " + g.c : "")) });
    });
    function secPorIdTemp(id) { return SECCIONES.some(function (x) { return x.id === id; }); }

    var activo = -1;
    function cerrar() { lista.hidden = true; lista.textContent = ""; activo = -1; }

    function buscar() {
      var q = norm(input.value.trim());
      if (q.length < 2) { cerrar(); estado.textContent = ""; return; }
      var pal = q.split(/\s+/);
      var res = [];
      corpus.forEach(function (c) {
        var enNombre = 0, enTexto = 0, ok = true;
        pal.forEach(function (w) {
          if (c.n.indexOf(w) !== -1) enNombre++;
          else if (c.x.indexOf(w) !== -1) enTexto++;
          else ok = false;
        });
        if (!ok) return;
        res.push({ c: c, p: enNombre * 10 + enTexto + (c.tipo === "seccion" ? 5 : 0) + (c.n.indexOf(q) === 0 ? 8 : 0) });
      });
      res.sort(function (a, b) { return b.p - a.p; });
      var vistos = res.slice(0, 10);
      lista.textContent = "";
      lista.hidden = false;
      if (!vistos.length) {
        lista.appendChild(el("li", "buscador__vacio", "No encontré nada para \"" + input.value.trim() + "\". Probá con otra palabra, por ejemplo dólar, inflación o jubilaciones."));
        estado.textContent = "Sin resultados";
        return;
      }
      vistos.forEach(function (r) {
        var li = el("li"), a = el("a"); a.href = r.c.href;
        a.appendChild(el("span", "buscador__nombre", r.c.nombre));
        a.appendChild(el("span", "buscador__donde", r.c.donde));
        if (r.c.desc) a.appendChild(el("span", "buscador__desc", r.c.desc));
        a.addEventListener("click", function () { input.value = ""; cerrar(); });
        li.appendChild(a); lista.appendChild(li);
      });
      estado.textContent = vistos.length + (vistos.length === 1 ? " resultado" : " resultados") + (res.length > vistos.length ? " de " + res.length : "");
    }

    function mover(delta) {
      var enlaces = [].slice.call(lista.querySelectorAll("a"));
      if (!enlaces.length) return;
      var i = enlaces.indexOf(document.activeElement);
      i = i === -1 ? (delta > 0 ? 0 : enlaces.length - 1) : i + delta;
      if (i < 0) { input.focus(); return; }
      if (i >= enlaces.length) i = enlaces.length - 1;
      enlaces[i].focus();
    }

    input.addEventListener("input", buscar);
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { ev.preventDefault(); mover(1); }
      else if (ev.key === "Escape") { input.value = ""; cerrar(); estado.textContent = ""; }
    });
    lista.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { ev.preventDefault(); mover(1); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); mover(-1); }
      else if (ev.key === "Escape") { input.focus(); input.value = ""; cerrar(); estado.textContent = ""; }
    });
  }

  var inicio = null, buscadorListo = false;

  function firmaFavs() { return Object.keys(favs).sort().join(","); }

  function armarInicio() {
    var ids = IDS_DOLARES.concat(IDS_DATOS);
    Object.keys(favs).forEach(function (id) { if (DEFS[id] && ids.indexOf(id) === -1) ids.push(id); });
    var filas = ids.map(function (id) { var c = {}; Object.keys(DEFS[id]).forEach(function (k) { c[k] = DEFS[id][k]; }); c.g = "Inicio"; return c; });
    var cajas = { dolares: $("inicio-dolares"), datos: $("inicio-datos"), frases: $("inicio-frases"), favs: $("inicio-favs") };

    var m = crearMesa({
      filas: filas, raiz: document.createElement("div"), vista: "inicio", titulo: "", clave: [], frases: frasesTablero, sinRegistro: true,
      hashDe: function (it) { return "#" + (SEC_DE[it.id] || "bcra") + ":" + it.id; },
      alCambiar: pintar
    });
    function grupo(caja, lista) {
      caja.textContent = "";
      lista.forEach(function (id) { if (m.porId[id]) caja.appendChild(m.tarjeta(m.porId[id])); });
    }
    function pintar() {
      grupo(cajas.dolares, IDS_DOLARES);
      grupo(cajas.datos, IDS_DATOS);
      cajas.frases.textContent = "";
      frasesTablero(m.porId).forEach(function (t) { cajas.frases.appendChild(el("li", "", t)); });
      var mis = Object.keys(favs).filter(function (id) { return m.porId[id]; });
      $("inicio-favs-bloque").hidden = !mis.length;
      grupo(cajas.favs, mis);
    }
    inicio = { firma: firmaFavs(), pintar: pintar };
    m.armar();
    pintar();
  }

  /* ---------- tortas de ingresos y gastos (Cuentas del Estado) ---------- */

  // cada porcion suma varios rubros del informe de Hacienda (claves de FISCAL_Q en series.js)
  var TORTA_ING = [
    ["IVA", ["iva"]], ["Ganancias", ["ganancias"]], ["Aportes y contribuciones a la seguridad social", ["aportes"]],
    ["Derechos de exportación", ["derExp"]], ["Débitos y créditos bancarios", ["debCred"]], ["Combustibles", ["combust"]],
    ["Bienes personales", ["bienesPers"]], ["Derechos de importación", ["derImp"]],
    ["Otros impuestos", ["impInternos", "restoTrib"]], ["Ingresos no tributarios y otros", ["noTrib", "restoCorr", "transfCorrIng"]],
    ["Rentas de la propiedad", ["rentasFGS", "rentasResto"]], ["Ingresos de capital", ["ingCapital"]]
  ];
  var TORTA_GAS = [
    ["Jubilaciones y pensiones contributivas", ["jubil"]], ["PAMI (INSSJP)", ["pami"]], ["Asignaciones familiares y AUH", ["asignaciones"]],
    ["Pensiones no contributivas", ["pensNC"]], ["Otros programas sociales", ["otrosProg"]],
    ["Subsidios económicos (energía, transporte y otros)", ["subsEnergia", "subsTransp", "subsOtras"]], ["Salarios", ["salarios"]],
    ["Transferencias a provincias", ["tpDesarrollo", "tpEduc", "tpOtras", "tpSalud", "tpSegSocial", "capAguaP", "capEducP", "capEnergP", "capOtrosP", "capTranspP", "capViviP", "ffs"]],
    ["Universidades", ["univ"]], ["Obras y gastos de capital de la Nación", ["capAguaN", "capEducN", "capEnergN", "capOtrosN", "capTranspN", "capViviN"]],
    ["Otros gastos de funcionamiento y corrientes", ["otrosFunc", "defEmpresas", "otrosCorr"]]
  ];
  var MAX_PORCIONES = 8;
  var MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function rangoTexto(desde, hasta) {
    var a = new Date(desde + "T12:00:00"), b = new Date(hasta + "T12:00:00");
    b.setMonth(b.getMonth() + 2);
    return MESES_L[a.getMonth()] + (a.getFullYear() !== b.getFullYear() ? " de " + a.getFullYear() : "") + " a " + MESES_L[b.getMonth()] + " de " + b.getFullYear();
  }

  function armarEstado() {
    var raiz = $("estado-extras");
    var cab = el("div", "estado-extras__cab");
    var tit = el("div");
    var h = el("h2", "title", "Ingresos y gastos del Estado nacional");
    tit.appendChild(h);
    tit.appendChild(el("p", "sub", "En qué se gasta y de dónde sale la plata, por rubro, según el informe mensual de Hacienda."));
    cab.appendChild(tit);
    var chipsBox = el("div", "chips chips--sm"); chipsBox.setAttribute("role", "group"); chipsBox.setAttribute("aria-label", "Período de las tortas");
    cab.appendChild(chipsBox);
    raiz.appendChild(cab);
    // la misma informacion se puede ver como torta o como mosaico (el tamaño de cada recuadro es su parte)
    var formaBox = el("div", "chips chips--sm forma"); formaBox.setAttribute("role", "group"); formaBox.setAttribute("aria-label", "Forma del gráfico");
    raiz.appendChild(formaBox);
    var cuerpo = el("div"); raiz.appendChild(cuerpo);
    cuerpo.appendChild(esqueleto(260));

    var datos = null, periodos = [], actual = "ult", forma = "torta";
    function pintarForma() {
      formaBox.textContent = "";
      [["torta", "Torta"], ["mosaico", "Mosaico"]].forEach(function (f) {
        formaBox.appendChild(chip(f[1], f[0] === forma, function () { forma = f[0]; pintarForma(); if (datos) pintar(); }));
      });
    }
    pintarForma();

    function armarPeriodos() {
      var fechas = datos.resPrim.map(function (p) { return p[0]; });
      var ult = fechas[fechas.length - 1], anio = ult.slice(0, 4);
      var ytd = fechas.filter(function (f) { return f.slice(0, 4) === anio; });
      var ultimos4 = fechas.slice(-4);
      var anioAnt = String(Number(anio) - 1);
      var previo = fechas.filter(function (f) { return f.slice(0, 4) === anioAnt; });
      periodos = [{ id: "ult", nombre: "Último trimestre", fechas: [ult] }];
      if (ytd.length > 1) periodos.push({ id: "ytd", nombre: "Acumulado de " + anio, fechas: ytd });
      if (ultimos4.length === 4) periodos.push({ id: "12m", nombre: "Últimos 4 trimestres", fechas: ultimos4 });
      if (previo.length === 4) periodos.push({ id: "ant", nombre: "Año " + anioAnt, fechas: previo });
      periodos.forEach(function (p) { p.texto = rangoTexto(p.fechas[0], p.fechas[p.fechas.length - 1]); });
    }

    function suma(clave, fechas) {
      var set = {}; fechas.forEach(function (f) { set[f] = true; });
      return (datos[clave] || []).reduce(function (a, p) { return set[p[0]] && p[1] !== null ? a + p[1] : a; }, 0);
    }

    function porciones(defs, fechas) {
      var l = defs.map(function (d) {
        return { label: d[0], value: d[1].reduce(function (a, k) { return a + suma(k, fechas); }, 0) };
      }).filter(function (x) { return x.value > 0; }).sort(function (a, b) { return b.value - a.value; });
      var total = l.reduce(function (a, x) { return a + x.value; }, 0);
      var grafico = l;
      if (l.length > MAX_PORCIONES) {
        var resto = l.slice(MAX_PORCIONES - 1);
        grafico = l.slice(0, MAX_PORCIONES - 1).concat([{
          label: "Otros (" + resto.length + " rubros)", value: resto.reduce(function (a, x) { return a + x.value; }, 0), otros: true,
          nota: resto.map(function (x) { return x.label; }).join(", ")
        }]);
      }
      return { lista: l, grafico: grafico, total: total };
    }

    function fm(v) { return fmtUnit("M ARS", v); }

    function tarjetaTorta(titulo, defs, fechas, pie) {
      var card = el("article", "card");
      card.appendChild(el("h3", "label", titulo));
      var cb = el("div"); card.appendChild(cb);
      var p = porciones(defs, fechas);
      if (forma === "mosaico") C.treemap(cb, { items: p.lista, fmt: fm, titulo: titulo });
      else C.pie(cb, { items: p.grafico, fmt: fm, titulo: titulo, centro: ["Total de los rubros", fm(p.total)] });
      var det = el("details", "torta__detalle");
      det.appendChild(el("summary", "", "Ver todos los rubros (" + p.lista.length + ")"));
      var t = el("table", "tabla"), th = el("thead"), trh = el("tr");
      [["Rubro", ""], ["Monto", "num"], ["Parte", "num"]].forEach(function (c) { var x = el("th", c[1], c[0]); x.scope = "col"; trh.appendChild(x); });
      th.appendChild(trh); t.appendChild(th);
      t.appendChild(el("caption", "sr-only", titulo + ", todos los rubros"));
      var tb = el("tbody");
      p.lista.forEach(function (x) {
        var r = el("tr"); r.appendChild(el("td", "", x.label)); r.appendChild(el("td", "num", fm(x.value))); r.appendChild(el("td", "num", num(x.value / p.total * 100, 1) + "%")); tb.appendChild(r);
      });
      t.appendChild(tb);
      var w = el("div", "tabla__wrap"); w.appendChild(t); det.appendChild(w);
      card.appendChild(det);
      if (pie) card.appendChild(el("p", "torta__pie", pie));
      return { card: card, total: p.total };
    }

    function pintar() {
      var per = periodos.filter(function (x) { return x.id === actual; })[0] || periodos[0];
      chipsBox.textContent = "";
      periodos.forEach(function (x) { chipsBox.appendChild(chip(x.nombre, x.id === per.id, function () { actual = x.id; pintar(); })); });
      cuerpo.textContent = "";
      cuerpo.appendChild(el("p", "hint", "Período: " + per.texto + ". Montos en pesos corrientes de cada momento, sin ajustar por inflación."));
      var g = el("div", "tortas");
      var ing = tarjetaTorta("De dónde sale la plata (ingresos)", TORTA_ING, per.fechas);
      var gas = tarjetaTorta("En qué se gasta (gastos primarios)", TORTA_GAS, per.fechas, "No incluye los intereses de la deuda, que se muestran aparte.");
      g.appendChild(ing.card); g.appendChild(gas.card);
      cuerpo.appendChild(g);

      var rp = suma("resPrim", per.fechas), it = suma("intereses", per.fechas), rf = suma("resFin", per.fechas);
      var res = el("article", "card");
      res.appendChild(el("h3", "label", "Cómo cierra la cuenta"));
      var st = el("div", "stats");
      [["Ingresos (suma de rubros)", fm(ing.total)], ["Gastos primarios (suma de rubros)", fm(gas.total)], ["Resultado primario oficial", fm(rp)],
        ["Intereses netos de la deuda", fm(it)], ["Resultado financiero oficial", fm(rf)]].forEach(function (x) {
        var d = el("div", "stat"); d.appendChild(el("span", "", x[0])); d.appendChild(el("b", "", x[1])); st.appendChild(d);
      });
      res.appendChild(st);
      res.appendChild(el("p", "torta__pie", "Resultado primario: ingresos menos gastos, sin contar intereses. Resultado financiero: el primario menos los intereses. Los rubros detallados que publica Hacienda pueden no sumar exactamente el total oficial. Es el Estado nacional no financiero: no incluye a las provincias."));
      cuerpo.appendChild(res);
      cuerpo.appendChild(el("p", "hint", "Fuente: Secretaría de Hacienda, Informe Mensual de Ingresos y Gastos del Sector Público Nacional (IMIG), vía datos.gob.ar."));
    }

    function cargar() {
      cuerpo.textContent = ""; cuerpo.appendChild(esqueleto(260));
      S.fiscalTrimestral().then(function (d) { datos = d; armarPeriodos(); pintar(); }, function () {
        cuerpo.textContent = "";
        var err = el("div", "chart__error"); err.appendChild(el("p", "", "No se pudieron cargar los ingresos y gastos."));
        var b = el("button", "btn btn--ghost btn--sm", "Reintentar"); b.type = "button"; b.addEventListener("click", cargar);
        err.appendChild(b); cuerpo.appendChild(err);
      });
    }
    cargar();
  }

  /* ---------- glosario ---------- */

  function armarGlosario() {
    var raiz = $("glosario-contenido");
    var buscar = el("input", "mesa__buscar"); buscar.type = "search"; buscar.placeholder = "Buscar indicador"; buscar.setAttribute("aria-label", "Buscar indicador");
    raiz.appendChild(buscar);
    var lista = el("div", "glosario"); raiz.appendChild(lista);
    var vacio = el("p", "mesa__vacio", "Sin resultados."); vacio.hidden = true; raiz.appendChild(vacio);

    var bloques = [];
    SECCIONES.forEach(function (sec) {
      var ids = [];
      sec.grupos.forEach(function (gr) { gr[1].forEach(function (id) { ids.push(id); }); });
      bloques.push([sec.nombre, ids]);
    });
    bloques.push(["Banco Central", Object.keys(DEFS).filter(function (id) { return !SEC_DE[id]; })]);

    var grupos = [];
    bloques.forEach(function (b) {
      var h = el("h2", "resumen__sub", b[0]); lista.appendChild(h);
      var items = []; grupos.push({ h: h, items: items });
      b[1].forEach(function (id) {
        if (!(window.EconoGlosario && window.EconoGlosario[id])) return;
        var d = guiaDe({ id: id }, false);
        d.querySelector("summary").textContent = DEFS[id].label;
        var ir = el("a", "link", "Ver el gráfico"); ir.href = "#" + (SEC_DE[id] || "bcra") + ":" + id;
        d.appendChild(ir);
        d.dataset.nombre = DEFS[id].label.toLowerCase();
        lista.appendChild(d); items.push(d);
      });
    });
    buscar.addEventListener("input", function () {
      var q = buscar.value.trim().toLowerCase(), hay = false;
      grupos.forEach(function (t) {
        var n = 0;
        t.items.forEach(function (d) { var ok = !q || d.textContent.toLowerCase().indexOf(q) !== -1; d.hidden = !ok; if (ok) n++; });
        t.h.hidden = n === 0;
        if (n) hay = true;
      });
      vacio.hidden = hay;
    });
  }

  /* ---------- API ---------- */

  var secPorId = {}, mesasSec = {};
  SECCIONES.forEach(function (s) { secPorId[s.id] = s; });

  var bcraMesa = null, mercadosListo = false, hubListo = false, tilesInicio = false, glosarioListo = false;

  // un link viejo #tablero:id pasa a la seccion que corresponde
  function migrar(sub) { return sub && SEC_DE[sub] ? SEC_DE[sub] + ":" + sub : "inicio"; }

  function mostrar(vista, sub) {
    if (vista === "inicio") {
      if (!tilesInicio) { tilesInicio = true; tiles($("inicio-tiles"), OTRAS_INICIO); }
      if (!buscadorListo) { buscadorListo = true; armarBuscador(); }
      if (!inicio || inicio.firma !== firmaFavs()) armarInicio();
    } else if (vista === "argentina") {
      if (!hubListo) { hubListo = true; tiles($("argentina-tiles")); }
    } else if (secPorId[vista]) {
      var sec = secPorId[vista];
      if (!mesasSec[vista]) {
        mesasSec[vista] = crearMesa({ filas: filasDe(sec), raiz: $("mesa-" + vista), vista: vista, titulo: sec.titulo, clave: sec.clave, frases: FRASES[vista] });
        mesasSec[vista].armar();
        if (vista === "estado") armarEstado();
      }
      if (sub) mesasSec[vista].abrir(sub); else mesasSec[vista].cerrar();
    } else if (vista === "bcra") {
      if (!bcraMesa) armarBCRA();
      if (sub) bcraMesa.abrir(sub); else bcraMesa.cerrar();
    } else if (vista === "glosario") {
      if (!glosarioListo) { glosarioListo = true; armarGlosario(); }
    } else if (vista === "mercados") {
      if (!mercadosListo) { mercadosListo = true; armarMercados(); }
    }
  }

  // el brillo de los recuadros sigue al puntero
  document.addEventListener("pointermove", function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest(".tarjeta, .menu a") : null;
    if (!t) return;
    var r = t.getBoundingClientRect();
    t.style.setProperty("--mx", ((ev.clientX - r.left) / r.width * 100).toFixed(1) + "%");
    t.style.setProperty("--my", ((ev.clientY - r.top) / r.height * 100).toFixed(1) + "%");
  }, { passive: true });

  window.EconoTablero = { mostrar: mostrar, migrar: migrar };
})();
