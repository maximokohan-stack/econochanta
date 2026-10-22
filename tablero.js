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

  // cada tipo de dolar tiene su color, el mismo en la lista, en las tarjetas y en el grafico
  var PUNTO = { oficial: "var(--celeste)", mep: "var(--p1)", ccl: "var(--p5)", blue: "var(--p4)", tarjeta: "var(--p9)", cripto: "var(--p2)" };
  function punto(id) { if (!PUNTO[id]) return null; var i = el("i", "punto"); i.style.background = PUNTO[id]; i.setAttribute("aria-hidden", "true"); return i; }
  function fuenteCorta(f) { return String(f || "datos públicos").replace(/\s*\(.*\)/, "").split(",")[0].trim(); }
  function hora(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }); }

  // la unidad se escribe en palabras: "50.043" no dice nada si no se sabe que son millones de dolares
  var UNIDAD_ID = {
    infM: "variación mensual de los precios", infIA: "variación de los precios en 12 meses", riesgo: "puntos básicos (100 = 1 punto)",
    brecha: "% de diferencia con el oficial", desoc: "% de la población activa", emae: "índice, base 2004 = 100", ipi: "índice, base 2004 = 100",
    cemento: "índice de despachos", pbi: "millones de pesos de 2004", salarios: "índice, base oct. 2016 = 100", salPriv: "índice, base oct. 2016 = 100",
    salNoReg: "índice, base oct. 2016 = 100", salPub: "índice, base oct. 2016 = 100", ripte: "pesos por mes", smvm: "pesos por mes", haber: "pesos por mes",
    uva: "pesos por UVA", cer: "índice, 1 = feb. 2002", badlar: "tasa nominal anual", tamar: "tasa nominal anual", tasaDep: "tasa nominal anual",
    tasaPers: "tasa nominal anual", tasaPases: "tasa nominal anual", tasaBaibar: "tasa nominal anual", tasaAdelantos: "tasa nominal anual",
    m2: "% frente a un año atrás", recaudIA: "% frente a un año atrás", compras: "millones de dólares por día", tcMay: "pesos por dólar", tcMin: "pesos por dólar"
  };
  function unidadDe(it) {
    if (UNIDAD_ID[it.id]) return UNIDAD_ID[it.id];
    if (it.t === "ipc") return "variación del mes";
    if (PUNTO[it.id]) return "pesos por dólar";
    var u = it.s ? it.s.unit : "";
    if (u === "M USD") return "millones de dólares";
    if (u === "M ARS") return it.s && Math.abs(it.s.ultimo.v) >= 1e6 ? "billones de pesos" : "millones de pesos";
    if (u === "ARS") return "pesos";
    if (u === "pb") return "puntos básicos";
    return "";
  }
  function frecuenciaDe(it) {
    var p = pasoDias(it.s);
    return p <= 3 ? "diaria" : p <= 40 ? "mensual" : p <= 120 ? "trimestral" : "anual";
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
    { id: "tarjeta", g: "Dólar", label: "Dólar tarjeta", key: "dTarjeta", t: "level" },
    { id: "cripto", g: "Dólar", label: "Dólar cripto", key: "dCripto", t: "level" },
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
    { id: "dolares", nombre: "Dólares", desc: "Oficial, MEP, CCL, blue, tarjeta y cripto, la brecha y las compras del BCRA",
      titulo: "Dólares de un vistazo", clave: ["oficial", "mep", "ccl", "blue", "tarjeta", "brecha", "tcMay", "compras"],
      grupos: [["Cotizaciones", ["oficial", "mep", "ccl", "blue", "tarjeta", "cripto", "tcMay"]], ["Brecha", ["brecha"]], ["Compras del BCRA", ["compras"]]] },
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
    { id: "recientes", nombre: "Datos recientes", desc: "Lo último de cada indicador clave, con una lectura de qué significa en contexto" },
    { id: "bcra", nombre: "Banco Central", desc: "Reservas, base monetaria, tasas, depósitos, crédito y 39 monedas" },
    { id: "mercados", nombre: "Acciones y bonos", desc: "Acciones líderes y bonos soberanos en vivo, con búsqueda" },
    { id: "tabla", nombre: "Tabla de indicadores", desc: "Todos los indicadores juntos: último, anterior, variación, máximo y mínimo de 12 meses" }
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

  // color de una variacion segun su direccion: verde si sube, rojo si baja, gris si no cambia
  // (las clases se llaman tono-bien y tono-mal por historia: ahora significan sube y baja)
  function tonoDe(v) {
    if (v === undefined || v === null || Math.abs(v) < 0.0001) return "flat";
    return v > 0 ? "tono-bien" : "tono-mal";
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
    var dom = {}, cot = null;
    var hashDe = cfg.hashDe || function (it) { return "#" + vista + ":" + it.id; };

    function armarItem(f, s, extra) {
      var it = f.__it;
      it.s = s; it.ok = true; it.error = false;
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
      it.tonoPrev = esNulo(it.dPrevTxt) ? "flat" : tonoDe(it.dPrev);
      it.tono12 = esNulo(it.d12Txt) ? "flat" : tonoDe(it.d12);
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
      var nombre = el("span", "fila__nombre");
      var pt = punto(it.id); if (pt) nombre.appendChild(pt);
      nombre.appendChild(document.createTextNode((favs[it.id] ? "★ " : "") + it.label));
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
      var nom = el("span", "tarjeta__nombre"); var pt = punto(it.id); if (pt) nom.appendChild(pt); nom.appendChild(document.createTextNode(it.label));
      b.appendChild(nom);
      if (it.ok) {
        // el recuadro se pinta de verde si el ultimo dato subio y de rojo si bajo, y mas intenso cuanto mas se movio
        var esc = it.t === "rate" ? 1.5 : it.t === "level" ? 2 : (Math.abs(it.s.ultimo.v) || 1) * 0.8;
        b.classList.add(it.tonoPrev === "tono-bien" ? "calor-bien" : it.tonoPrev === "tono-mal" ? "calor-mal" : "calor-neutro");
        b.style.setProperty("--k", Math.min(1, Math.abs(it.dPrev || 0) / esc).toFixed(2));
        b.appendChild(el("span", "tarjeta__val", it.valor));
        var un = unidadDe(it); if (un) b.appendChild(el("span", "tarjeta__unidad", un));
        b.appendChild(el("span", "tarjeta__chg " + it.tonoPrev, it.dPrevTxt ? flechaDe(it.dPrevTxt, it.dPrev) + it.dPrevTxt : "sin variación"));
        var sp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        sp.setAttribute("class", "tarjeta__spark"); sp.setAttribute("aria-hidden", "true");
        C.spark(sp, it.spark, colorSpark(it.tonoPrev));
        b.appendChild(sp);
        var c = cot && it.__f && cot[it.__f.key];
        if (c) {
          var cv = el("span", "tarjeta__cv");
          cv.appendChild(el("span", "", "Compra $ " + num(c.compra, 0))); cv.appendChild(el("span", "", "Venta $ " + num(c.venta, 0)));
          b.appendChild(cv);
          b.appendChild(el("span", "tarjeta__fuente", "DolarAPI · " + (hora(c.fecha) || it.fecha)));
        } else b.appendChild(el("span", "tarjeta__fuente", fuenteCorta(it.s.fuente) + " · " + it.fecha));
      } else b.appendChild(el("span", "tarjeta__val tarjeta__val--msg", it.error ? "sin dato" : "…"));
      b.addEventListener("click", function () { if (cfg.alTocar) cfg.alTocar(it); else location.hash = hashDe(it); });
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
      box.appendChild(el("p", "leyenda", "▲ sube (verde) · ▼ baja (rojo), frente al dato anterior. Que suba o baje no dice si es bueno o malo: eso depende del indicador y de quién lo mire. Tocá un indicador para ver su gráfico, qué mide y cómo se lee, y para marcarlo como favorito."));
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
      var unD = unidadDe(it); if (unD) box.appendChild(el("div", "big__unidad", unD));
      box.appendChild(el("p", "mesa__frase", frase(it)));
      var chg = el("div", "pastillas");
      if (it.dPrevTxt) chg.appendChild(el("span", "pastilla " + it.tonoPrev, flechaDe(it.dPrevTxt, it.dPrev) + it.dPrevTxt + (it.mensual ? " vs período anterior" : " vs día anterior")));
      if (it.d12Txt) chg.appendChild(el("span", "pastilla " + it.tono12, flechaDe(it.d12Txt, it.d12) + it.d12Txt + (it.t === "flow" ? "" : " en 12 meses")));
      var dias = rezagoDias(it.s);
      chg.appendChild(el("span", "pastilla " + (it.viejo ? "viejo" : "flat"), "Dato de " + it.fecha + (it.viejo ? " (hace " + dias + " días, desactualizado)" : "")));
      box.appendChild(chg);

      // en pantallas anchas el grafico va a la izquierda y la explicacion a la derecha
      var guia = guiaDe(it);
      var rejilla = el("div", "mesa__rejilla"), princ = el("div", "mesa__principal"), lado = el("div", "mesa__lado");
      rejilla.appendChild(princ); rejilla.appendChild(lado); box.appendChild(rejilla);
      if (guia) {
        guia.addEventListener("toggle", function () { guardarGuia(!guia.open); });
        lado.appendChild(guia);
      }

      var rs = rangosDe(it);
      var rg = estado.rango[it.id];
      if (!rg || !rs.some(function (r) { return r[1] === rg; })) rg = rs[Math.min(1, rs.length - 1)][1];
      var rbox = el("div", "chips chips--sm"); rbox.setAttribute("role", "group"); rbox.setAttribute("aria-label", "Período");
      rs.forEach(function (r) { rbox.appendChild(chip(r[0], r[1] === rg, function () { estado.rango[it.id] = r[1]; pintarDetalle(); var b = dom.detalle.querySelector('.chips[aria-label="Período"] .chip[aria-pressed="true"]'); if (b) b.focus(); })); });
      princ.appendChild(rbox);

      var cb = el("div", "mesa__grafico chart"); princ.appendChild(cb);
      var serieRango = recortar(it.s, rg);
      if (PUNTO[it.id]) serieRango.color = PUNTO[it.id];
      var vals = serieRango.points.map(function (p) { return p[1]; });
      var prom = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;

      var st = el("div", "stats");
      [["Último", it.valor], ["Mínimo", it.fmt(Math.min.apply(null, vals))], ["Máximo", it.fmt(Math.max.apply(null, vals))], ["Promedio", it.fmt(prom)], ["Puntos", String(vals.length)]].forEach(function (x) {
        var d = el("div", "stat"); d.appendChild(el("span", "", x[0])); d.appendChild(el("b", "", x[1])); st.appendChild(d);
      });
      princ.appendChild(st);

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
      tools.appendChild(el("span", "hint", "Fuente: " + (it.s.fuente || "datos públicos") + " · Frecuencia: " + frecuenciaDe(it) + " · Último dato: " + it.fecha + "."));
      var acciones = el("div", "mesa__acciones");
      var met = el("a", "link", "Cómo se calcula"); met.href = "#metodologia"; acciones.appendChild(met);
      var cita = el("button", "btn btn--ghost btn--xs", "Copiar cita"); cita.type = "button";
      cita.addEventListener("click", function () {
        var hoy = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
        var txt = "Econochanta, \"" + it.label + "\", con datos de " + fuenteCorta(it.s.fuente) + ", consultado el " + hoy + ". " + location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { anunciar("Cita copiada"); cita.textContent = "Cita copiada"; setTimeout(function () { cita.textContent = "Copiar cita"; }, 1800); }, function () { anunciar("No se pudo copiar la cita"); });
        else anunciar("Tu navegador no permite copiar automáticamente");
      });
      acciones.appendChild(cita);
      var csv = el("button", "btn btn--ghost btn--xs", "Descargar CSV"); csv.type = "button";
      csv.addEventListener("click", function () { C.csv(it.id, [it.s]); });
      acciones.appendChild(csv);
      tools.appendChild(acciones);
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
        var it = { id: f.id, g: f.g, label: f.label, t: f.t, ok: false, bars: f.bars, signed: f.signed, __f: f };
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
      if (filas.some(function (f) { return PUNTO[f.id]; })) S.cotizacionesDolar().then(function (m) { cot = m; programarPintar(); }, function () { /* sin compra y venta */ });
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

    return { armar: armar, abrir: abrir, cerrar: cerrar, tarjeta: tarjeta, items: items, porId: porId, cot: function () { return cot; } };
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
    { id: "analisis", nombre: "Análisis", desc: "Qué pasó, qué dicen los datos y a quién le pega o le conviene" },
    { id: "glosario", nombre: "Glosario", desc: "Qué mide cada indicador, cómo se calcula y cómo leerlo" }
  ];
  var IDS_DOLARES = ["oficial", "blue", "mep", "ccl", "tarjeta", "brecha"];

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
    bpEyO: "balance de pagos", bpReservas: "balance de pagos",
    tarjeta: "dolar tarjeta turista exterior consumos", cripto: "dolar cripto usdt stablecoin criptomoneda"
  };

  function norm(t) { return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  var corpus = null;
  function secPorIdTemp(id) { return SECCIONES.some(function (x) { return x.id === id; }); }
  function getCorpus() {
    if (corpus) return corpus;
    corpus = [];
    var esArg = function (id) { return id === "bcra" || id === "mercados" || id === "tabla" || id === "recientes" || secPorIdTemp(id); };
    SECCIONES.concat(SEC_OTRAS, OTRAS_INICIO).forEach(function (s) {
      corpus.push({ sec: true, nombre: s.nombre, donde: esArg(s.id) ? "Argentina" : "Sección", desc: s.desc, href: "#" + s.id, n: norm(s.nombre), x: norm(s.desc) });
    });
    analisisVisibles().forEach(function (a) {
      corpus.push({ sec: true, nombre: a.titulo, donde: "Análisis", desc: a.bajada, href: "#analisis:" + a.id, n: norm(a.titulo), x: norm(a.bajada + " " + a.tema) });
    });
    Object.keys(DEFS).forEach(function (id) {
      var d = DEFS[id], g = window.EconoGlosario && window.EconoGlosario[id];
      var sec = SEC_DE[id] ? (SECCIONES.filter(function (x) { return x.id === SEC_DE[id]; })[0] || {}).nombre : "Banco Central";
      corpus.push({ nombre: d.label, donde: "Argentina › " + sec, desc: g ? g.q : "", href: "#" + (SEC_DE[id] || "bcra") + ":" + id,
        n: norm(d.label), x: norm((ALIAS[id] || "") + " " + (g ? g.q + " " + g.c : "")) });
    });
    return corpus;
  }

  // devuelve { vistos, total } o null si el texto es muy corto
  function consultar(texto) {
    var q = norm(texto.trim());
    if (q.length < 2) return null;
    var pal = q.split(/\s+/), res = [];
    getCorpus().forEach(function (c) {
      var enNombre = 0, enTexto = 0, ok = true;
      pal.forEach(function (w) {
        if (c.n.indexOf(w) !== -1) enNombre++;
        else if (c.x.indexOf(w) !== -1) enTexto++;
        else ok = false;
      });
      if (!ok) return;
      res.push({ c: c, p: enNombre * 10 + enTexto + (c.sec ? 5 : 0) + (c.n.indexOf(q) === 0 ? 8 : 0) });
    });
    res.sort(function (a, b) { return b.p - a.p; });
    return { vistos: res.slice(0, 10), total: res.length };
  }

  function filaResultado(r, alElegir) {
    var li = el("li"), a = el("a"); a.href = r.c.href;
    a.appendChild(el("span", "buscador__nombre", r.c.nombre));
    a.appendChild(el("span", "buscador__donde", r.c.donde));
    if (r.c.desc) a.appendChild(el("span", "buscador__desc", r.c.desc));
    a.addEventListener("click", alElegir);
    li.appendChild(a);
    return li;
  }
  function textoEstado(r) { return r.vistos.length + (r.vistos.length === 1 ? " resultado" : " resultados") + (r.total > r.vistos.length ? " de " + r.total : ""); }

  function armarBuscador() {
    var input = $("buscador-input"), lista = $("buscador-lista"), estado = $("buscador-estado");
    if (!input) return;
    function cerrar() { lista.hidden = true; lista.textContent = ""; }
    function buscar() {
      var r = consultar(input.value);
      if (!r) { cerrar(); estado.textContent = ""; return; }
      lista.textContent = ""; lista.hidden = false;
      if (!r.vistos.length) {
        lista.appendChild(el("li", "buscador__vacio", "No encontré nada para \"" + input.value.trim() + "\". Probá con otra palabra, por ejemplo dólar, inflación o jubilaciones."));
        estado.textContent = "Sin resultados";
        return;
      }
      r.vistos.forEach(function (x) { lista.appendChild(filaResultado(x, function () { input.value = ""; cerrar(); })); });
      estado.textContent = textoEstado(r);
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

  /* ---------- buscador en cualquier pantalla (Ctrl+K o la lupa del encabezado) ---------- */

  var paleta = null, previoFoco = null;
  function crearPaleta() {
    var fondo = el("div", "paleta-fondo"); fondo.hidden = true;
    var caja = el("div", "paleta"); caja.setAttribute("role", "dialog"); caja.setAttribute("aria-modal", "true"); caja.setAttribute("aria-label", "Buscar");
    var input = el("input", "paleta__input"); input.type = "search"; input.placeholder = "Buscar un indicador o una sección…"; input.setAttribute("aria-label", "Buscar un indicador o una sección"); input.autocomplete = "off";
    var lista = el("ul", "paleta__lista");
    var estado = el("p", "sr-only"); estado.setAttribute("role", "status");
    var pie = el("p", "paleta__pie", "↑↓ para moverte · Enter para ir · Esc para cerrar");
    caja.appendChild(input); caja.appendChild(estado); caja.appendChild(lista); caja.appendChild(pie);
    fondo.appendChild(caja); document.body.appendChild(fondo);

    function enlaces() { return [].slice.call(lista.querySelectorAll("a")); }
    function pintar() {
      var r = consultar(input.value);
      lista.textContent = "";
      if (!r) { estado.textContent = ""; lista.appendChild(el("li", "buscador__vacio", "Escribí al menos dos letras. Por ejemplo: dólar, inflación, jubilaciones o cuenta corriente.")); return; }
      if (!r.vistos.length) { estado.textContent = "Sin resultados"; lista.appendChild(el("li", "buscador__vacio", "No encontré nada. Probá con otra palabra.")); return; }
      r.vistos.forEach(function (x) { lista.appendChild(filaResultado(x, cerrarPaleta)); });
      estado.textContent = textoEstado(r);
    }
    input.addEventListener("input", pintar);
    caja.addEventListener("keydown", function (ev) {
      var en = enlaces(), todos = [input].concat(en), i = todos.indexOf(document.activeElement);
      if (ev.key === "Escape") { ev.preventDefault(); cerrarPaleta(); }
      else if (ev.key === "ArrowDown") { ev.preventDefault(); if (todos.length > 1) todos[Math.min(todos.length - 1, i + 1)].focus(); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); todos[Math.max(0, i - 1)].focus(); }
      else if (ev.key === "Enter" && document.activeElement === input && en.length) { ev.preventDefault(); en[0].click(); location.hash = en[0].getAttribute("href"); }
      else if (ev.key === "Tab") { ev.preventDefault(); todos[(i + (ev.shiftKey ? todos.length - 1 : 1)) % todos.length].focus(); }
    });
    fondo.addEventListener("click", function (ev) { if (ev.target === fondo) cerrarPaleta(); });
    paleta = { fondo: fondo, input: input, pintar: pintar };
  }
  function abrirPaleta() {
    if (!paleta) crearPaleta();
    previoFoco = document.activeElement;
    paleta.fondo.hidden = false; paleta.input.value = ""; paleta.pintar(); paleta.input.focus();
  }
  function cerrarPaleta() {
    if (!paleta || paleta.fondo.hidden) return;
    paleta.fondo.hidden = true;
    if (previoFoco && previoFoco.focus) { try { previoFoco.focus(); } catch (e) { /* sin foco */ } }
  }
  function iniciarPaleta() {
    var btn = $("abrir-buscar");
    if (btn) btn.addEventListener("click", abrirPaleta);
    document.addEventListener("keydown", function (ev) {
      var tag = ev.target && ev.target.tagName, escribiendo = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (ev.target && ev.target.isContentEditable);
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); if (paleta && !paleta.fondo.hidden) cerrarPaleta(); else abrirPaleta(); }
      else if (ev.key === "/" && !escribiendo && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); abrirPaleta(); }
    });
  }

  var inicio = null, buscadorListo = false;

  function firmaFavs() { return Object.keys(favs).sort().join(","); }

  /* ---------- Inicio: pulso de hoy, desde tu ultima visita, lo que mas se movio y cajon de detalle ---------- */

  var REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var IDS_PULSO = ["oficial", "infM", "riesgo"];
  var IDS_VISITA = ["oficial", "blue", "mep", "ccl", "brecha", "riesgo", "reservas", "infM", "badlar"];
  var IDS_MOV = ["oficial", "blue", "mep", "ccl", "tarjeta", "brecha", "riesgo", "reservas", "badlar", "tamar", "infM", "infIA", "emae", "desoc", "resPrim", "saldo", "recaudIA", "salarios"];
  var PERIODOS = [
    { id: "hoy", nombre: "Hoy", dias: 0, rango: 90, txt: "frente al dato anterior", soloDiarias: true },
    { id: "sem", nombre: "Semana", dias: 7, rango: 90, txt: "en 7 días", soloDiarias: true },
    { id: "mes", nombre: "Mes", dias: 30, rango: 365, txt: "en 30 días" },
    { id: "anio", nombre: "Año", dias: 365, rango: 1095, txt: "en 12 meses" }
  ];
  var ESCALA = { pct: { 0: 1.5, 7: 3, 30: 6, 365: 40 }, pp: { 0: 0.5, 7: 1, 30: 2, 365: 6 }, pb: { 0: 15, 7: 40, 30: 100, 365: 350 } };
  var VISITA_KEY = "econochanta:v1:visita";
  var movPer = "hoy", movMesa = null, valoresPrevios = {}, contados = {}, ultimaCarga = 0, refrescoListo = false, visitaCalculada = false;

  function periodoDe(id) { return PERIODOS.filter(function (p) { return p.id === id; })[0] || PERIODOS[0]; }

  // cambio de un indicador en un periodo: porcentaje, puntos porcentuales o puntos basicos
  function cambioPeriodo(it, per) {
    var s = it.s; if (!it.ok || !s || !s.points || s.points.length < 2) return null;
    var pts = s.points, ult = pts[pts.length - 1], ref = null, i;
    if (per.soloDiarias && pasoDias(s) > 3) return null;
    if (per.dias === 0) ref = pts[pts.length - 2];
    else {
      var objetivo = new Date(new Date(ult[0] + "T12:00:00").getTime() - per.dias * 86400000).toISOString().slice(0, 10);
      for (i = pts.length - 1; i >= 0; i--) if (pts[i][0] <= objetivo) { ref = pts[i]; break; }
      if (!ref) return null;
    }
    var tipo = s.unit === "pb" ? "pb" : (it.t === "rate" ? "pp" : "pct"), c;
    if (tipo === "pct") c = ref[1] ? (ult[1] - ref[1]) / Math.abs(ref[1]) * 100 : null;
    else c = ult[1] - ref[1];
    if (c === null || !isFinite(c)) return null;
    var txt = tipo === "pct" ? signo(c, Math.abs(c) < 10 ? 2 : 1) + "%" : tipo === "pp" ? signo(c, 1) + " pp" : signo(c, 0) + " pb";
    var tramo = pts.filter(function (p) { return p[0] >= ref[0]; });
    return { c: c, tipo: tipo, txt: txt, esc: ESCALA[tipo][per.dias], ref: ref, tramo: tramo.length > 1 ? tramo : pts.slice(-2) };
  }

  function tonoCambio(c) { return Math.abs(c) < 0.0001 ? "flat" : c > 0 ? "tono-bien" : "tono-mal"; }
  function claseCalor(c) { return Math.abs(c) < 0.0001 ? "calor-neutro" : c > 0 ? "calor-bien" : "calor-mal"; }

  function ordenarMov(per) {
    var out = [];
    IDS_MOV.forEach(function (id) {
      var it = movMesa && movMesa.porId[id]; if (!it) return;
      var ch = cambioPeriodo(it, per); if (!ch) return;
      out.push({ it: it, ch: ch, mag: Math.abs(ch.c) / ch.esc });
    });
    out.sort(function (a, b) { return b.mag - a.mag; });
    return out;
  }

  // los numeros cuentan hasta su valor la primera vez que aparecen
  function contar(elem, texto, id) {
    if (REDUCE || contados[id]) return;
    contados[id] = true;
    var mt = String(texto).match(/-?[\d.]+(?:,\d+)?/); if (!mt) return;
    var n = parseFloat(mt[0].replace(/\./g, "").replace(",", "."));
    if (!isFinite(n)) return;
    var dec = (mt[0].split(",")[1] || "").length, pre = texto.slice(0, mt.index), suf = texto.slice(mt.index + mt[0].length), t0 = null, dur = 900;
    function f(v) { return pre + v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; }
    setTimeout(function () { elem.textContent = texto; }, dur + 250);
    function paso(t) { if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / dur); elem.textContent = f(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(paso); }
    requestAnimationFrame(paso);
  }
  // un destello breve cuando un dato cambia respecto de la vez anterior que se pintó
  function destello(tile, it) {
    if (valoresPrevios[it.id] !== undefined && valoresPrevios[it.id] !== it.valor) tile.classList.add("flash");
  }

  // tarjeta de "lo que mas se movio": el recuadro cuenta el cambio del periodo elegido
  function tarjetaMov(x, per, grande) {
    var it = x.it, ch = x.ch;
    var b = el("button", "tarjeta mov " + claseCalor(ch.c) + (grande ? " mov--grande" : "")); b.type = "button"; b.dataset.id = it.id;
    b.style.setProperty("--k", Math.min(1, x.mag).toFixed(2));
    b.setAttribute("aria-label", it.label + ", " + it.valor + ", " + (ch.c > 0 ? "sube " : ch.c < 0 ? "baja " : "sin cambios ") + ch.txt.replace(/^[+\-−]/, "") + " " + per.txt);
    var nom = el("span", "tarjeta__nombre"); var pt = punto(it.id); if (pt) nom.appendChild(pt); nom.appendChild(document.createTextNode(it.label)); b.appendChild(nom);
    b.appendChild(el("span", "tarjeta__val", it.valor));
    var un = unidadDe(it); if (un) b.appendChild(el("span", "tarjeta__unidad", un));
    b.appendChild(el("span", "tarjeta__chg", (Math.abs(ch.c) < 0.0001 ? "■ " : ch.c > 0 ? "▲ " : "▼ ") + ch.txt + " · " + per.txt));
    var sp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sp.setAttribute("class", "tarjeta__spark"); sp.setAttribute("aria-hidden", "true");
    C.spark(sp, ch.tramo, "#fff"); b.appendChild(sp);
    b.addEventListener("click", function () { abrirCajon(it, per.id); });
    destello(b, it);
    return b;
  }

  function pintarMovers(animar) {
    var caja = $("movers"); if (!caja) return;
    var per = periodoDe(movPer);
    var antes = {};
    if (animar) [].forEach.call(caja.children, function (c) { antes[c.dataset.id] = c.getBoundingClientRect(); });
    var lista = ordenarMov(per).slice(0, 8);
    caja.textContent = "";
    lista.forEach(function (x, i) { caja.appendChild(tarjetaMov(x, per, i === 0)); });
    if (lista.length && (animar || !caja.__pintada)) {
      caja.__pintada = true; caja.classList.add("anima");
      clearTimeout(caja.__t); caja.__t = setTimeout(function () { caja.classList.remove("anima"); }, 1600);
    }
    var nota = $("mov-nota");
    if (nota) nota.textContent = per.soloDiarias ? "En Hoy y Semana solo se comparan los datos que se publican todos los días. Para ver también los mensuales, elegí Mes o Año." : "";
    if (!lista.length) caja.appendChild(el("p", "hint", "Cargando indicadores…"));
    if (animar && !REDUCE) {
      [].forEach.call(caja.children, function (c) {
        var a = antes[c.dataset.id], d = c.getBoundingClientRect();
        if (a && c.animate) { var dx = a.left - d.left, dy = a.top - d.top; if (dx || dy) c.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }], { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)" }); }
        else if (c.animate) c.animate([{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: "ease-out" });
      });
    }
  }

  function pintarPeriodos() {
    var caja = $("mov-periodos"); if (!caja) return;
    caja.textContent = "";
    PERIODOS.forEach(function (p) {
      caja.appendChild(chip(p.nombre, p.id === movPer, function () { movPer = p.id; pintarPeriodos(); pintarMovers(true); anunciar("Mostrando lo que más se movió: " + p.nombre.toLowerCase()); }));
    });
  }

  /* ---- desde tu ultima visita ---- */

  function haceTexto(t) {
    var min = Math.round((Date.now() - t) / 60000);
    if (min < 2) return "hace un momento";
    if (min < 60) return "hace " + min + " min";
    var d = new Date(t), hoy = new Date(), hh = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    if (d.toDateString() === hoy.toDateString()) return "hoy a las " + hh;
    var ayer = new Date(hoy.getTime() - 86400000);
    if (d.toDateString() === ayer.toDateString()) return "ayer a las " + hh;
    return "el " + d.getDate() + " de " + MESES_L[d.getMonth()];
  }

  function calcularVisita(m) {
    var ids = IDS_VISITA.filter(function (id) { return m.porId[id] && m.porId[id].ok; });
    if (ids.length < 6 || !IDS_PULSO.every(function (id) { return m.porId[id] && m.porId[id].ok; })) return null;
    var ahora = { t: Date.now(), v: {} };
    ids.forEach(function (id) { ahora.v[id] = m.porId[id].s.ultimo.v; });
    var d = null;
    try { d = JSON.parse(localStorage.getItem(VISITA_KEY) || "null"); } catch (e) { d = null; }
    if (!d) d = { base: null, actual: null };
    if (!d.actual || Date.now() - d.actual.t > 30 * 60000) { d.base = d.actual; d.actual = ahora; }
    else d.actual = { t: d.actual.t, v: ahora.v };
    try { localStorage.setItem(VISITA_KEY, JSON.stringify(d)); } catch (e) { /* sin storage */ }
    return { base: d.base, ahora: ahora };
  }

  function pintarVisita(caja, info) {
    caja.textContent = "";
    caja.appendChild(el("h3", "pulso__tit", "Desde tu última visita"));
    if (!info) { caja.appendChild(el("p", "hint", "Cargando…")); return; }
    if (!info.base) {
      caja.appendChild(el("p", "pulso__vacio", "Es tu primera visita. La próxima vez te mostramos acá qué cambió desde hoy."));
      return;
    }
    caja.appendChild(el("p", "pulso__sub", haceTexto(info.base.t)));
    var cambios = [];
    IDS_VISITA.forEach(function (id) {
      var a = info.base.v[id], b = info.ahora.v[id], it = movMesa.porId[id];
      if (a === undefined || b === undefined || !it || !it.ok) return;
      var tipo = it.s.unit === "pb" ? "pb" : (it.t === "rate" ? "pp" : "pct"), c = tipo === "pct" ? (a ? (b - a) / Math.abs(a) * 100 : 0) : b - a;
      if (Math.abs(c) < 0.0001) return;
      var esc = tipo === "pct" ? 1.5 : tipo === "pp" ? 0.5 : 15;
      cambios.push({ it: it, c: c, tipo: tipo, mag: Math.abs(c) / esc });
    });
    cambios.sort(function (x, y) { return y.mag - x.mag; });
    var ul = el("ul", "pulso__cambios");
    cambios.slice(0, 5).forEach(function (x) {
      var li = el("li"), b = el("button", "pulso__cambio"); b.type = "button";
      var txt = x.tipo === "pct" ? signo(x.c, Math.abs(x.c) < 10 ? 2 : 1) + "%" : x.tipo === "pp" ? signo(x.c, 1) + " pp" : signo(x.c, 0) + " pb";
      b.appendChild(el("span", "pulso__cambio-n", x.it.label));
      b.appendChild(el("span", "pulso__cambio-v " + tonoCambio(x.c), (x.c > 0 ? "▲ " : "▼ ") + txt));
      b.addEventListener("click", function () { abrirCajon(x.it, "mes"); });
      li.appendChild(b); ul.appendChild(li);
    });
    if (!cambios.length) ul.appendChild(el("li", "pulso__vacio", "Sin cambios desde entonces."));
    caja.appendChild(ul);
    var notas = analisisVisibles().filter(function (a) { return a.fecha > new Date(info.base.t).toISOString().slice(0, 10); });
    if (notas.length) { var l = el("a", "link", notas.length + (notas.length === 1 ? " nota nueva en Análisis" : " notas nuevas en Análisis")); l.href = "#analisis"; caja.appendChild(l); }
  }

  function pintarPulso(m) {
    var raiz = $("pulso"); if (!raiz) return;
    var tiles = raiz.querySelector(".pulso__tiles"), visita = raiz.querySelector(".pulso__visita"), linea = raiz.querySelector(".pulso__linea");
    if (!tiles) {
      raiz.textContent = "";
      tiles = el("div", "pulso__tiles"); linea = el("p", "pulso__linea"); visita = el("div", "pulso__visita");
      var izq = el("div", "pulso__izq"); izq.appendChild(tiles); izq.appendChild(linea);
      raiz.appendChild(izq); raiz.appendChild(visita);
    }
    // los recuadros grandes solo se rehacen si cambió algún dato (así no se corta la animación de los números)
    var firma = IDS_PULSO.map(function (id) { var it = m.porId[id]; return it ? (it.ok ? it.valor : it.error ? "e" : "…") : ""; }).join("|") + (m.cot() ? "c" : "");
    if (raiz.__firma !== firma) {
      raiz.__firma = firma;
      tiles.textContent = "";
      IDS_PULSO.forEach(function (id) {
        var it = m.porId[id]; if (!it) return;
        var t = m.tarjeta(it); t.classList.add("pulso__tile");
        tiles.appendChild(t);
        if (it.ok) { contar(t.querySelector(".tarjeta__val"), it.valor, id); destello(t, it); }
      });
    }
    // lo que mas se movio hoy, en una linea
    var top = ordenarMov(PERIODOS[0]).slice(0, 3);
    linea.textContent = "";
    if (top.length) {
      linea.appendChild(el("b", "", "Lo más movido hoy: "));
      top.forEach(function (x, i) {
        if (i) linea.appendChild(document.createTextNode("  ·  "));
        var b = el("button", "pulso__link", x.it.label + " "); b.type = "button";
        b.appendChild(el("span", tonoCambio(x.ch.c), (x.ch.c > 0 ? "▲ " : "▼ ") + x.ch.txt));
        b.addEventListener("click", function () { abrirCajon(x.it, "hoy"); });
        linea.appendChild(b);
      });
    }
    var act = el("span", "pulso__act", ""); act.id = "pulso-act"; linea.appendChild(act);
    actualizarHace();
    if (!visitaCalculada) {
      var info = calcularVisita(m);
      if (info) { visitaCalculada = true; ultimaCarga = Date.now(); pintarVisita(visita, info); visita.__info = info; }
      else pintarVisita(visita, null);
    } else if (visita.__info) pintarVisita(visita, visita.__info);
  }
  function actualizarHace() {
    var a = $("pulso-act"); if (!a || !ultimaCarga) return;
    var min = Math.floor((Date.now() - ultimaCarga) / 60000);
    a.textContent = "  ·  Actualizado " + (min < 1 ? "hace un momento" : "hace " + min + " min");
  }

  /* ---- cajon de detalle: se abre sobre el Inicio, sin salir de la pagina ---- */

  var cajon = null, cajonFoco = null;
  function crearCajon() {
    var fondo = el("div", "cajon-fondo"); fondo.hidden = true;
    var caja = el("aside", "cajon"); caja.setAttribute("role", "dialog"); caja.setAttribute("aria-modal", "true"); caja.setAttribute("aria-label", "Detalle del indicador");
    var cierra = el("button", "btn btn--ghost btn--xs cajon__cerrar", "Cerrar ✕"); cierra.type = "button";
    var cuerpo = el("div", "cajon__cuerpo");
    caja.appendChild(cierra); caja.appendChild(cuerpo); fondo.appendChild(caja); document.body.appendChild(fondo);
    cierra.addEventListener("click", cerrarCajon);
    fondo.addEventListener("click", function (ev) { if (ev.target === fondo) cerrarCajon(); });
    caja.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { ev.preventDefault(); cerrarCajon(); return; }
      if (ev.key !== "Tab") return;
      var f = [].slice.call(caja.querySelectorAll("a[href], button:not([disabled])")).filter(function (e) { return e.offsetParent !== null; });
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (ev.shiftKey && i <= 0) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && i === f.length - 1) { ev.preventDefault(); f[0].focus(); }
    });
    cajon = { fondo: fondo, caja: caja, cuerpo: cuerpo, cierra: cierra };
  }
  function cerrarCajon() {
    if (!cajon || cajon.fondo.hidden) return;
    cajon.fondo.classList.remove("on");
    setTimeout(function () { cajon.fondo.hidden = true; }, REDUCE ? 0 : 300);
    if (cajonFoco && cajonFoco.focus) { try { cajonFoco.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }
  }
  function abrirCajon(it, perId) {
    if (!it || !it.ok) return;
    if (!cajon) crearCajon();
    var per = periodoDe(perId || movPer), ch = cambioPeriodo(it, per);
    cajonFoco = document.activeElement;
    var c = cajon.cuerpo; c.textContent = "";
    var sec = SEC_DE[it.id] ? (SECCIONES.filter(function (x) { return x.id === SEC_DE[it.id]; })[0] || {}).nombre : "Banco Central";
    c.appendChild(el("div", "kicker", sec));
    var h = el("h2", "mesa__titulo", it.label);
    var pt = punto(it.id); if (pt) h.insertBefore(pt, h.firstChild);
    c.appendChild(h);
    c.appendChild(el("div", "big", it.valor));
    var un = unidadDe(it); if (un) c.appendChild(el("div", "big__unidad", un));
    var pil = el("div", "pastillas");
    if (ch) pil.appendChild(el("span", "pastilla " + tonoCambio(ch.c), (ch.c > 0 ? "▲ " : ch.c < 0 ? "▼ " : "■ ") + ch.txt + " " + per.txt));
    pil.appendChild(el("span", "pastilla flat", "Dato de " + it.fecha));
    c.appendChild(pil);
    var cb = el("div", "cajon__grafico chart"); c.appendChild(cb);
    var G = window.EconoGlosario && window.EconoGlosario[it.id];
    if (G) {
      var gd = el("div", "cajon__guia");
      [["Qué es", G.q], ["Cómo leerlo", G.l]].forEach(function (x) { var p = el("p", "guia__p"); p.appendChild(el("b", "", x[0] + ". ")); p.appendChild(document.createTextNode(x[1])); gd.appendChild(p); });
      c.appendChild(gd);
    }
    var acc = el("div", "mesa__acciones");
    var ver = el("a", "btn btn--sm", "Ver todo el detalle"); ver.href = "#" + (SEC_DE[it.id] || "bcra") + ":" + it.id; ver.style.textDecoration = "none"; ver.style.display = "inline-flex"; ver.style.alignItems = "center";
    ver.addEventListener("click", function () { cerrarCajon(); });
    acc.appendChild(ver);
    var fav = el("button", "btn btn--ghost btn--sm", favs[it.id] ? "★ Favorito" : "☆ Marcar favorito"); fav.type = "button"; fav.setAttribute("aria-pressed", favs[it.id] ? "true" : "false");
    fav.addEventListener("click", function () {
      if (favs[it.id]) delete favs[it.id]; else favs[it.id] = true;
      guardarFavs(); fav.textContent = favs[it.id] ? "★ Favorito" : "☆ Marcar favorito"; fav.setAttribute("aria-pressed", favs[it.id] ? "true" : "false");
      anunciar(favs[it.id] ? it.label + " agregado a favoritos" : it.label + " quitado de favoritos");
    });
    acc.appendChild(fav);
    c.appendChild(acc);
    cajon.fondo.hidden = false;
    setTimeout(function () {
      cajon.fondo.classList.add("on");
      var serie = recortar(it.s, per.rango);
      if (PUNTO[it.id]) serie.color = PUNTO[it.id];
      if (it.bars || it.t === "ipc") C.bars(cb, { points: serie.points, fmt: it.fmt, titulo: it.label, height: 220, color: it.signed ? function (v) { return v >= 0 ? "var(--c1)" : "var(--c2)"; } : undefined });
      else C.line(cb, { series: [serie], area: true, fmt: it.fmt, titulo: it.label, height: 220 });
      cajon.cierra.focus();
    }, 30);
  }

  /* ---- armado del Inicio ---- */

  function armarInicio() {
    var ids = IDS_DOLARES.concat(IDS_PULSO, IDS_MOV, IDS_VISITA);
    Object.keys(favs).forEach(function (id) { ids.push(id); });
    ids = ids.filter(function (id, i) { return DEFS[id] && ids.indexOf(id) === i; });
    var filas = ids.map(function (id) { var c = {}; Object.keys(DEFS[id]).forEach(function (k) { c[k] = DEFS[id][k]; }); c.g = "Inicio"; return c; });
    var cajas = { dolares: $("inicio-dolares"), favs: $("inicio-favs") };

    var m = crearMesa({
      filas: filas, raiz: document.createElement("div"), vista: "inicio", titulo: "", clave: [], frases: null, sinRegistro: true,
      hashDe: function (it) { return "#" + (SEC_DE[it.id] || "bcra") + ":" + it.id; },
      alTocar: function (it) { abrirCajon(it, "hoy"); },
      alCambiar: pintar
    });
    movMesa = m;
    function grupo(caja, lista) {
      caja.textContent = "";
      lista.forEach(function (id) { var it = m.porId[id]; if (!it) return; var t = m.tarjeta(it); caja.appendChild(t); if (it.ok) destello(t, it); });
    }
    function pintar() {
      pintarPulso(m);
      pintarMovers(false);
      grupo(cajas.dolares, IDS_DOLARES);
      var mis = Object.keys(favs).filter(function (id) { return m.porId[id]; });
      $("inicio-favs-bloque").hidden = !mis.length;
      grupo(cajas.favs, mis);
      Object.keys(m.porId).forEach(function (id) { if (m.porId[id].ok) valoresPrevios[id] = m.porId[id].valor; });
    }
    inicio = { firma: firmaFavs(), pintar: pintar };
    m.armar();
    pintarPeriodos();
    pintar();
  }

  // el Inicio se actualiza solo y avisa cuando algo cambia
  function iniciarRefresco() {
    if (refrescoListo) return;
    refrescoListo = true;
    setInterval(function () { actualizarHace(); }, 30000);
    setInterval(function () {
      var v = $("vista-inicio");
      if (document.visibilityState !== "visible" || !v || v.hidden) return;
      visitaCalculada = true;
      armarInicio();
    }, 5 * 60000);
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

  /* ---------- tabla de todos los indicadores ---------- */

  function armarTabla() {
    var raiz = $("tabla-contenido");
    var lista = [], vistos = {};
    SECCIONES.forEach(function (sec) {
      sec.grupos.forEach(function (gr) { gr[1].forEach(function (id) { if (!vistos[id]) { vistos[id] = 1; lista.push({ id: id, sec: sec.nombre, g: gr[0] }); } }); });
    });
    Object.keys(DEFS).forEach(function (id) { if (!vistos[id]) { vistos[id] = 1; lista.push({ id: id, sec: "Banco Central", g: DEFS[id].g }); } });
    var filas = lista.map(function (x) { var c = {}; Object.keys(DEFS[x.id]).forEach(function (k) { c[k] = DEFS[x.id][k]; }); c.g = x.g; return c; });
    var hd = function (it) { return "#" + (SEC_DE[it.id] || "bcra") + ":" + it.id; };
    var m = crearMesa({ filas: filas, raiz: document.createElement("div"), vista: "tabla", titulo: "", clave: [], frases: null, sinRegistro: true, hashDe: hd, alCambiar: pintar });

    var buscar = el("input", "mesa__buscar"); buscar.type = "search"; buscar.placeholder = "Filtrar la tabla"; buscar.setAttribute("aria-label", "Filtrar la tabla por nombre");
    var estado = el("p", "hint", "Cargando indicadores…");
    var wrap = el("div", "tabla__wrap tabla__wrap--tabla");
    var t = el("table", "tabla tabla--ind");
    t.appendChild(el("caption", "sr-only", "Todos los indicadores: último dato, anterior, variación, máximo y mínimo de los últimos 12 meses"));
    var th = el("thead"), trh = el("tr");
    [["Indicador", ""], ["Último", "num"], ["Anterior", "num"], ["Cambio", "num"], ["Máx. 12 m", "num"], ["Mín. 12 m", "num"], ["Dato de", ""]].forEach(function (c) { var x = el("th", c[1], c[0]); x.scope = "col"; trh.appendChild(x); });
    th.appendChild(trh); t.appendChild(th);
    var tb = el("tbody"); t.appendChild(tb);
    wrap.appendChild(t);
    raiz.appendChild(buscar); raiz.appendChild(estado); raiz.appendChild(wrap);
    var q = "";
    buscar.addEventListener("input", function () { q = norm(buscar.value.trim()); pintar(); });

    function rango12(it) {
      var fin = new Date(it.s.ultimo.d + "T12:00:00").getTime(), corte = new Date(fin - 365 * 86400000).toISOString().slice(0, 10);
      var v = it.s.points.filter(function (p) { return p[0] >= corte; }).map(function (p) { return p[1]; });
      if (!v.length) v = [it.s.ultimo.v];
      return [Math.min.apply(null, v), Math.max.apply(null, v)];
    }
    function pintar() {
      tb.textContent = "";
      var n = 0, listos = 0, grupo = "";
      lista.forEach(function (x) {
        var it = m.porId[x.id]; if (!it) return;
        if (it.ok) listos++;
        if (q && norm(it.label).indexOf(q) === -1) return;
        var nombreG = x.sec + " › " + x.g;
        if (nombreG !== grupo) { grupo = nombreG; var rg = el("tr", "tabla__grupo"); var cg = el("th", "", nombreG); cg.colSpan = 7; cg.scope = "colgroup"; rg.appendChild(cg); tb.appendChild(rg); }
        var tr = el("tr");
        var c1 = el("td"); var a = el("a", "tabla__link"); a.href = hd(it); var pt = punto(it.id); if (pt) a.appendChild(pt); a.appendChild(document.createTextNode(it.label)); c1.appendChild(a); tr.appendChild(c1);
        if (it.ok) {
          var r = rango12(it);
          tr.appendChild(el("td", "num", it.valor));
          tr.appendChild(el("td", "num", it.s.previo ? it.fmt(it.s.previo.v) : "—"));
          tr.appendChild(el("td", "num " + it.tonoPrev, it.dPrevTxt ? flechaDe(it.dPrevTxt, it.dPrev) + it.dPrevTxt : "—"));
          tr.appendChild(el("td", "num", it.fmt(r[1])));
          tr.appendChild(el("td", "num", it.fmt(r[0])));
          tr.appendChild(el("td", it.viejo ? "tono-viejo" : "", it.fecha + (it.viejo ? " (desactualizado)" : "")));
        } else {
          var cm = el("td", "tabla__msg", it.error ? "sin dato" : "cargando…"); cm.colSpan = 6; tr.appendChild(cm);
        }
        tb.appendChild(tr); n++;
      });
      estado.textContent = listos + " de " + lista.length + " indicadores cargados" + (q ? ". Mostrando " + n + " que coinciden." : ". Cada nombre lleva a su gráfico.");
    }
    m.armar();
    pintar();
  }

  /* ---------- aviso de primera vez ---------- */

  var PRIMERA_KEY = "econochanta:v1:primera";
  function iniciarPrimera() {
    var caja = $("primera"), ok = $("primera-ok");
    if (!caja || !ok) return;
    var visto = false;
    try { visto = localStorage.getItem(PRIMERA_KEY) === "1"; } catch (e) { visto = false; }
    caja.hidden = visto;
    ok.addEventListener("click", function () {
      try { localStorage.setItem(PRIMERA_KEY, "1"); } catch (e) { /* sin storage */ }
      caja.hidden = true;
      anunciar("Aviso cerrado");
      var b = $("buscador-input"); if (b) b.focus();
    });
  }

  /* ---------- analisis ---------- */

  function analisisVisibles() {
    var todos = window.EconoAnalisis || [];
    // los borradores y las notas programadas solo se ven en la computadora local o con ?borradores
    var ver = (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /borradores/.test(location.search)) && !/publico/.test(location.search);
    var hoy = hoyISO();
    return todos.filter(function (a) { return ver || (a.publicado && (!a.desde || a.desde <= hoy)); }).sort(function (x, y) { return x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : 0; });
  }
  function hoyISO() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  // etiqueta para el que prepara las notas: borrador o programada (el publico nunca las ve)
  function estadoNota(a) {
    if (!a.publicado) return "Borrador sin revisar";
    if (a.desde && a.desde > hoyISO()) return "Se publica el " + fechaNota(a.desde);
    return "";
  }
  function fechaNota(f) { var d = new Date(f + "T12:00:00"); return d.getDate() + " de " + MESES_L[d.getMonth()] + " de " + d.getFullYear(); }
  function conNegrita(padre, texto) {
    String(texto).split("**").forEach(function (parte, i) { if (parte) padre.appendChild(i % 2 ? el("b", "", parte) : document.createTextNode(parte)); });
  }

  function tarjetaNota(a) {
    var l = el("a", "nota-card"); l.href = "#analisis:" + a.id;
    var cab = el("span", "nota-card__cab");
    cab.appendChild(el("span", "nota-card__tema", a.tema));
    cab.appendChild(el("span", "nota-card__fecha", fechaNota(a.fecha) + " · " + a.minutos + " min de lectura"));
    if (estadoNota(a)) cab.appendChild(el("span", "nota-card__borrador", estadoNota(a)));
    l.appendChild(cab);
    l.appendChild(el("span", "nota-card__titulo", a.titulo));
    l.appendChild(el("span", "nota-card__bajada", a.bajada));
    return l;
  }

  // indicadores en vivo dentro de una nota
  function bloqueDatos(b) {
    var cont = el("section", "nota__datos");
    if (b.titulo) cont.appendChild(el("h3", "nota__sub", b.titulo));
    var grid = el("div", "tarjetas");
    cont.appendChild(grid);
    var ids = b.ids.filter(function (id) { return DEFS[id]; });
    var filas = ids.map(function (id) { var c = {}; Object.keys(DEFS[id]).forEach(function (k) { c[k] = DEFS[id][k]; }); c.g = "Análisis"; return c; });
    var m = crearMesa({ filas: filas, raiz: document.createElement("div"), vista: "analisis", titulo: "", clave: [], frases: null, sinRegistro: true,
      hashDe: function (it) { return "#" + (SEC_DE[it.id] || "bcra") + ":" + it.id; }, alCambiar: pintar });
    function pintar() {
      grid.textContent = "";
      ids.forEach(function (id) { if (m.porId[id]) grid.appendChild(m.tarjeta(m.porId[id])); });
    }
    m.armar();
    pintar();
    if (b.nota) cont.appendChild(el("p", "hint", b.nota));
    return cont;
  }

  function bloqueQuien(b) {
    var cont = el("section", "quien");
    cont.appendChild(el("h3", "nota__sub", b.titulo));
    var g = el("div", "quien__grupos");
    b.grupos.forEach(function (gr, i) {
      var c = el("div", "quien__grupo quien__grupo--" + i);
      c.appendChild(el("h4", "", gr.t));
      var ul = el("ul");
      gr.l.forEach(function (x) { ul.appendChild(el("li", "", x)); });
      c.appendChild(ul); g.appendChild(c);
    });
    cont.appendChild(g);
    if (b.matiz) { var p = el("p", "quien__matiz"); p.appendChild(el("b", "", "Matiz. ")); p.appendChild(document.createTextNode(b.matiz)); cont.appendChild(p); }
    return cont;
  }

  function pintarNota(raiz, a) {
    var art = el("article", "nota");
    var volver = el("a", "link", "← Todos los análisis"); volver.href = "#analisis"; art.appendChild(volver);
    var cab = el("div", "nota__cab");
    cab.appendChild(el("span", "nota-card__tema", a.tema));
    cab.appendChild(el("span", "nota-card__fecha", fechaNota(a.fecha) + " · " + a.minutos + " min de lectura"));
    if (estadoNota(a)) cab.appendChild(el("span", "nota-card__borrador", estadoNota(a)));
    art.appendChild(cab);
    var h = el("h2", "nota__titulo", a.titulo); h.tabIndex = -1; art.appendChild(h);
    art.appendChild(el("p", "nota__bajada", a.bajada));
    a.bloques.forEach(function (b) {
      if (b.t === "p") { var p = el("p", "nota__p"); conNegrita(p, b.x); art.appendChild(p); }
      else if (b.t === "h") art.appendChild(el("h3", "nota__sub", b.x));
      else if (b.t === "datos") art.appendChild(bloqueDatos(b));
      else if (b.t === "quien") art.appendChild(bloqueQuien(b));
      else if (b.t === "mirar") {
        var s1 = el("section", "nota__lista"); s1.appendChild(el("h3", "nota__sub", "Qué mirar ahora"));
        var ul = el("ul"); b.l.forEach(function (x) { ul.appendChild(el("li", "", x)); }); s1.appendChild(ul); art.appendChild(s1);
      } else if (b.t === "fuentes") {
        var s2 = el("section", "nota__lista nota__fuentes"); s2.appendChild(el("h3", "nota__sub", "Fuentes"));
        var ul2 = el("ul");
        b.l.forEach(function (f) { var li = el("li"), a2 = el("a", "", f.n); a2.href = f.u; a2.target = "_blank"; a2.rel = "noopener noreferrer"; li.appendChild(a2); ul2.appendChild(li); });
        s2.appendChild(ul2); art.appendChild(s2);
      } else if (b.t === "aviso") art.appendChild(el("p", "hint nota__aviso", b.x));
    });
    var pie = el("aside", "nota__pie");
    pie.appendChild(el("h3", "nota__sub", "Cómo leer esta nota"));
    pie.appendChild(el("p", "", "Es una lectura de los datos para entender el contexto: no es una recomendación de inversión ni una posición política. Los hechos citados llevan fecha y fuente, y la interpretación está separada y puede discutirse. Las notas se preparan con ayuda de inteligencia artificial a partir de los datos de la app y de las fuentes citadas."));
    var met = el("a", "link", "Cómo se calcula cada indicador"); met.href = "#metodologia"; pie.appendChild(met);
    art.appendChild(pie);
    raiz.appendChild(art);
    document.title = a.titulo + " | Econochanta";
    h.focus({ preventScroll: true });
  }

  function pintarPortadaAnalisis(raiz, lista) {
    raiz.appendChild(el("p", "lead", "Qué pasó, qué dicen los indicadores y a quién le pega o le conviene. Cada nota separa los hechos, con fecha y fuente, de la interpretación, y muestra los indicadores de la app en vivo."));
    if (!lista.length) raiz.appendChild(el("p", "hint", "Todavía no hay análisis publicados."));
    var grid = el("div", "notas");
    lista.forEach(function (a) { grid.appendChild(tarjetaNota(a)); });
    raiz.appendChild(grid);
    var pr = el("article", "card principios");
    pr.appendChild(el("h2", "label", "Cómo hacemos los análisis"));
    var ul = el("ul", "metodo");
    ["Primero los hechos, con fecha y fuente. Después, qué dicen los datos, con los indicadores de la app en vivo.",
      "Después, quién puede salir beneficiado o perjudicado, siempre con matices y mostrando costos y ventajas de cada situación.",
      "No recomendamos inversiones ni tomamos partido.",
      "Si un dato cambia, la nota se actualiza con la fecha.",
      "Las notas se redactan con ayuda de inteligencia artificial a partir de los datos de la app y de las fuentes citadas."].forEach(function (t) { ul.appendChild(el("li", "", t)); });
    pr.appendChild(ul); raiz.appendChild(pr);
  }

  var analisisSub = null, analisisArmado = false;
  function armarAnalisis(sub) {
    if (analisisArmado && sub === analisisSub) return;
    analisisArmado = true; analisisSub = sub;
    var raiz = $("analisis-contenido"); raiz.textContent = "";
    var lista = analisisVisibles();
    var nota = sub ? lista.filter(function (a) { return a.id === sub; })[0] : null;
    if (nota) pintarNota(raiz, nota); else pintarPortadaAnalisis(raiz, lista);
  }

  function pintarInicioAnalisis() {
    var caja = $("inicio-analisis"); if (!caja) return;
    var lista = analisisVisibles();
    caja.textContent = "";
    if (!lista.length) return;
    caja.appendChild(el("h2", "resumen__sub", "Para entender el contexto"));
    caja.appendChild(tarjetaNota(lista[0]));
    var mas = el("a", "link", "Ver todos los análisis"); mas.href = "#analisis"; caja.appendChild(mas);
  }

  /* ---------- datos recientes con lectura ---------- */

  var LECT_ETIQUETA = {
    bien: { icono: "✓", nombre: "Buena señal" },
    mal: { icono: "!", nombre: "Señal de alerta" },
    mixto: { icono: "⇄", nombre: "Mixto" },
    neutro: { icono: "=", nombre: "Neutral" }
  };
  var recientesTema = "Todos";

  function armarRecientes() {
    var raiz = $("recientes-contenido"); raiz.textContent = "";
    var L = window.EconoLectura;
    if (!L) { raiz.appendChild(el("p", "hint", "No se pudieron cargar las lecturas.")); return; }
    var ids = L.ids.concat(L.contexto).filter(function (id, i, a) { return DEFS[id] && a.indexOf(id) === i; });
    var filas = ids.map(function (id) { var c = {}; Object.keys(DEFS[id]).forEach(function (k) { c[k] = DEFS[id][k]; }); c.g = "Recientes"; return c; });

    var aviso = el("p", "rec__aviso");
    aviso.appendChild(document.createTextNode("Lo último que se publicó de cada indicador clave, con una lectura automática de qué significa. No es una opinión: compara cada dato con el anterior, con hace un año, con su propia historia o con otro indicador (por ejemplo, salarios contra inflación). Lo que es bueno para unos puede ser malo para otros: cuando hay dos lados, los mostramos. "));
    var mt = el("a", "link", "Cómo se hacen las lecturas"); mt.href = "#metodologia"; aviso.appendChild(mt);
    raiz.appendChild(aviso);
    var resumen = el("div", "rec__resumen"); raiz.appendChild(resumen);
    var chipsBox = el("div", "chips chips--sm"); chipsBox.setAttribute("role", "group"); chipsBox.setAttribute("aria-label", "Tema"); raiz.appendChild(chipsBox);
    var estado = el("p", "hint"); raiz.appendChild(estado);
    var lista = el("div", "rec__lista"); raiz.appendChild(lista);

    var m = crearMesa({ filas: filas, raiz: document.createElement("div"), vista: "recientes", titulo: "", clave: [], frases: null, sinRegistro: true,
      hashDe: function (it) { return "#" + (SEC_DE[it.id] || "bcra") + ":" + it.id; }, alCambiar: pintar });

    function pintarChips() {
      chipsBox.textContent = "";
      ["Todos"].concat(L.temas).forEach(function (t) { chipsBox.appendChild(chip(t, t === recientesTema, function () { recientesTema = t; pintarChips(); pintar(); })); });
    }

    function tarjetaRec(x) {
      var it = x.it, r = x.r;
      var card = el("article", "rec");
      var izq = el("div", "rec__izq");
      izq.appendChild(el("span", "rec__tema", L.tema(x.id)));
      var h = el("h3", "rec__nom"); var pt = punto(it.id); if (pt) h.appendChild(pt); h.appendChild(document.createTextNode(it.label)); izq.appendChild(h);
      izq.appendChild(el("div", "rec__val", it.valor));
      var un = unidadDe(it); if (un) izq.appendChild(el("div", "rec__un", un));
      var pil = el("div", "pastillas");
      if (it.dPrevTxt) pil.appendChild(el("span", "pastilla " + it.tonoPrev, flechaDe(it.dPrevTxt, it.dPrev) + it.dPrevTxt + (it.mensual ? " vs período anterior" : " vs día anterior")));
      if (it.d12Txt) pil.appendChild(el("span", "pastilla " + it.tono12, flechaDe(it.d12Txt, it.d12) + it.d12Txt + " en 12 meses"));
      pil.appendChild(el("span", "pastilla flat", "Dato de " + it.fecha));
      izq.appendChild(pil);
      card.appendChild(izq);

      var der = el("div", "rec__der");
      if (r) {
        var e = LECT_ETIQUETA[r.v];
        var tag = el("span", "lect lect--" + r.v); tag.appendChild(el("span", "lect__icono", e.icono)); tag.appendChild(document.createTextNode(" " + e.nombre));
        der.appendChild(tag);
        der.appendChild(el("p", "rec__texto", r.t));
        if (r.lados) {
          var ul = el("ul", "rec__lados");
          r.lados.forEach(function (l) { var li = el("li"); li.appendChild(el("b", "", l[0] + " ")); li.appendChild(document.createTextNode(l[1])); ul.appendChild(li); });
          der.appendChild(ul);
        }
        if (r.por && r.por.length) {
          var d = el("details", "rec__por"); d.appendChild(el("summary", "", "Por qué"));
          var up = el("ul"); r.por.forEach(function (t) { up.appendChild(el("li", "", t)); }); d.appendChild(up);
          der.appendChild(d);
        }
      } else der.appendChild(el("p", "hint", "Todavía no hay lectura para este indicador."));
      var ver = el("a", "link", "Ver el indicador"); ver.href = "#" + (SEC_DE[it.id] || "bcra") + ":" + it.id; der.appendChild(ver);
      card.appendChild(der);
      return card;
    }

    function pintar() {
      var items = L.ids.map(function (id) { return { id: id, it: m.porId[id], r: L.leer(id, m.porId) }; }).filter(function (x) { return x.it && x.it.ok; });
      var cuenta = { bien: 0, mal: 0, mixto: 0, neutro: 0 };
      items.forEach(function (x) { if (x.r) cuenta[x.r.v]++; });
      resumen.textContent = "";
      ["bien", "mal", "mixto", "neutro"].forEach(function (k) {
        var c = el("span", "rec__cuenta lect lect--" + k); c.appendChild(el("span", "lect__icono", LECT_ETIQUETA[k].icono)); c.appendChild(document.createTextNode(" " + LECT_ETIQUETA[k].nombre + ": " + cuenta[k]));
        resumen.appendChild(c);
      });
      estado.textContent = items.length < L.ids.length ? "Cargando indicadores… " + items.length + " de " + L.ids.length : "Ordenados del dato más reciente al más viejo.";
      items.sort(function (a, b) { return a.it.s.ultimo.d < b.it.s.ultimo.d ? 1 : a.it.s.ultimo.d > b.it.s.ultimo.d ? -1 : 0; });
      lista.textContent = "";
      items.filter(function (x) { return recientesTema === "Todos" || L.tema(x.id) === recientesTema; }).forEach(function (x) { lista.appendChild(tarjetaRec(x)); });
    }
    pintarChips();
    m.armar();
    pintar();
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

  var bcraMesa = null, mercadosListo = false, hubListo = false, tilesInicio = false, glosarioListo = false, tablaLista = false, recientesListo = false;

  // un link viejo #tablero:id pasa a la seccion que corresponde
  function migrar(sub) { return sub && SEC_DE[sub] ? SEC_DE[sub] + ":" + sub : "inicio"; }

  function mostrar(vista, sub) {
    if (vista === "inicio") {
      if (!tilesInicio) { tilesInicio = true; tiles($("inicio-tiles"), OTRAS_INICIO); }
      if (!buscadorListo) { buscadorListo = true; armarBuscador(); iniciarPrimera(); }
      pintarInicioAnalisis();
      iniciarRefresco();
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
    } else if (vista === "recientes") {
      if (!recientesListo) { recientesListo = true; armarRecientes(); }
    } else if (vista === "analisis") {
      armarAnalisis(sub);
    } else if (vista === "tabla") {
      if (!tablaLista) { tablaLista = true; armarTabla(); }
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

  iniciarPaleta();

  window.EconoTablero = { mostrar: mostrar, migrar: migrar };
})();
