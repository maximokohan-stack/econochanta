/*
 * Catalogo de series y capa de carga para el tablero.
 * Fuentes publicas, sin clave:
 *   ad  = ArgentinaDatos (inflacion, UVA, riesgo pais)
 *   adc = ArgentinaDatos, cotizaciones historicas del dolar (valor = venta)
 *   dg  = datos.gob.ar (INDEC, Hacienda, Trabajo). Una consulta por serie.
 *   bcra = API de estadisticas del BCRA v4.0
 *   d912 = data912 (acciones y bonos en vivo, con demora)
 * Cada serie se carga y falla por separado. Los puntos son [fecha ISO, valor].
 */
(function () {
  "use strict";

  var AD = "https://api.argentinadatos.com/v1/";
  var DG0 = "https://apis.datos.gob.ar/series/api/series?format=json";
  var BCRA = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/";
  var D912 = "https://data912.com/live/";

  var MIN = 60 * 1000, HORA = 60 * MIN;

  /* dec = decimales al mostrar. fmt: n (numero), pct (porcentaje), ars, usd, idx (indice). */
  var CAT = {
    // Dolar
    dOficial: { src: "adc", path: "oficial", label: "Dólar oficial", unit: "ARS", dec: 0, fuente: "ArgentinaDatos", ttl: 10 * MIN },
    dMep: { src: "adc", path: "bolsa", label: "Dólar MEP", unit: "ARS", dec: 0, fuente: "ArgentinaDatos", ttl: 10 * MIN },
    dCcl: { src: "adc", path: "contadoconliqui", label: "Dólar CCL", unit: "ARS", dec: 0, fuente: "ArgentinaDatos", ttl: 10 * MIN },
    dBlue: { src: "adc", path: "blue", label: "Dólar blue", unit: "ARS", dec: 0, fuente: "ArgentinaDatos", ttl: 10 * MIN },
    dTarjeta: { src: "adc", path: "tarjeta", label: "Dólar tarjeta", unit: "ARS", dec: 0, fuente: "ArgentinaDatos", ttl: 10 * MIN },
    dCripto: { src: "adc", path: "cripto", label: "Dólar cripto", unit: "ARS", dec: 0, fuente: "ArgentinaDatos", ttl: 10 * MIN },

    // Inflacion
    infM: { src: "ad", path: "finanzas/indices/inflacion", label: "Inflación mensual", unit: "%", dec: 1, fuente: "INDEC, vía ArgentinaDatos", ttl: 6 * HORA },
    infIA: { src: "ad", path: "finanzas/indices/inflacionInteranual", label: "Inflación interanual", unit: "%", dec: 1, fuente: "INDEC, vía ArgentinaDatos", ttl: 6 * HORA },
    uva: { src: "ad", path: "finanzas/indices/uva", label: "UVA", unit: "ARS", dec: 2, fuente: "BCRA, vía ArgentinaDatos", ttl: 6 * HORA },
    ipcGeneral: { src: "dg", id: "148.3_INIVELNAL_DICI_M_26", label: "IPC nivel general", unit: "índice", dec: 1, fuente: "INDEC, vía datos.gob.ar", ttl: 6 * HORA },
    ipcNucleo: { src: "dg", id: "148.3_INUCLEONAL_DICI_M_19", label: "Núcleo", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    ipcRegulados: { src: "dg", id: "148.3_IREGULANAL_DICI_M_22", label: "Regulados", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    ipcEstacionales: { src: "dg", id: "148.3_IESTACINAL_DICI_M_25", label: "Estacionales", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    ipcTransporte: { src: "dg", id: "146.3_ITRANSPNAL_DICI_M_23", label: "Transporte", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    ipcSalud: { src: "dg", id: "146.3_ISALUDNAL_DICI_M_18", label: "Salud", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    ipcEducacion: { src: "dg", id: "146.3_IEDUCACNAL_DICI_M_22", label: "Educación", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    ipcPrendas: { src: "dg", id: "146.3_IPRENDANAL_DICI_M_35", label: "Prendas de vestir y calzado", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    ipcEquipamiento: { src: "dg", id: "146.3_IEQUIPANAL_DICI_M_46", label: "Equipamiento del hogar", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    ipcComunicaciones: { src: "dg", id: "146.3_ICOMUNINAL_DICI_M_27", label: "Comunicaciones", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    ipcBebidas: { src: "dg", id: "146.3_IBEBIDANAL_DICI_M_39", label: "Bebidas alcohólicas y tabaco", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },

    // Actividad
    emae: { src: "dg", id: "143.3_NO_PR_2004_A_31", label: "EMAE desestacionalizado", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    emaeVM: { src: "dg", id: "143.3_ICE_SER_VM_2004_A_34", label: "EMAE, variación mensual", unit: "%", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    ipi: { src: "dg", id: "453.1_SERIE_DESEADA_0_0_24_58", label: "Industria (IPI), desestacionalizado", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    cemento: { src: "dg", id: "33.4_ISAC_CEMENAND_0_0_21_24", label: "Construcción, insumo cemento", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    pbi: { src: "dg", id: "9.2_PP2_2004_T_16", label: "PBI a precios constantes", unit: "M ARS (2004)", dec: 0, fuente: "INDEC", ttl: 6 * HORA },

    // Empleo y salarios
    desocupacion: { src: "dg", id: "42.3_EPH_PUNTUATAL_0_M_30", mult: 100, label: "Desocupación", unit: "%", dec: 1, fuente: "INDEC (EPH)", ttl: 6 * HORA },
    salarios: { src: "dg", id: "149.1_TL_REGIADO_OCTU_0_16", label: "Índice de salarios, registrado", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    salPrivado: { src: "dg", id: "149.1_SOR_PRIADO_OCTU_0_25", label: "Salarios, sector privado registrado", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    salNoReg: { src: "dg", id: "149.1_SOR_PRIADO_OCTU_0_28", label: "Salarios, sector privado no registrado", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    salPublico: { src: "dg", id: "149.1_SOR_PUBICO_OCTU_0_14", label: "Salarios, sector público", unit: "índice", dec: 1, fuente: "INDEC", ttl: 6 * HORA },
    ripte: { src: "dg", id: "158.1_REPTE_0_0_5", label: "RIPTE", unit: "ARS", dec: 0, fuente: "Secretaría de Trabajo", ttl: 6 * HORA },
    smvm: { src: "dg", id: "57.1_SMVMM_0_M_34", label: "Salario mínimo, vital y móvil", unit: "ARS", dec: 0, fuente: "Consejo del Salario", ttl: 6 * HORA },
    haberMin: { src: "dg", id: "58.1_MP_0_M_13", label: "Haber mínimo jubilatorio", unit: "ARS", dec: 0, fuente: "ANSES", ttl: 6 * HORA },

    // Fiscal
    resPrimario: { src: "dg", id: "452.3_RESULTADO_PIP_0_M_22_71", label: "Resultado primario", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda", ttl: 6 * HORA },
    recaudacion: { src: "dg", id: "172.3_TL_RECAION_M_0_0_17", label: "Recaudación tributaria total", unit: "M ARS", dec: 0, fuente: "ARCA", ttl: 6 * HORA },
    recaudacionIA: { src: "dg", id: "172.3_TL_RECA_IA_M_0_0_24", mult: 100, label: "Recaudación, variación interanual", unit: "%", dec: 1, fuente: "ARCA", ttl: 6 * HORA },


    // Ingresos y gastos del Estado nacional (IMIG, mensual)
    fIva: { src: "dg", id: "452.2_IVA_NETO_RROS_0_T_19_67", label: "IVA, neto de reintegros", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },
    fGanancias: { src: "dg", id: "452.2_GANANCIASIAS_0_T_9_51", label: "Impuesto a las Ganancias", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },
    fAportes: { src: "dg", id: "452.2_APORTES_COIAL_0_T_39_29", label: "Aportes y contribuciones a la seguridad social", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },
    fDerExp: { src: "dg", id: "452.2_DERECHOS_EION_0_T_20_42", label: "Derechos de exportación", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },
    fDebCred: { src: "dg", id: "452.2_DEBITOS_CRTOS_0_T_16_22", label: "Impuesto a los débitos y créditos bancarios", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },
    fBienesPers: { src: "dg", id: "452.2_BIENES_PERLES_0_T_17_26", label: "Bienes personales", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },
    fJubil: { src: "dg", id: "452.2_JUBILACIONVAS_0_T_36_18", label: "Jubilaciones y pensiones contributivas", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },
    fPami: { src: "dg", id: "452.2_PRESTACIONSJP_0_T_19_86", label: "Prestaciones del PAMI (INSSJP)", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },
    fAsig: { src: "dg", id: "452.2_ASIGNACIONIJO_0_T_26_67", label: "Asignaciones familiares y universales", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },
    fPensNC: { src: "dg", id: "452.2_PENSIONES_VAS_0_T_26_164", label: "Pensiones no contributivas", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },
    fSalarios: { src: "dg", id: "452.2_SALARIOSIOS_0_T_8_22", label: "Salarios del Estado nacional", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },
    fIntereses: { src: "dg", id: "452.3_INTERESES_TOS_0_M_15_62", label: "Intereses netos de la deuda", unit: "M ARS", dec: 0, fuente: "Secretaría de Hacienda (IMIG)", ttl: 6 * HORA },

    // Balance de pagos (INDEC, trimestral, millones de dolares)
    bpCC: { src: "dg", id: "160.2_TL_CUENNTE_0_T_22", label: "Cuenta corriente", unit: "M USD", dec: 0, fuente: "INDEC, balance de pagos", ttl: 6 * HORA },
    bpCF: { src: "dg", id: "160.2_TL_CUENERA_0_T_23", label: "Cuenta financiera", unit: "M USD", dec: 0, fuente: "INDEC, balance de pagos", ttl: 6 * HORA },
    bpCap: { src: "dg", id: "160.2_TL_CUENTAL_0_T_20", label: "Cuenta capital", unit: "M USD", dec: 0, fuente: "INDEC, balance de pagos", ttl: 6 * HORA },
    bpBienes: { src: "dg", id: "160.2_CTA_CORNES_0_T_46", label: "Balance de bienes", unit: "M USD", dec: 0, fuente: "INDEC, balance de pagos", ttl: 6 * HORA },
    bpServicios: { src: "dg", id: "160.2_CTA_CORIOS_0_T_49", label: "Balance de servicios", unit: "M USD", dec: 0, fuente: "INDEC, balance de pagos", ttl: 6 * HORA },
    bpEyO: { src: "dg", id: "160.2_ERES_OMTOS_0_T_23", label: "Errores y omisiones netos", unit: "M USD", dec: 0, fuente: "INDEC, balance de pagos", ttl: 6 * HORA },
    bpReservas: { src: "dg", id: "160.2_AVOS_RERVA_0_T_15", label: "Activos de reserva", unit: "M USD", dec: 0, fuente: "INDEC, balance de pagos", ttl: 6 * HORA },

    // Comercio exterior
    expo: { src: "dg", id: "74.3_IET_0_M_16", label: "Exportaciones", unit: "M USD", dec: 0, fuente: "INDEC", ttl: 6 * HORA },
    impo: { src: "dg", id: "74.3_IIT_0_M_25", label: "Importaciones", unit: "M USD", dec: 0, fuente: "INDEC", ttl: 6 * HORA },

    // Dinero (BCRA)
    reservas: { src: "bcra", id: 1, label: "Reservas internacionales", unit: "M USD", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    baseMon: { src: "bcra", id: 15, label: "Base monetaria", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    circulacion: { src: "bcra", id: 16, label: "Circulación monetaria", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    m2IA: { src: "bcra", id: 25, label: "M2 privado, variación interanual", unit: "%", dec: 1, fuente: "BCRA", ttl: 30 * MIN },
    depositos: { src: "bcra", id: 21, label: "Depósitos en efectivo", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    prestamos: { src: "bcra", id: 26, label: "Préstamos al sector privado", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    badlar: { src: "bcra", id: 7, label: "Tasa BADLAR", unit: "%", dec: 1, fuente: "BCRA", ttl: 30 * MIN },
    tamar: { src: "bcra", id: 45, label: "Tasa TAMAR", unit: "%", dec: 1, fuente: "BCRA", ttl: 30 * MIN },
    tasaDep: { src: "bcra", id: 12, label: "Tasa de depósitos a 30 días", unit: "%", dec: 1, fuente: "BCRA", ttl: 30 * MIN },
    tasaPers: { src: "bcra", id: 14, label: "Tasa de préstamos personales", unit: "%", dec: 1, fuente: "BCRA", ttl: 30 * MIN },
    cer: { src: "bcra", id: 30, label: "CER", unit: "índice", dec: 2, fuente: "BCRA", ttl: 30 * MIN },

    // Banco Central: mas series de la API de estadisticas
    reservasSinDEG: { src: "bcra", id: 74, label: "Reservas, sin DEG 2009", unit: "M USD", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    tcMin: { src: "bcra", id: 4, label: "Tipo de cambio minorista", unit: "ARS", dec: 2, fuente: "BCRA", ttl: 30 * MIN },
    tcMay: { src: "bcra", id: 5, label: "Tipo de cambio mayorista de referencia", unit: "ARS", dec: 2, fuente: "BCRA", ttl: 30 * MIN },
    comprasDivisas: { src: "bcra", id: 78, label: "Compras de divisas, variación diaria de reservas", unit: "M USD", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    factTotal: { src: "bcra", id: 46, label: "Total de factores de la base monetaria", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    factCompras: { src: "bcra", id: 47, label: "Compras netas de divisas al sector privado", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    factTesoro: { src: "bcra", id: 48, label: "Compras netas de divisas al Tesoro", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    factPases: { src: "bcra", id: 52, label: "Operaciones de pases", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    factLeliq: { src: "bcra", id: 53, label: "LELIQ y NOTALQ", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    factIntereses: { src: "bcra", id: 55, label: "Intereses, primas y remuneración de cuentas", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    factOtras: { src: "bcra", id: 59, label: "Otras operaciones", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    tasaPases: { src: "bcra", id: 150, label: "Tasa de pases entre terceros a 1 día", unit: "%", dec: 1, fuente: "BCRA", ttl: 30 * MIN },
    tasaAdelantos: { src: "bcra", id: 13, label: "Tasa de adelantos en cuenta corriente", unit: "%", dec: 1, fuente: "BCRA", ttl: 30 * MIN },
    tasaBaibar: { src: "bcra", id: 11, label: "Tasa BAIBAR entre bancos", unit: "%", dec: 1, fuente: "BCRA", ttl: 30 * MIN },
    depCC: { src: "bcra", id: 22, label: "Depósitos en cuenta corriente", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    depCA: { src: "bcra", id: 23, label: "Depósitos en caja de ahorro", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    depPlazo: { src: "bcra", id: 24, label: "Depósitos a plazo", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    credAdelantos: { src: "bcra", id: 110, label: "Préstamos: adelantos", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    credDocumentos: { src: "bcra", id: 111, label: "Préstamos: documentos", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    credHipotecarios: { src: "bcra", id: 112, label: "Préstamos: hipotecarios", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },
    credPrendarios: { src: "bcra", id: 113, label: "Préstamos: prendarios", unit: "M ARS", dec: 0, fuente: "BCRA", ttl: 30 * MIN },

    // Mercados
    riesgo: { src: "ad", path: "finanzas/indices/riesgo-pais", label: "Riesgo país", unit: "pb", dec: 0, fuente: "ArgentinaDatos", ttl: 15 * MIN }
  };

  /* ---------- red ---------- */

  function getJSON(url, ms) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 15000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  function iso(d) { return d.toISOString().slice(0, 10); }

  /* ---------- adaptadores ---------- */

  function pedir(c, n) {
    var hoy = iso(new Date());
    if (c.src === "ad") {
      return getJSON(AD + c.path).then(function (r) {
        return r.filter(function (x) { return x.valor !== null && x.valor !== undefined; })
          .map(function (x) { return [x.fecha, Number(x.valor)]; });
      });
    }
    if (c.src === "adc") {
      return getJSON(AD + "cotizaciones/dolares/" + c.path).then(function (r) {
        return r.filter(function (x) { return x.venta !== null && x.venta !== undefined; })
          .map(function (x) { return [x.fecha, Number(x.venta)]; });
      });
    }
    if (c.src === "dg") {
      // La API devuelve vacio cuando el pedido no encaja con el largo de la serie (limit grande o
      // start_date anterior al inicio), y el criterio cambia de una serie a otra. Se prueban
      // varias formas de pedido hasta que una devuelva datos.
      var m = c.mult || 1;
      var variantes = [];
      [6, 5, 4, 3, 2].forEach(function (a) { variantes.push("&start_date=" + iso(new Date(Date.now() - a * 365 * 86400000))); });
      [120, 60, 36, 24, 12].forEach(function (l) { variantes.push("&sort=desc&limit=" + l); });
      var intentar = function (i) {
        return getJSON(DG0 + "&ids=" + c.id + variantes[i]).then(function (r) {
          var pts = (r.data || []).filter(function (x) { return x[1] !== null && x[1] !== undefined && x[0] <= hoy; })
            .map(function (x) { return [x[0], Number(x[1]) * m]; })
            .sort(function (p, q) { return p[0] < q[0] ? -1 : 1; });
          if (!pts.length && i + 1 < variantes.length) return intentar(i + 1);
          return pts;
        });
      };
      return intentar(0);
    }
    if (c.src === "bcra") {
      var desde = iso(new Date(Date.now() - 800 * 86400000));
      return getJSON(BCRA + c.id + "?desde=" + desde + "&hasta=" + hoy + "&limit=3000", 25000).then(function (r) {
        var det = (r.results && r.results[0] && r.results[0].detalle) || [];
        return det.filter(function (x) { return x.valor !== null && x.valor !== undefined; })
          .map(function (x) { return [x.fecha, Number(x.valor)]; })
          .sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
      });
    }
    return Promise.reject(new Error("fuente desconocida"));
  }

  /* ---------- cache ---------- */

  var mem = {};

  function leerCache(key, ttl) {
    if (mem[key] && Date.now() - mem[key].t < ttl) return mem[key].v;
    try {
      var raw = localStorage.getItem("econochanta:v2:s:" + key);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (Date.now() - o.t < ttl) { mem[key] = o; return o.v; }
    } catch (e) { /* sin storage */ }
    return null;
  }

  function guardarCache(key, v) {
    var o = { t: Date.now(), v: v };
    mem[key] = o;
    try { localStorage.setItem("econochanta:v2:s:" + key, JSON.stringify(o)); } catch (e) { /* cuota */ }
  }

  function enriquecer(key, c, puntos) {
    var n = puntos.length;
    var ult = n ? puntos[n - 1] : null;
    var prev = n > 1 ? puntos[n - 2] : null;
    return {
      key: key, label: c.label, unit: c.unit, dec: c.dec, fuente: c.fuente, points: puntos,
      ultimo: ult ? { d: ult[0], v: ult[1] } : null,
      previo: prev ? { d: prev[0], v: prev[1] } : null
    };
  }

  /* Carga una serie. n = cantidad maxima de puntos que se devuelven.
     Los pedidos en curso se comparten para no bajar dos veces el mismo archivo. */
  var enCurso = {};

  function cargar(key, n) {
    var c = CAT[key];
    if (!c) return Promise.reject(new Error("serie desconocida: " + key));
    var limite = n || 120;
    var cached = leerCache(key, c.ttl);
    if (cached) return Promise.resolve(enriquecer(key, c, cached.slice(-limite)));
    if (!enCurso[key]) {
      enCurso[key] = pedir(c, 400).then(function (puntos) {
        if (!puntos.length) throw new Error("sin datos");
        var recorte = puntos.slice(-1300);
        guardarCache(key, recorte);
        return recorte;
      });
      var limpiar = function () { delete enCurso[key]; };
      enCurso[key].then(limpiar, limpiar);
    }
    return enCurso[key].then(function (recorte) { return enriquecer(key, c, recorte.slice(-limite)); });
  }

  /* Varias series a la vez. Las que fallan quedan en null y se informan en errores. */
  function cargarVarias(keys, n) {
    var out = {}, errores = [];
    return Promise.all(keys.map(function (k) {
      return cargar(k, n).then(function (s) { out[k] = s; }, function (e) { out[k] = null; errores.push(k + ": " + (e && e.message ? e.message : e)); });
    })).then(function () { return { series: out, errores: errores }; });
  }

  var FISCAL_Q = {
    iva: "452.1_IVA_NETO_RROS_0_A_19_89",
    ganancias: "452.1_GANANCIASIAS_0_A_9_40",
    aportes: "452.1_APORTES_COIAL_0_A_39_80",
    derExp: "452.1_DERECHOS_EION_0_A_20_86",
    derImp: "452.1_DERECHOS_IION_0_A_20_41",
    debCred: "452.1_DEBITOS_CRTOS_0_A_16_94",
    combust: "452.1_COMBUSTIBLLES_0_A_12_22",
    bienesPers: "452.1_BIENES_PERLES_0_A_17_92",
    impInternos: "452.1_IMPUESTOS_NOS_0_A_18_32",
    restoTrib: "452.1_RESTO_TRIBIOS_0_A_17_88",
    ingCapital: "452.1_INGRESOS_CTAL_0_A_16_68",
    noTrib: "452.1_INGRESOS_NIOS_0_A_23_61",
    restoCorr: "452.1_RESTO_INGRTES_0_A_25_63",
    transfCorrIng: "452.1_TRANSFERENTES_0_A_25_23",
    rentasFGS: "452.1_FGS_COBRADERO_0_A_53_62",
    rentasResto: "452.1_RESTO_RENTDAD_0_A_22_48",
    otrosFunc: "452.2_OTROS_GASTNTO_0_T_27_58",
    salarios: "452.2_SALARIOSIOS_0_T_8_28",
    defEmpresas: "452.2_OTROS_CORRCAS_0_T_52_21",
    otrosCorr: "452.2_OTROS_CORRSTO_0_T_22_15",
    univ: "452.2_OTROS_CORRDES_0_T_45_20",
    asignaciones: "452.2_ASIGNACIONIJO_0_T_26_195",
    jubil: "452.1_JUBILACIONVAS_0_A_36_30",
    otrosProg: "452.2_OTROS_PROGMAS_0_T_15_7",
    pensNC: "452.2_PENSIONES_VAS_0_T_26_93",
    pami: "452.2_PRESTACIONSJP_0_T_19_19",
    subsEnergia: "452.2_ENERGIAGIA_0_T_7_79",
    subsOtras: "452.2_OTRAS_FUNCNES_0_T_15_27",
    subsTransp: "452.2_TRANSPORTERTE_0_T_10_81",
    tpDesarrollo: "452.2_TRANSFERENIAL_0_T_54_18",
    tpEduc: "452.2_TRANSFERENION_0_T_46_39",
    tpOtras: "452.2_TRANSFERENRAS_0_T_42_54",
    tpSalud: "452.2_TRANSFERENLUD_0_T_42_99",
    tpSegSocial: "452.2_TRANSFERENIAL_0_T_53_76",
    capAguaN: "452.2_CAPITAL_AGION_0_T_41_79",
    capAguaP: "452.2_CAPITAL_AGIAS_0_T_59_85",
    capEducN: "452.2_CAPITAL_EDION_0_T_24_98",
    capEducP: "452.2_CAPITAL_EDIAS_0_T_42_72",
    capEnergN: "452.2_CAPITAL_ENION_0_T_22_25",
    capEnergP: "452.2_CAPITAL_ENIAS_0_T_40_14",
    ffs: "452.2_FONDO_FEDERIO_0_T_23_1",
    capOtrosN: "452.2_CAPITAL_OTION_0_T_20_97",
    capOtrosP: "452.2_CAPITAL_OTIAS_0_T_38_17",
    capTranspN: "452.2_CAPITAL_TRION_0_T_25_18",
    capTranspP: "452.2_CAPITAL_TRIAS_0_T_43_2",
    capViviN: "452.2_CAPITAL_VIION_0_T_23_91",
    capViviP: "452.2_CAPITAL_VIIAS_0_T_41_33",
    resPrim: "452.2_RESULTADO_RIO_0_T_18_21",
    intereses: "452.2_INTERESES_TOS_0_T_15_4",
    resFin: "452.2_RESULTADO_ERO_0_T_20_32"
  };

  /* Ingresos y gastos por rubro: el informe de Hacienda (IMIG) solo trae el detalle completo por trimestre.
     Se piden de a 25 series (el limite de la API es 40) y se devuelven como { clave: [[fecha, valor], ...] }.
     La fecha es el inicio del trimestre (2026-04-01 es abril a junio). */
  var fiscalMem = null, fiscalEnCurso = null;

  function fiscalTrimestral() {
    if (fiscalMem && Date.now() - fiscalMem.t < 6 * HORA) return Promise.resolve(fiscalMem.v);
    try {
      var raw = localStorage.getItem("econochanta:v2:fiscalq");
      if (raw) { var o = JSON.parse(raw); if (Date.now() - o.t < 6 * HORA) { fiscalMem = o; return Promise.resolve(o.v); } }
    } catch (e) { /* sin storage */ }
    if (fiscalEnCurso) return fiscalEnCurso;
    var claves = Object.keys(FISCAL_Q), lotes = [];
    for (var i = 0; i < claves.length; i += 25) lotes.push(claves.slice(i, i + 25));
    var hoy = iso(new Date());
    var pedirLote = function (lote) {
      var ids = lote.map(function (k) { return FISCAL_Q[k]; }).join(",");
      var intentar = function (limites, j) {
        return getJSON(DG0 + "&ids=" + ids + "&sort=desc&limit=" + limites[j]).then(function (r) {
          if ((!r.data || !r.data.length) && j + 1 < limites.length) return intentar(limites, j + 1);
          return r.data || [];
        });
      };
      return intentar([40, 32, 24, 16], 0);
    };
    fiscalEnCurso = Promise.all(lotes.map(pedirLote)).then(function (res) {
      var out = {};
      res.forEach(function (filas, li) {
        lotes[li].forEach(function (k, ci) {
          out[k] = filas.filter(function (f) { return f[0] <= hoy; })
            .map(function (f) { return [f[0], f[ci + 1] === null || f[ci + 1] === undefined ? null : Number(f[ci + 1])]; })
            .sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
        });
      });
      if (!out.resPrim || !out.resPrim.length) throw new Error("sin datos fiscales");
      fiscalMem = { t: Date.now(), v: out };
      try { localStorage.setItem("econochanta:v2:fiscalq", JSON.stringify(fiscalMem)); } catch (e) { /* cuota */ }
      return out;
    });
    var limpiar = function () { fiscalEnCurso = null; };
    fiscalEnCurso.then(limpiar, limpiar);
    return fiscalEnCurso;
  }

  /* Compra y venta del dolar (DolarAPI), con la hora de la ultima actualizacion. Clave = clave de la serie. */
  var cotMem = null, cotEnCurso = null;
  function cotizacionesDolar() {
    if (cotMem && Date.now() - cotMem.t < 10 * MIN) return Promise.resolve(cotMem.v);
    if (cotEnCurso) return cotEnCurso;
    var casas = { dOficial: "oficial", dMep: "bolsa", dCcl: "contadoconliqui", dBlue: "blue", dTarjeta: "tarjeta", dCripto: "cripto" };
    cotEnCurso = getJSON("https://dolarapi.com/v1/dolares", 15000).then(function (lista) {
      var por = {}, out = {};
      lista.forEach(function (d) { por[d.casa] = d; });
      Object.keys(casas).forEach(function (k) {
        var d = por[casas[k]];
        if (d && isFinite(Number(d.compra)) && isFinite(Number(d.venta))) out[k] = { compra: Number(d.compra), venta: Number(d.venta), fecha: d.fechaActualizacion };
      });
      cotMem = { t: Date.now(), v: out };
      return out;
    });
    var limpiar = function () { cotEnCurso = null; };
    cotEnCurso.then(limpiar, limpiar);
    return cotEnCurso;
  }

  /* ---------- mercado en vivo ---------- */

  var liveMem = {};
  function live(panel) {
    var hit = liveMem[panel];
    if (hit && Date.now() - hit.t < 2 * MIN) return Promise.resolve(hit.v);
    return getJSON(D912 + panel, 20000).then(function (r) {
      if (!Array.isArray(r)) throw new Error("respuesta inesperada");
      liveMem[panel] = { t: Date.now(), v: r };
      return r;
    });
  }

  /* ---------- cotizaciones de monedas (BCRA, estadisticas cambiarias) ---------- */

  var monedasMem = null;
  function monedas() {
    if (monedasMem && Date.now() - monedasMem.t < 30 * MIN) return Promise.resolve(monedasMem.v);
    return getJSON("https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones", 20000).then(function (r) {
      var det = r.results && r.results.detalle;
      if (!Array.isArray(det) || !det.length) throw new Error("sin cotizaciones");
      var v = { fecha: r.results.fecha, detalle: det };
      monedasMem = { t: Date.now(), v: v };
      return v;
    });
  }

  /* ---------- derivadas ---------- */

  // a - b alineando por fecha
  function restar(a, b, label) {
    var mb = {};
    b.points.forEach(function (p) { mb[p[0]] = p[1]; });
    var pts = [];
    a.points.forEach(function (p) { if (mb[p[0]] !== undefined) pts.push([p[0], p[1] - mb[p[0]]]); });
    var n = pts.length;
    return {
      key: "saldo", label: label, unit: a.unit, dec: a.dec, fuente: a.fuente, points: pts,
      ultimo: n ? { d: pts[n - 1][0], v: pts[n - 1][1] } : null,
      previo: n > 1 ? { d: pts[n - 2][0], v: pts[n - 2][1] } : null
    };
  }

  // variacion porcentual entre el ultimo punto y el de hace `meses` (por fecha)
  function variacion(serie, meses) {
    if (!serie || !serie.points.length) return null;
    var ult = serie.points[serie.points.length - 1];
    var d = new Date(ult[0] + "T12:00:00");
    d.setMonth(d.getMonth() - meses);
    var objetivo = iso(d);
    var ref = null;
    for (var i = serie.points.length - 1; i >= 0; i--) {
      if (serie.points[i][0] <= objetivo) { ref = serie.points[i]; break; }
    }
    if (!ref || !ref[1]) return null;
    return (ult[1] / ref[1] - 1) * 100;
  }

  // variacion mensual porcentual de cada punto de un indice (para barras)
  function variacionesMensuales(serie) {
    var out = [];
    for (var i = 1; i < serie.points.length; i++) {
      out.push([serie.points[i][0], (serie.points[i][1] / serie.points[i - 1][1] - 1) * 100]);
    }
    return out;
  }

  window.EconoSeries = {
    CAT: CAT, fiscalTrimestral: fiscalTrimestral, cotizacionesDolar: cotizacionesDolar, cargar: cargar, cargarVarias: cargarVarias, live: live, monedas: monedas,
    restar: restar, variacion: variacion, variacionesMensuales: variacionesMensuales
  };
})();
