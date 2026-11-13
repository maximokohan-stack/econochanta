/*
 * Valores de ejemplo de Tu plata y alertas por defecto.
 * El perfil es una persona inventada y se muestra como ejemplo hasta que cargues tus datos.
 * Los datos de mercado ya no tienen valores de ejemplo: si una fuente falla, la app lo avisa.
 */
window.ECONO_PERFIL_DEFAULT = {
  ingreso: 1200000, // sueldo neto mensual en pesos
  ahorroARS: 500000, // pesos ahorrados (plazo fijo, cuenta)
  ahorroUSD: 800, // dólares ahorrados
  alquiler: 450000, // alquiler o cuota UVA mensual en pesos
  gastoUSD: 150, // gasto mensual en dólares (viajes, suscripciones)
};

window.ECONO_ALERTAS_DEFAULT = {
  mep: { activa: true, umbral: 2 },
  ccl: { activa: true, umbral: 5 },
  blue: { activa: true, umbral: 3 },
};
