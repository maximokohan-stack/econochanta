/*
 * Capa de datos en vivo. Todas las fuentes son publicas y no piden clave:
 *   DolarAPI, ArgentinaDatos, API del BCRA, datos.gob.ar (INDEC) y news.json (propio).
 * Cada pieza falla por separado: si una cae, esa parte queda con el dato de ejemplo
 * (data.js) y se avisa en pantalla cual fue.
 */
(function () {
  "use strict";

  var CACHE_KEY = "econochanta:v1:cache";
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
        serieMep30d: r[1].points.slice(-30).map(function (p) { return p[1]; })
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
      return getJSON("https://apis.datos.gob.ar/series/api/series?ids=" + IPC_IDS[k] + "&limit=8&sort=desc&format=json")
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

  function cargar(opts) {
    var base = JSON.parse(JSON.stringify(window.ECONO_MOCK));
    var estado = { dolar: false, historia: false, inflacion: false, plazoFijo: false, reservas: false, ipc: false, noticias: false };
    var errores = [];
    var out = base;
    out.esMock = true;
    out.ipc = null;
    out.noticias = null;

    function pieza(nombre, p, aplicar) {
      return p.then(function (v) { aplicar(v); estado[nombre] = true; })
        .catch(function (e) { errores.push(nombre + ": " + (e && e.message ? e.message : e)); });
    }

    return Promise.all([
      pieza("dolar", pedirDolar(), function (d) {
        out.dolar.oficial = d.oficial; out.dolar.mep = d.mep; out.dolar.ccl = d.ccl; out.dolar.blue = d.blue;
      }),
      pieza("historia", pedirHistoria(), function (h) {
        out.dolar.ayer = h.ayer;
        if (h.serieMep30d.length >= 10) out.serieMep30d = h.serieMep30d;
      }),
      pieza("inflacion", pedirInflacion(), function (i) {
        out.inflacionMensual = i.mensual; out.inflacionMensualFecha = i.mensualFecha; out.inflacionInteranual = i.interanual;
      }),
      pieza("plazoFijo", pedirPlazoFijo(), function (t) { out.tnaPlazoFijo = Math.round(t * 10) / 10; }),
      pieza("reservas", pedirReservas(), function (r) { out.reservasVar30d = r.var30; out.reservasFecha = r.fecha; }),
      pieza("ipc", pedirIPC(), function (x) { out.ipc = x; }),
      pieza("noticias", pedirNoticias(), function (n) { out.noticias = n; })
    ]).then(function () {
      var ahora = new Date();
      out.fecha = ahora.toISOString().slice(0, 10);
      out.esMock = !(estado.dolar && estado.inflacion);
      out.estado = estado;
      out.errores = errores;
      out.actualizadoEn = ahora.toISOString();
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
      if (!c || !c.datos || !c.datos.dolar) return null;
      return { datos: c.datos, edadMs: Date.now() - c.t, vigente: Date.now() - c.t < TTL_MS };
    } catch (e) { return null; }
  }

  window.EconoAPI = { cargar: cargar, desdeCache: desdeCache, TTL_MS: TTL_MS };
})();
