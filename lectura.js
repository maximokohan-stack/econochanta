/*
 * Lecturas automaticas: una frase corta que pone un dato en contexto y dice si es una buena senal,
 * una senal de alerta, mixta o neutra. No es una opinion: son reglas simples y visibles que comparan
 * el dato con el anterior, con hace 12 meses, con su historia del ultimo ano o con otro indicador.
 *
 * window.EconoLectura.leer(id, P) -> { v: "bien" | "mal" | "mixto" | "neutro", t: texto, por: [renglones], lados: [[quien, que]] } o null
 * P = { id: item } con los indicadores ya cargados (item.s = serie, item.d12 = variacion en 12 meses, item.dPrev = variacion contra el anterior).
 */
(function () {
  "use strict";

  function num(v, d) { var k = d === undefined ? 0 : d; return v.toLocaleString("es-AR", { minimumFractionDigits: k, maximumFractionDigits: k }); }
  function pct(v, d) { return (v > 0 ? "+" : "") + num(v, d === undefined ? 1 : d) + "%"; }
  function ok(it) { return it && it.ok && it.s && it.s.ultimo; }
  function ult(it) { return it.s.ultimo.v; }
  function ant(it) { return it.s.previo ? it.s.previo.v : null; }
  function res(v, t, por, lados) { return { v: v, t: t, por: por || [], lados: lados || null }; }

  // valor de la serie unos dias antes del ultimo dato
  function valorHace(s, dias) {
    var fin = new Date(s.ultimo.d + "T12:00:00").getTime() - dias * 86400000, o = new Date(fin).toISOString().slice(0, 10);
    for (var i = s.points.length - 1; i >= 0; i--) if (s.points[i][0] <= o) return s.points[i][1];
    return null;
  }
  // que porcentaje de los datos de los ultimos `dias` dias fue mas bajo que el actual
  function percentil(s, dias) {
    var fin = new Date(s.ultimo.d + "T12:00:00").getTime(), corte = new Date(fin - dias * 86400000).toISOString().slice(0, 10), cur = s.ultimo.v;
    var v = s.points.filter(function (p) { return p[0] >= corte; }).map(function (p) { return p[1]; });
    if (v.length < 20) return null;
    return v.filter(function (x) { return x < cur; }).length / v.length * 100;
  }
  function tasaReal(P) { return ok(P.badlar) && ok(P.infM) ? ult(P.badlar) * 30 / 365 - ult(P.infM) : null; }

  var R = {};

  /* ---------- precios ---------- */

  R.infM = function (it, P) {
    var c = ult(it), p = ant(it); if (p === null) return null;
    var ia = ok(P.infIA) ? ult(P.infIA) : null, anual = (Math.pow(1 + c / 100, 12) - 1) * 100;
    var por = ["Mes anterior: " + num(p, 1) + "%.", "Si ese ritmo se repitiera todos los meses, serían " + num(anual, 0) + "% en un año" + (ia !== null ? "; los últimos 12 meses acumulan " + num(ia, 1) + "%." : ".")];
    if (c < p - 0.05) return res("bien", "La inflación bajó de " + num(p, 1) + "% a " + num(c, 1) + "%: los precios suben más despacio que el mes anterior.", por);
    if (c > p + 0.05) {
      if (ia !== null && anual < ia) return res("mixto", "Subió de " + num(p, 1) + "% a " + num(c, 1) + "%: se aceleró frente al mes anterior, aunque a ese ritmo el año daría menos que lo acumulado en los últimos 12 meses.", por);
      return res("mal", "Subió de " + num(p, 1) + "% a " + num(c, 1) + "%: se aceleró, y a ese ritmo el año daría más que lo acumulado en los últimos 12 meses.", por);
    }
    return res("neutro", "Se mantuvo en " + num(c, 1) + "%, igual que el mes anterior.", por);
  };

  R.infIA = function (it) {
    var c = ult(it), p = ant(it); if (p === null) return null;
    var por = ["Dato anterior: " + num(p, 1) + "%."];
    if (c < p - 0.05) return res("bien", "El acumulado de 12 meses bajó de " + num(p, 1) + "% a " + num(c, 1) + "%: el ritmo de aumento de precios se viene moderando.", por);
    if (c > p + 0.05) return res("mal", "El acumulado de 12 meses subió de " + num(p, 1) + "% a " + num(c, 1) + "%: el ritmo de aumento de precios se viene acelerando.", por);
    return res("neutro", "El acumulado de 12 meses se mantiene en " + num(c, 1) + "%.", por);
  };

  /* ---------- dolar y mercados ---------- */

  R.oficial = function (it, P) {
    var c = ult(it), h = valorHace(it.s, 365), ia = ok(P.infIA) ? ult(P.infIA) : null;
    if (h === null || ia === null) return null;
    var v = (c / h - 1) * 100;
    var por = ["Hace 12 meses: $ " + num(h, 0) + ".", "Variación del dólar: " + pct(v, 1) + ". Inflación de 12 meses: " + num(ia, 1) + "%."];
    if (v < ia) return res("mixto", "El dólar oficial subió " + num(v, 1) + "% en 12 meses, menos que la inflación (" + num(ia, 1) + "%): en términos reales quedó más barato.", por,
      [["Favorece a", "quienes compran dólares, viajan o importan."], ["Complica a", "exportadores e industrias que compiten con productos importados."]]);
    return res("mixto", "El dólar oficial subió " + num(v, 1) + "% en 12 meses, más que la inflación (" + num(ia, 1) + "%): en términos reales quedó más caro.", por,
      [["Favorece a", "exportadores y a quienes ahorran en dólares."], ["Complica a", "importadores, deudores en dólares y quienes viajan."]]);
  };

  R.brecha = function (it) {
    var c = ult(it), pc = percentil(it.s, 365); if (pc === null) return null;
    var por = ["Ese nivel es más alto que el " + num(pc, 0) + "% de los días de los últimos 12 meses."];
    por.push("Como referencia, una brecha menor a 10% se considera baja.");
    if (pc <= 33 && c < 10) return res("bien", "La brecha es de " + num(c, 1) + "%, de las más bajas del último año: hay poca tensión entre el dólar oficial y el CCL.", por);
    if (pc >= 67 && c >= 10) return res("mal", "La brecha es de " + num(c, 1) + "%, de las más altas del último año: hay más tensión entre el dólar oficial y el CCL.", por);
    if (pc >= 67) return res("mixto", "La brecha es de " + num(c, 1) + "%: es de las más altas del último año, aunque en términos absolutos sigue siendo baja.", por);
    if (pc <= 33) return res("mixto", "La brecha es de " + num(c, 1) + "%: es de las más bajas del último año, aunque sigue siendo alta en términos absolutos.", por);
    return res("mixto", "La brecha es de " + num(c, 1) + "%, en un nivel intermedio comparado con el último año.", por);
  };

  R.riesgo = function (it) {
    var c = ult(it), pc = percentil(it.s, 365), h = valorHace(it.s, 30); if (pc === null) return null;
    var por = ["Está más alto que el " + num(pc, 0) + "% de los días de los últimos 12 meses."].concat(h !== null ? ["Hace 30 días: " + num(h, 0) + " puntos."] : []);
    var tendencia = h !== null ? (c > h ? " y subió en el último mes" : c < h ? " y bajó en el último mes" : "") : "";
    if (pc >= 67) return res("mal", "El riesgo país está en " + num(c, 0) + " puntos, de lo más alto del último año" + tendencia + ": los inversores piden más para prestarle al país.", por);
    if (pc <= 33) return res("bien", "El riesgo país está en " + num(c, 0) + " puntos, de lo más bajo del último año" + tendencia + ": conseguir crédito es más barato.", por);
    return res("mixto", "El riesgo país está en " + num(c, 0) + " puntos, en un nivel intermedio del último año" + tendencia + ".", por);
  };

  R.reservas = function (it) {
    var c = ult(it), h = valorHace(it.s, 30); if (h === null) return null;
    var v = (c / h - 1) * 100, por = ["Hace 30 días: USD " + num(h, 0) + " millones.", "Son reservas brutas: incluyen dólares que el Banco Central debe devolver."];
    if (v > 1) return res("bien", "Las reservas subieron " + num(v, 1) + "% en 30 días: el Banco Central tiene más dólares para respaldar la economía.", por);
    if (v < -1) return res("mal", "Las reservas bajaron " + num(Math.abs(v), 1) + "% en 30 días: el Banco Central tiene menos dólares de respaldo.", por);
    return res("neutro", "Las reservas casi no cambiaron en 30 días (" + pct(v, 1) + ").", por);
  };

  /* ---------- actividad e ingresos ---------- */

  R.emae = function (it) {
    var y = it.d12, m = it.dPrev; if (y === undefined || m === undefined) return null;
    var por = ["Contra el mes anterior: " + pct(m, 1) + ".", "Contra hace 12 meses: " + pct(y, 1) + "."];
    if (y > 0 && m >= 0) return res("bien", "La actividad creció " + num(y, 1) + "% frente a hace un año y no cayó respecto del mes anterior.", por);
    if (y > 0) return res("mixto", "La actividad creció " + num(y, 1) + "% frente a hace un año, pero cayó " + num(Math.abs(m), 1) + "% respecto del mes anterior.", por);
    if (m > 0) return res("mixto", "La actividad sigue " + num(Math.abs(y), 1) + "% por debajo de hace un año, aunque mejoró " + num(m, 1) + "% respecto del mes anterior.", por);
    return res("mal", "La actividad cayó " + num(Math.abs(y), 1) + "% frente a hace un año y " + num(Math.abs(m), 1) + "% respecto del mes anterior.", por);
  };

  R.desoc = function (it) {
    var y = it.d12; if (y === undefined) return null;
    var por = ["Cambio contra hace 12 meses: " + (y > 0 ? "+" : "") + num(y, 1) + " pp.", "No mide la informalidad: quien hace changas cuenta como ocupado."];
    if (y > 0.2) return res("mal", "La desocupación es de " + num(ult(it), 1) + "%, " + num(y, 1) + " puntos más que hace un año.", por);
    if (y < -0.2) return res("bien", "La desocupación es de " + num(ult(it), 1) + "%, " + num(Math.abs(y), 1) + " puntos menos que hace un año.", por);
    return res("neutro", "La desocupación es de " + num(ult(it), 1) + "%, casi igual que hace un año.", por);
  };

  function ingresos(nombre) {
    return function (it, P) {
      var y = it.d12, ia = ok(P.infIA) ? ult(P.infIA) : null; if (y === undefined || ia === null) return null;
      var real = ((1 + y / 100) / (1 + ia / 100) - 1) * 100;
      var por = [nombre + ": " + pct(y, 1) + " en 12 meses (último dato de " + it.fecha + ").", "Inflación de los últimos 12 meses: " + num(ia, 1) + "%.", "Si el último dato es más viejo que el de la inflación, todavía no incluye los aumentos más recientes."];
      if (real > 1) return res("bien", nombre + " subió " + num(y, 1) + "% en 12 meses contra una inflación de " + num(ia, 1) + "%: ganó " + num(real, 1) + "% de poder de compra.", por);
      if (real < -1) return res("mal", nombre + " subió " + num(y, 1) + "% en 12 meses contra una inflación de " + num(ia, 1) + "%: perdió " + num(Math.abs(real), 1) + "% de poder de compra.", por);
      return res("neutro", nombre + " subió " + num(y, 1) + "% en 12 meses, casi igual que la inflación (" + num(ia, 1) + "%): empató.", por);
    };
  }
  R.salarios = ingresos("El salario registrado");
  R.smvm = ingresos("El salario mínimo");
  R.haber = ingresos("El haber mínimo jubilatorio");

  /* ---------- tasas ---------- */

  R.badlar = function (it, P) {
    var t30 = ult(it) * 30 / 365, tr = tasaReal(P); if (tr === null) return null;
    var inf = ult(P.infM);
    var por = ["Tasa nominal anual: " + num(ult(it), 1) + "%. Por 30 días: " + num(t30, 1) + "%.", "Inflación del último mes publicado: " + num(inf, 1) + "%."];
    if (tr > 0.1) return res("mixto", "Un plazo fijo grande rinde " + num(t30, 1) + "% por 30 días, más que la inflación del último mes (" + num(inf, 1) + "%): el ahorro en pesos le gana a los precios.", por,
      [["Favorece a", "quienes ahorran en pesos."], ["Complica a", "quienes se endeudan en pesos: pagan una tasa real positiva."]]);
    if (tr < -0.1) return res("mixto", "Un plazo fijo grande rinde " + num(t30, 1) + "% por 30 días, menos que la inflación del último mes (" + num(inf, 1) + "%): el ahorro en pesos pierde contra los precios.", por,
      [["Favorece a", "quienes se endeudan en pesos: la inflación licúa la deuda."], ["Complica a", "quienes ahorran en pesos."]]);
    return res("neutro", "Un plazo fijo grande rinde " + num(t30, 1) + "% por 30 días, casi lo mismo que la inflación del último mes (" + num(inf, 1) + "%).", por);
  };

  /* ---------- estado y sector externo ---------- */

  R.resPrim = function (it, P) {
    var c = ult(it), acum = ok(P.resPrimAcum) ? ult(P.resPrimAcum) : null, fin = ok(P.resFinAcum) ? ult(P.resFinAcum) : null;
    var f = function (x) { return it.fmt(Math.abs(x)); };
    var por = ["Resultado primario: recaudación menos gastos, sin contar intereses de la deuda.", acum !== null ? "Acumulado del año: " + it.fmt(acum) + "." : "", fin !== null ? "Resultado financiero acumulado del año (con intereses): " + it.fmt(fin) + "." : ""].filter(Boolean);
    if (acum === null) return c >= 0 ? res("bien", "El mes cerró con superávit primario de " + f(c) + ".", por) : res("mal", "El mes cerró con déficit primario de " + f(c) + ".", por);
    if (c >= 0 && acum > 0 && (fin === null || fin > 0)) return res("bien", "Superávit primario de " + f(c) + " en el mes y de " + f(acum) + " en el año, incluso después de pagar intereses.", por);
    if (acum > 0 && fin !== null && fin <= 0) return res("mixto", "Hay superávit primario en el año (" + f(acum) + "), pero los intereses de la deuda lo superan: el resultado financiero es negativo.", por);
    if (acum > 0) return res("mixto", (c >= 0 ? "Superávit primario de " + f(c) + " en el mes" : "Déficit primario de " + f(c) + " en el mes") + ", con superávit en el año (" + f(acum) + ").", por);
    return res("mal", "El año acumula déficit primario de " + f(acum) + ".", por);
  };

  R.recaudIA = function (it, P) {
    var y = ult(it), ia = ok(P.infIA) ? ult(P.infIA) : null; if (ia === null) return null;
    var real = ((1 + y / 100) / (1 + ia / 100) - 1) * 100;
    var por = ["Recaudación: " + pct(y, 1) + " frente a hace un año (en pesos de cada momento).", "Inflación de 12 meses: " + num(ia, 1) + "%."];
    if (real > 1) return res("bien", "La recaudación creció " + num(y, 1) + "% contra una inflación de " + num(ia, 1) + "%: en términos reales creció " + num(real, 1) + "%, lo que suele reflejar más actividad.", por);
    if (real < -1) return res("mal", "La recaudación creció " + num(y, 1) + "% contra una inflación de " + num(ia, 1) + "%: en términos reales cayó " + num(Math.abs(real), 1) + "%.", por);
    return res("neutro", "La recaudación creció " + num(y, 1) + "%, casi igual que la inflación (" + num(ia, 1) + "%).", por);
  };

  R.saldo = function (it) {
    var c = ult(it), p = ant(it), por = p !== null ? ["Mes anterior: " + it.fmt(p) + "."] : [];
    if (c > 0) return res("bien", "Se exportó más de lo que se importó: saldo comercial positivo de " + it.fmt(c) + " en el mes.", por);
    return res("mal", "Se importó más de lo que se exportó: saldo comercial negativo de " + it.fmt(Math.abs(c)) + " en el mes.", por);
  };

  R.bpCC = function (it) {
    var c = ult(it), p = ant(it), por = ["Compara el trimestre con " + (p !== null ? "el anterior (" + it.fmt(p) + ")." : "el anterior."), "Incluye bienes, servicios, intereses, utilidades y transferencias."];
    if (c > 0) return res("bien", "La cuenta corriente tuvo superávit de " + it.fmt(c) + " en el trimestre: entraron más dólares de los que salieron por comercio y rentas.", por);
    return res("mal", "La cuenta corriente tuvo déficit de " + it.fmt(Math.abs(c)) + " en el trimestre: salieron más dólares de los que entraron por comercio y rentas.", por);
  };

  var TEMA = {
    oficial: "Dólar y mercados", brecha: "Dólar y mercados", riesgo: "Dólar y mercados", reservas: "Dólar y mercados",
    infM: "Precios", infIA: "Precios",
    emae: "Actividad e ingresos", desoc: "Actividad e ingresos", salarios: "Actividad e ingresos", smvm: "Actividad e ingresos", haber: "Actividad e ingresos",
    badlar: "Tasas", resPrim: "Estado", recaudIA: "Estado", saldo: "Sector externo", bpCC: "Sector externo"
  };
  var CONTEXTO = ["infM", "infIA", "badlar", "resPrimAcum", "resFinAcum"];

  window.EconoLectura = {
    ids: Object.keys(R),
    contexto: CONTEXTO,
    temas: ["Dólar y mercados", "Precios", "Actividad e ingresos", "Tasas", "Estado", "Sector externo"],
    tema: function (id) { return TEMA[id] || ""; },
    leer: function (id, P) {
      if (!R[id] || !ok(P[id])) return null;
      try { return R[id](P[id], P); } catch (e) { return null; }
    }
  };
})();
