/*
 * Capa de datos en vivo. Todas las fuentes son publicas y no piden clave:
 *   DolarAPI, ArgentinaDatos, API del BCRA, datos.gob.ar (INDEC) y news.json (propio).
 * Cada pieza falla por separado: si una cae, se conserva el último dato real que había
 * (marcado como "previo") o queda sin dato ("falta"). Nunca se rellena con valores de ejemplo.
 */
(function () {
  "use strict";

  var CACHE_KEY = "econochanta:v2:cache"; // v2: sin datos de ejemplo mezclados
  var TTL_MS = 5 * 60 * 1000;

  var IPC_IDS = {
    general: "148.3_INIVELNAL_DICI_M_26",
    transporte: "146.3_ITRANSPNAL_DICI_M_23",
    salud: "146.3_ISALUDNAL_DICI_M_18",
    recreacion: "146.3_IRECREANAL_DICI_M_31",
    educacion: "146.3_IEDUCACNAL_DICI_M_22",
    prendas: "146.3_IPRENDANAL_DICI_M_35",
    equipamiento: "146.3_IEQUIPANAL_DICI_M_46",
    comunicaciones: "146.3_ICOMUNINAL_DICI_M_27"
  };

  function getJSON(url, ms) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 25000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (timer) clearTimeout(timer);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }, function (e) {
        if (timer) clearTimeout(timer);
        throw e;
      });
  }

  function mediana(arr) {
    var a = arr.slice().sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }

  /* ---- piezas ---- */

  function pedirDolar() {
    return getJSON("https://dolarapi.com/v1/dolares").then(function (lista) {
      var por = {};
      lista.forEach(function (d) { por[d.casa] = d; });
      var out = {
        oficial: num(por.oficial && por.oficial.venta),
        mep: num(por.bolsa && por.bolsa.venta),
        ccl: num(por.contadoconliqui && por.contadoconliqui.venta),
        blue: num(por.blue && por.blue.venta),
        mayorista: num(por.mayorista && por.mayorista.venta)
      };
      if (!out.oficial || !out.mep || !out.ccl || !out.blue) throw new Error("cotizaciones incompletas");
      return out;
    });
  }

  function pedirHistoria() {
    var S = window.EconoSeries;
    return Promise.all(["dOficial", "dMep", "dCcl", "dBlue"].map(function (k) { return S.cargar(k, 60); })).then(function (r) {
      function ayer(serie) {
        var ult = serie.ultimo.d;
        for (var i = serie.points.length - 1; i >= 0; i--) if (serie.points[i][0] < ult) return serie.points[i][1];
        return serie.ultimo.v;
      }
      return {
        ayer: { oficial: ayer(r[0]), mep: ayer(r[1]), ccl: ayer(r[2]), blue: ayer(r[3]) },
        serieMep30d: r[1].points.slice(-30).map(function (p) { return p[1]; }),
        fecha: r[1].ultimo.d
      };
    });
  }

  function pedirInflacion() {
    var S = window.EconoSeries;
    return Promise.all([S.cargar("infM", 3), S.cargar("infIA", 3)]).then(function (r) {
      return { mensual: r[0].ultimo.v, mensualFecha: r[0].ultimo.d, interanual: r[1].ultimo.v };
    });
  }

  function pedirPlazoFijo() {
    return getJSON("https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo").then(function (l) {
      var tasas = l.map(function (b) { return num(b.tnaClientes); }).filter(function (v) { return v && v > 0; });
      var med = mediana(tasas);
      if (med === null) throw new Error("sin tasas");
      return med * 100;
    });
  }

  function pedirReservas() {
    return window.EconoSeries.cargar("reservas", 120).then(function (serie) {
      var ult = serie.ultimo;
      var objetivo = new Date(new Date(ult.d).getTime() - 30 * 86400000).toISOString().slice(0, 10);
      var previo = null;
      for (var i = serie.points.length - 1; i >= 0; i--) if (serie.points[i][0] <= objetivo) { previo = serie.points[i]; break; }
      if (!previo) previo = serie.points[0];
      return { valor: ult.v, fecha: ult.d, var30: (ult.v / previo[1] - 1) * 100 };
    });
  }

  function mesesEntre(a, b) {
    var da = new Date(a + "T12:00:00"), db = new Date(b + "T12:00:00");
    return Math.max(1, (db.getFullYear() - da.getFullYear()) * 12 + db.getMonth() - da.getMonth());
  }

  /* Una consulta por serie: al pedirlas juntas la API alinea fechas y deja huecos. */
  function pedirIPC() {
    var claves = Object.keys(IPC_IDS);
    return Promise.all(claves.map(function (k) {
      return getJSON("https://apis.datos.gob.ar/series/api/series/?ids=" + IPC_IDS[k] + "&limit=8&sort=desc&format=json")
        .then(function (r) {
          var puntos = (r.data || []).filter(function (x) { return x[1] !== null && x[1] !== undefined; });
          if (puntos.length < 2) return null;
          var ult = puntos[0], prev = puntos[1];
          var gap = mesesEntre(prev[0], ult[0]);
          var mom = (Math.pow(ult[1] / prev[1], 1 / gap) - 1) * 100;
          return { k: k, mom: mom, fecha: ult[0] };
        }, function () { return null; });
    })).then(function (filas) {
      var out = {};
      filas.forEach(function (f) { if (f) out[f.k] = { mom: f.mom, fecha: f.fecha }; });
      if (!out.general) throw new Error("sin IPC general");
      return out;
    });
  }

  function pedirNoticias() {
    var hora = Math.floor(Date.now() / 600000);
    return getJSON("news.json?h=" + hora).then(function (n) {
      if (!n || !Array.isArray(n.items)) throw new Error("news.json invalido");
      return n;
    });
  }

  /* ---- orquestador ---- */

  // de dónde sale cada pieza (proveedor concreto, no "oficial" en general)
  var FUENTES = {
    dolar: "DolarAPI (dolarapi.com), precio de venta",
    historia: "ArgentinaDatos (api.argentinadatos.com)",
    inflacion: "INDEC, vía datos.gob.ar",
    plazoFijo: "ArgentinaDatos, mediana de la TNA que publican los bancos",
    reservas: "BCRA, API de estadísticas",
    ipc: "INDEC, vía datos.gob.ar",
    noticias: "Titulares de medios (news.json propio)"
  };

  function vacio() {
    return {
      dolar: { oficial: null, mep: null, ccl: null, blue: null, ayer: null },
      serieMep30d: null, inflacionMensual: null, inflacionMensualFecha: null, inflacionInteranual: null,
      tnaPlazoFijo: null, reservasVar30d: null, reservasFecha: null, ipc: null, noticias: null,
      meta: {}, actualizadoEn: null
    };
  }

  // Cada pieza falla por separado. Si una falla:
  // - si hay un valor real de una consulta anterior, se conserva y queda marcado como "previo" (último dato disponible);
  // - si no, queda en null y marcado como "falta". Nunca se completa con un valor de ejemplo.
  function cargar(prev) {
    var out = vacio();
    var errores = [];
    var ahora = new Date().toISOString();

    function copiarPrevio(nombre, campos) {
      if (!prev || !prev.meta || !prev.meta[nombre] || prev.meta[nombre].estado === "falta") return false;
      campos.forEach(function (c) {
        if (c.indexOf("dolar.") === 0) out.dolar[c.slice(6)] = prev.dolar ? prev.dolar[c.slice(6)] : null;
        else out[c] = prev[c];
      });
      out.meta[nombre] = { estado: "previo", fuente: FUENTES[nombre], periodo: prev.meta[nombre].periodo, consultado: prev.meta[nombre].consultado };
      return true;
    }

    function pieza(nombre, p, campos, aplicar) {
      return p.then(function (v) {
        var periodo = aplicar(v);
        out.meta[nombre] = { estado: "ok", fuente: FUENTES[nombre], periodo: periodo || ahora, consultado: ahora };
      }).catch(function (e) {
        errores.push(nombre + ": " + (e && e.message ? e.message : e));
        if (!copiarPrevio(nombre, campos)) out.meta[nombre] = { estado: "falta", fuente: FUENTES[nombre], periodo: null, consultado: ahora };
      });
    }

    return Promise.all([
      pieza("dolar", pedirDolar(), ["dolar.oficial", "dolar.mep", "dolar.ccl", "dolar.blue"], function (d) {
        out.dolar.oficial = d.oficial; out.dolar.mep = d.mep; out.dolar.ccl = d.ccl; out.dolar.blue = d.blue;
        return ahora;
      }),
      pieza("historia", pedirHistoria(), ["dolar.ayer", "serieMep30d"], function (h) {
        out.dolar.ayer = h.ayer;
        out.serieMep30d = h.serieMep30d.length >= 10 ? h.serieMep30d : null;
        if (!out.serieMep30d) throw new Error("serie corta");
        return h.fecha || null;
      }),
      pieza("inflacion", pedirInflacion(), ["inflacionMensual", "inflacionMensualFecha", "inflacionInteranual"], function (i) {
        out.inflacionMensual = i.mensual; out.inflacionMensualFecha = i.mensualFecha; out.inflacionInteranual = i.interanual;
        return i.mensualFecha;
      }),
      pieza("plazoFijo", pedirPlazoFijo(), ["tnaPlazoFijo"], function (t) { out.tnaPlazoFijo = Math.round(t * 10) / 10; return ahora; }),
      pieza("reservas", pedirReservas(), ["reservasVar30d", "reservasFecha"], function (r) { out.reservasVar30d = r.var30; out.reservasFecha = r.fecha; return r.fecha; }),
      pieza("ipc", pedirIPC(), ["ipc"], function (x) { out.ipc = x; return x.general.fecha; }),
      pieza("noticias", pedirNoticias(), ["noticias"], function (n) { out.noticias = n; return n.actualizado || ahora; })
    ]).then(function () {
      out.fecha = ahora.slice(0, 10);
      out.errores = errores;
      out.actualizadoEn = ahora;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), datos: out }));
      } catch (e) { /* sin storage */ }
      return out;
    });
  }

  function desdeCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || !c.datos || !c.datos.meta) return null;
      return { datos: c.datos, edadMs: Date.now() - c.t, vigente: Date.now() - c.t < TTL_MS };
    } catch (e) { return null; }
  }

  window.EconoAPI = { cargar: cargar, desdeCache: desdeCache, vacio: vacio, FUENTES: FUENTES, TTL_MS: TTL_MS };
})();
