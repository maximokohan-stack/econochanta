/*
 * Analisis: notas que ponen los datos en contexto (que paso, que dicen los indicadores, quien se ve
 * beneficiado o perjudicado y que mirar despues).
 *
 * Reglas de redaccion:
 *  - Primero los hechos, con fecha y fuente. Despues la interpretacion, claramente separada.
 *  - Sin recomendaciones de inversion y sin tomar partido: se muestran ventajas y costos de cada situacion.
 *  - Las cifras que cambian se muestran con indicadores en vivo (bloque "datos"), no escritas en el texto.
 *  - publicado: false deja la nota como borrador: solo se ve en la computadora local o con ?borradores.
 *  - desde: "AAAA-MM-DD" programa la publicacion: la nota aparece sola ese dia (sin servidor ni costo).
 *  - En la computadora local se ven todas; agregar ?publico a la direccion muestra lo que ve el publico.
 *
 * Marcado de los textos: **negrita**. Bloques: h (subtitulo), p (parrafo), datos (indicadores en vivo),
 * quien (beneficiados y perjudicados), mirar (que mirar ahora), fuentes (enlaces).
 */
window.EconoAnalisis = [
  {
    id: "inflacion-septiembre-2026",
    fecha: "2026-10-20",
    tema: "Precios",
    minutos: 4,
    publicado: true,
    desde: "2026-10-20",
    titulo: "Inflación de septiembre: qué subió y a quién le pega más",
    bajada: "Los precios subieron 1,9% en septiembre. El promedio esconde diferencias grandes según en qué gaste cada hogar.",
    bloques: [
      { t: "p", x: "El 13 de octubre el INDEC informó que los precios al consumidor subieron **1,9% en septiembre**, algo más que el 1,7% de agosto. En lo que va de 2026 acumulan **23,6%** y en los últimos doce meses **33,4%**. El dato coincidió con lo que esperaba el relevamiento de expectativas (REM) del Banco Central, aunque algunas consultoras privadas esperaban una cifra un poco más alta." },
      { t: "h", x: "¿Qué fue lo que más subió?" },
      { t: "p", x: "Según el desglose que difundieron los medios, los rubros con más aumento fueron vivienda, agua, electricidad, gas y otros combustibles (**3,1%**), educación (**3,0%**) y los productos estacionales, como las verduras (**2,9%**). Alimentos y bebidas subieron **2,0%**." },
      { t: "p", x: "La inflación núcleo, que deja afuera los precios regulados y los estacionales, fue de **1,7%**, por debajo del promedio general. Eso sugiere que la aceleración vino más de tarifas y de precios de temporada que de una suba generalizada de todo." },
      { t: "datos", titulo: "Lo que muestran los indicadores hoy", ids: ["infM", "infIA", "nucleo", "regulados", "estacionales"],
        nota: "Ojo con las fechas: el INDEC carga los detalles (núcleo, regulados y estacionales) en la base de datos abiertos con más demora que el nivel general, así que esos tres llegan hasta agosto. Las cifras de septiembre que aparecen en el texto son las que informaron los medios." },
      { t: "h", x: "¿Qué significa para tu bolsillo?" },
      { t: "p", x: "El 1,9% es un promedio. Si en tu hogar pesan mucho los servicios, la educación o la verdura, tu inflación del mes fue probablemente mayor. Si gastás más en otros rubros, puede haber sido menor. Para eso existe la sección **Tu plata**, que cruza tus gastos con el índice de cada rubro." },
      {
        t: "quien", titulo: "Quién se ve más y menos afectado",
        grupos: [
          { t: "Más expuestos", l: [
            "Hogares que destinan una parte grande del ingreso a alimentos, servicios y educación, justo donde más subieron los precios.",
            "Quienes cobran un ingreso fijo o que se actualiza con rezago (algunos alquileres, cuotas, honorarios)."
          ] },
          { t: "Mejor parados", l: [
            "Quienes tienen ingresos o contratos que se ajustan por inflación (UVA, CER, ICL) y reciben el ajuste cerca de la fecha.",
            "Quienes deben en pesos a tasa fija: la inflación le va quitando valor real a la deuda.",
            "Ahorristas en pesos, solo si la tasa mensual que reciben supera el 1,9% del mes."
          ] }
        ],
        matiz: "Son tendencias generales. El efecto real depende de cada hogar: tu inflación personal puede ser muy distinta del promedio."
      },
      { t: "h", x: "¿Y los ingresos?" },
      { t: "p", x: "Para saber si ganaste o perdiste poder de compra hay que comparar tu aumento con la inflación del mismo período. Un ejemplo: si en doce meses los precios subieron 33,4%, un sueldo que subió 30% perdió terreno y uno que subió 36% lo ganó." },
      { t: "datos", titulo: "Ingresos de referencia", ids: ["salarios", "smvm", "haber"], nota: "Los salarios del INDEC se publican con rezago, así que el último dato todavía no incluye los aumentos de los últimos meses." },
      { t: "mirar", l: [
        "La inflación de octubre, que se publica a mediados de noviembre. El REM esperaba alrededor de 1,7%.",
        "Los aumentos de tarifas y de otros precios regulados, que fueron los que más empujaron en septiembre.",
        "Si tu plazo fijo cubre la inflación del mes: comparás la tasa mensual (la TNA dividida por 12, aproximadamente) con 1,9%.",
        "La distancia entre la inflación núcleo y la general: si se acercan, la suba se vuelve más generalizada."
      ] },
      { t: "fuentes", l: [
        { n: "Diario Panorama: el INDEC confirmó 1,9% en septiembre y 33,4% en doce meses", u: "https://diariopanorama.com/noticia/569591/indec-confirmo-inflacion-septiembre-fue-19porciento-acumula-334porciento-doce-meses" },
        { n: "Canal 26: 1,9% en septiembre y 23,6% en lo que va de 2026", u: "https://www.canal26.com/economia/2026/10/13/la-inflacion-de-septiembre-fue-de-19-y-acumula-un-alza-de-236-en-lo-que-va-del-2026/" },
        { n: "iProUP: categorías con mayor aumento", u: "https://www.iproup.com/finanzas/72300-indec-confirma-inflacion-de-19-en-septiembre-categorias-con-mayor-aumento.amp" },
        { n: "Infobae: qué esperan los analistas para fin de año (REM)", u: "https://www.infobae.com/economia/2026/10/07/a-cuanto-llegaran-el-dolar-y-la-inflacion-a-fin-de-ano-segun-los-principales-analistas-del-pais/" },
        { n: "INDEC", u: "https://www.indec.gob.ar" }
      ] },
      { t: "aviso", x: "Los porcentajes por rubro son los que informaron los medios citados; conviene contrastarlos con el informe del INDEC." }
    ]
  },
  {
    id: "dolar-brecha-reservas-2026",
    fecha: "2026-10-21",
    tema: "Dólar",
    minutos: 4,
    publicado: true,
    desde: "2026-10-21",
    titulo: "Los dólares y la brecha: qué cuenta cada uno y a quién le conviene qué",
    bajada: "Oficial, MEP, CCL, blue y tarjeta no son el mismo dólar. Entender la diferencia ayuda a leer qué está pasando con el peso.",
    bloques: [
      { t: "p", x: "En Argentina conviven varios dólares y cada uno cuenta una historia distinta. El **oficial** es el que se compra en los bancos. El **MEP** y el **CCL** se consiguen operando bonos: el primero sirve para ahorrar dentro del país y el segundo para sacar plata afuera. El **blue** es el informal. Y el **tarjeta** es el oficial con recargos de impuestos." },
      { t: "datos", titulo: "Las cotizaciones de hoy", ids: ["oficial", "mep", "ccl", "blue", "tarjeta", "brecha"] },
      { t: "h", x: "¿Qué dice la brecha?" },
      { t: "p", x: "La brecha es cuánto más caro es el dólar CCL que el oficial. Una brecha chica indica que hay casi un solo precio y poca tensión. Una brecha grande indica que mucha gente quiere dólares y no los consigue al precio oficial, o que desconfía del peso. Mirá el número de arriba y compará su recorrido en el gráfico de la sección Dólares." },
      { t: "h", x: "El contexto del año" },
      { t: "p", x: "Según notas de comienzos de 2026, el Banco Central retomó la compra sistemática de dólares para recomponer sus reservas y, en febrero, llevaba varias semanas seguidas comprando. Algunos analistas señalaron esas compras como una de las razones de la baja del riesgo país hacia los 500 puntos en esos meses. El riesgo país actual lo ves en el recuadro de abajo." },
      { t: "datos", titulo: "Reservas, compras del Banco Central y riesgo país", ids: ["compras", "reservas", "riesgo"] },
      { t: "p", x: "Para fin de año, el REM del Banco Central (una encuesta a analistas, no una decisión oficial) proyectaba un dólar promedio de alrededor de $1.610 en diciembre. Distintas notas citan cifras algo diferentes según el tipo de cambio que toman. Es una expectativa, no una garantía." },
      {
        t: "quien", titulo: "Quién gana y quién pierde según cómo se mueva el dólar",
        grupos: [
          { t: "Si el dólar sube más que los precios", l: [
            "Favorece a quienes venden al exterior (exportadores) y a quienes ahorran en dólares.",
            "Complica a los importadores, a quienes deben en dólares y a quienes viajan. Además puede trasladarse a los precios."
          ] },
          { t: "Si el dólar se mueve menos que los precios", l: [
            "Abarata en dólares los consumos, los viajes y los insumos importados: mejora el poder de compra en dólares de quienes cobran en pesos.",
            "Complica a los exportadores y a las industrias que compiten con productos importados, y exige que el Banco Central tenga reservas para sostenerlo."
          ] }
        ],
        matiz: "No hay un dólar que sea bueno para todos. La discusión de política económica es qué equilibrio buscar entre estos intereses."
      },
      { t: "mirar", l: [
        "La brecha entre el CCL y el oficial: si se agranda, suele indicar más tensión.",
        "Las compras o ventas diarias de dólares del Banco Central y el nivel de reservas.",
        "El riesgo país, que refleja la confianza de quienes prestan plata al país.",
        "El próximo REM, para ver si las expectativas de dólar e inflación se mueven."
      ] },
      { t: "fuentes", l: [
        { n: "Bloomberg Línea: qué prevén los expertos para fin de 2026 según el REM", u: "https://www.bloomberglinea.com/latinoamerica/argentina/dolar-e-inflacion-que-preven-los-expertos-para-diciembre-de-2026-segun-el-rem-del-bcra-y-bancos/" },
        { n: "Misiones Online: reservas en alza y baja del riesgo país (enero de 2026)", u: "https://misionesonline.net/2026/01/27/baja-del-riesgo-pais/" },
        { n: "Misiones Online: el Banco Central y las reservas (febrero de 2026)", u: "https://misionesonline.net/2026/02/12/banco-central-reservas-febrero-2026/" },
        { n: "Mercado: informe del Club de Finanzas UADE sobre compras del BCRA y riesgo país", u: "https://mercado.com.ar/finanzas/informe-del-club-de-finanzas-uade-compras-del-bcra-y-riesgo-pais-bajo-500" },
        { n: "BCRA", u: "https://www.bcra.gob.ar" }
      ] },
      { t: "aviso", x: "Las cifras de proyecciones vienen de notas periodísticas sobre el REM; para decisiones, consultá el informe original del Banco Central." }
    ]
  },
  {
    id: "cuentas-estado-superavit-2026",
    fecha: "2026-10-22",
    tema: "Cuentas del Estado",
    minutos: 5,
    publicado: true,
    desde: "2026-10-22",
    titulo: "Superávit, intereses y gasto: qué significa que las cuentas del Estado cierren",
    bajada: "Que el Estado recaude más de lo que gasta es un dato. Lo que importa para cada uno es de dónde sale ese resultado y quién lo siente.",
    bloques: [
      { t: "p", x: "Cada mes el Estado nacional cierra con un **resultado primario**: lo que recauda menos lo que gasta, sin contar los intereses de la deuda. Si es positivo, hay superávit primario. Después de pagar los intereses queda el **resultado financiero**, que es el resultado completo." },
      { t: "datos", titulo: "Cómo vienen las cuentas", ids: ["resPrim", "resFin", "intereses", "resPrimAcum", "resFinAcum"] },
      { t: "h", x: "Cómo se lee" },
      { t: "p", x: "Hasta agosto de 2026 el superávit primario acumulado del año es positivo, pero los intereses se llevan una parte importante: por eso el resultado financiero acumulado es bastante menor. Los meses de enero y julio suelen moverse más por el calendario de pagos de deuda que por el comportamiento de la recaudación o del gasto." },
      { t: "h", x: "¿En qué se gasta?" },
      { t: "p", x: "En el último trimestre publicado (abril a junio de 2026), las jubilaciones y pensiones contributivas fueron cerca de la mitad de los gastos primarios que detalla Hacienda, seguidas por sueldos, subsidios, asignaciones y el PAMI. Podés verlo en la torta o el mosaico de Cuentas del Estado." },
      { t: "datos", titulo: "Algunos de los gastos más grandes", ids: ["jubil", "salEstado", "asig", "pami"], nota: "En el detalle de cada indicador ves su variación en 12 meses." },
      {
        t: "quien", titulo: "Quién se ve beneficiado y quién perjudicado",
        grupos: [
          { t: "Cuando hay superávit", l: [
            "Quienes tienen deuda argentina: hay más capacidad de pago, lo que tiende a bajar el riesgo país.",
            "Quienes pagan el costo de la inflación: si el Estado necesita menos financiamiento, hay menos presión para emitir pesos."
          ] },
          { t: "Lo que puede costar", l: [
            "Si el superávit se logra gastando menos, lo sienten quienes dependen de ese gasto: jubilados, provincias, universidades, quienes reciben subsidios o dependen de la obra pública.",
            "Si se logra con más impuestos, lo pagan los contribuyentes y las empresas."
          ] }
        ],
        matiz: "La discusión no es solo cuánto es el superávit, sino cómo se consigue y quién carga con el costo. Dos superávits iguales pueden repartirse de maneras muy distintas."
      },
      { t: "h", x: "El detalle que cambia todo: nominal contra real" },
      { t: "p", x: "En pesos de cada momento casi todo sube, porque hay inflación. Para saber si un gasto o un ingreso creció o cayó de verdad hay que compararlo con la inflación de los últimos doce meses (33,4% a septiembre). Un rubro que creció menos que eso perdió terreno en términos reales. Uno que creció más, lo ganó." },
      { t: "datos", titulo: "Ingresos del Estado", ids: ["recaud", "recaudIA", "iva", "ganancias"] },
      { t: "mirar", l: [
        "El resultado financiero acumulado del año, que incluye los intereses.",
        "Si la recaudación crece más o menos que la inflación (la recaudación interanual).",
        "Las partidas de jubilaciones y de transferencias a provincias en términos reales, no solo en pesos.",
        "Los vencimientos de deuda de enero y julio."
      ] },
      { t: "fuentes", l: [
        { n: "Secretaría de Hacienda: informe mensual de ingresos y gastos (IMIG), vía datos.gob.ar", u: "https://www.economia.gob.ar/datos/" },
        { n: "datos.gob.ar", u: "https://datos.gob.ar" }
      ] },
      { t: "aviso", x: "Las cifras de torta y de rubros son un agrupamiento propio del informe de Hacienda y pueden diferir hasta alrededor de 1% del total oficial. El detalle está en Cómo se calcula." }
    ]
  }
];
