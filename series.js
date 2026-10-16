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
    CAT: CAT, cargar: cargar, cargarVarias: cargarVarias, live: live, monedas: monedas,
    restar: restar, variacion: variacion, variacionesMensuales: variacionesMensuales
  };
})();
