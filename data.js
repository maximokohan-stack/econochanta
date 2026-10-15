/*
 * DATOS DE EJEMPLO (mock). Nada de esto es real ni actual.
 * Cuando el prototipo cierre, este archivo se reemplaza por fetch a
 * BCRA / DolarAPI / ArgentinaDatos (ver README, "Siguiente paso").
 */
window.ECONO_MOCK = {
  esMock: true,
  fecha: "2026-10-15",
  dolar: {
    oficial: 1412,
    mep: 1496,
    ccl: 1531,
    blue: 1545,
    ayer: { oficial: 1410, mep: 1493, ccl: 1527, blue: 1540 },
  },
  inflacionMensual: 3.4,
  inflacionInteranual: 34.2,
  tnaPlazoFijo: 29,
  reservasVar30d: -4.1,
  // 30 puntos del MEP, generados de forma determinista para que el gráfico no cambie entre cargas
  serieMep30d: (function () {
    var out = [];
    var base = 1441;
    for (var i = 0; i < 30; i++) {
      var tendencia = i * 1.9;
      var ruido = Math.sin(i * 1.7) * 6 + Math.cos(i * 0.6) * 4;
      out.push(Math.round(base + tendencia + ruido));
    }
    out[29] = 1496;
    return out;
  })(),
};

window.ECONO_PERFIL_DEFAULT = {
  ingreso: 1200000, // sueldo neto mensual en pesos
  ahorroARS: 500000, // pesos ahorrados (plazo fijo, cuenta)
  ahorroUSD: 800, // dólares ahorrados
  alquiler: 450000, // alquiler o cuota UVA mensual en pesos
  gastoUSD: 150, // gasto mensual en dólares (viajes, suscripciones)
};

window.ECONO_ALERTAS_DEFAULT = {
  mep: { activa: true, umbral: 5 },
  ccl: { activa: true, umbral: 10 },
  blue: { activa: true, umbral: 8 },
};
