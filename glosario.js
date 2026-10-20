/*
 * Glosario: que mide cada indicador, como se mide y como leerlo, en lenguaje de todos los dias.
 * Por cada id: q = que es, c = como se mide, l = como leerlo, o = ojo con (opcional).
 * No lleva cifras que cambien con el tiempo: para eso esta el dato en vivo.
 */
(function () {
  "use strict";

  var RUBRO = function (nombre, incluye) {
    return {
      q: "Cuánto subieron en el mes los precios de " + nombre + ".",
      c: "El INDEC sigue los precios de " + incluye + " en las mismas tiendas y servicios todos los meses y calcula cuánto cambió el promedio. Es una de las divisiones del índice de precios al consumidor (IPC).",
      l: "Comparalo con la inflación general del mismo mes: si este rubro sube más, es de lo que más se encareció; si sube menos, ayudó a que la inflación no fuera mayor."
    };
  };

  var G = {
    /* ---------- dólares ---------- */
    oficial: {
      q: "El precio del dólar en los bancos, el que paga cualquiera que lo compra por la vía formal.",
      c: "Se toma la cotización de venta que publican los bancos y se promedia. Es el precio en pesos de 1 dólar.",
      l: "Si pasa de $1.000 a $1.100, el dólar subió 10%. Que el dólar suba no es lo mismo que que suba la inflación: puede subir menos, igual o más que los precios.",
      o: "Es el precio minorista. El que usan las empresas para importar y exportar es el mayorista."
    },
    mep: {
      q: "Un dólar legal que se consigue comprando un bono con pesos y vendiéndolo en dólares.",
      c: "Se compra un bono en pesos y se lo vende en dólares. La cuenta entre pesos pagados y dólares recibidos da el precio. Los dólares quedan en una cuenta en Argentina.",
      l: "Es el dólar que usa quien ahorra en dólares sin salir del sistema. Cuando se separa del oficial, el mercado está diciendo que el oficial se quedó corto.",
      o: "Cotiza en el mercado de bonos, así que cambia durante el día y sigue el horario de la bolsa."
    },
    ccl: {
      q: "El dólar que sirve para sacar plata del país: los dólares quedan en una cuenta en el exterior.",
      c: "Se compra un bono en pesos y se lo vende contra dólares en el exterior. El precio sale de la relación entre ambos.",
      l: "Compararlo con el oficial da la brecha. Cuanto más caro sea el CCL, más cuesta sacar dólares del país.",
      o: "No es el dólar que paga una persona común para ahorrar: lo mira más el mundo financiero y las empresas."
    },
    blue: {
      q: "El dólar del mercado informal, el que se compra en cuevas y con arbolitos.",
      c: "Se toma el precio que informan casas de cambio informales y relevamientos de mercado.",
      l: "Sirve de referencia de cuánto vale el dólar fuera del circuito formal. Cuando se aleja mucho del oficial, suele haber restricciones o desconfianza.",
      o: "Es un mercado sin control ni registro. No es una cotización oficial."
    },
    tarjeta: {
      q: "El dólar con el que se valúan los consumos en dólares con tarjeta, en el exterior y en servicios del exterior.",
      c: "Es el dólar oficial más los recargos de impuestos que se aplican a esos pagos. DolarAPI informa su cotización de venta.",
      l: "Cuando la diferencia con el oficial cambia, suele ser por impuestos y no porque se mueva el mercado. Sirve para saber cuánto te cuesta pagar en dólares con tarjeta.",
      o: "Los recargos dependen de la norma vigente y pueden cambiar. Mirá siempre la fecha del dato."
    },
    cripto: {
      q: "El precio del dólar que se consigue comprando dólares digitales (como USDT) con pesos en plataformas de intercambio.",
      c: "Se toma la cotización de venta que informan esas plataformas. Es un mercado que opera todo el día y todos los días.",
      l: "Suele moverse parecido al MEP y al CCL. Si se aleja de ellos, algo se está tensando en ese mercado.",
      o: "Es un dólar digital: tiene riesgos propios (de la plataforma y del activo) y no es lo mismo que tener dólares en una cuenta bancaria."
    },
    brecha: {
      q: "Cuánto más caro es el dólar CCL que el oficial, en porcentaje.",
      c: "Se divide el dólar CCL por el oficial y se le resta 1. Una brecha del 10% significa que por cada $100 del dólar oficial, el CCL cuesta $110.",
      l: "Una brecha cerca de cero indica que hay un solo precio y poca tensión. Una brecha grande indica que mucha gente quiere dólares y no los consigue al precio oficial, o desconfía del peso.",
      o: "Si sube la brecha no necesariamente sube el oficial: puede subir el CCL."
    },
    tcMay: {
      q: "El precio del dólar entre bancos y grandes empresas. Es el que se usa para el comercio exterior y el que mira el Banco Central.",
      c: "Es la cotización de referencia que calcula el BCRA con las operaciones del mercado de cambios.",
      l: "Se mueve igual que el oficial pero sin el margen de los bancos. Es el precio \"mayorista\": el que paga una empresa que importa, no el que ves en una pantalla de banco.",
      o: "Es un precio de referencia del día, no la cotización a la que podés comprar."
    },
    tcMin: {
      q: "El precio al que los bancos le venden dólares al público, según el BCRA.",
      c: "Es el promedio de lo que cobran los bancos por dólar a clientes minoristas.",
      l: "La diferencia con el mayorista es el margen del banco. Si ambos se mueven juntos, no hay nada raro.",
      o: "Es parecido al dólar oficial que figura en Dólares, pero de otra fuente."
    },
    compras: {
      q: "Cuántos dólares compró (o vendió) el Banco Central ese día, en millones de dólares.",
      c: "Es la variación diaria de las reservas por las operaciones de divisas del BCRA. Positivo es que compró y entraron reservas. Negativo, que vendió.",
      l: "Cuando el BCRA compra, suma reservas y refuerza la capacidad del país para pagar deuda y sostener el peso. Cuando vende, las gasta para evitar que el dólar suba.",
      o: "Un día no dice nada. Mirá el acumulado de varias semanas."
    },

    /* ---------- inflación ---------- */
    infM: {
      q: "Cuánto subieron los precios en el último mes.",
      c: "El INDEC mide cada mes lo que cuesta una canasta de bienes y servicios que consumen los hogares argentinos (comida, alquiler, transporte, salud, ropa, etc.) y calcula cuánto cambió. Es el Índice de Precios al Consumidor (IPC).",
      l: "Un número chico por mes se acumula: una inflación de 1% mensual son casi 13% en un año; 2%, casi 27%; 3%, cerca de 43%; 5%, casi 80%. Por eso los \"pocos puntos\" por mes pesan tanto.",
      o: "Es un promedio. Tu inflación puede ser mayor o menor según en qué gastes (alquiler, comida, transporte)."
    },
    infIA: {
      q: "Cuánto subieron los precios en los últimos 12 meses.",
      c: "Es la inflación de cada uno de los últimos 12 meses compuesta (no sumada), es decir, cuánto más cuesta hoy una canasta que hace un año costaba lo mismo.",
      l: "Si la inflación interanual es 30%, lo que hace un año costaba $100 hoy cuesta $130. Para que tu sueldo no pierda frente a los precios, tiene que haber subido más de 30% en el mismo período.",
      o: "Muestra el pasado. Si la inflación mensual viene bajando, la interanual tarda en bajar."
    },
    nucleo: {
      q: "La inflación sin los precios que se mueven por razones especiales. Muestra la tendencia de fondo.",
      c: "Es el IPC sin los precios regulados ni los estacionales. Así se ven los precios que responden al clima general de la economía.",
      l: "Si el núcleo baja de manera sostenida, la inflación está cediendo de verdad. Si el nivel general baja pero el núcleo no, la mejora puede ser pasajera.",
      o: "Es un promedio mensual y puede variar de un mes a otro."
    },
    regulados: {
      q: "Cuánto subieron los precios que fija o influye el Estado: tarifas, combustibles, transporte público, prepagas y educación.",
      c: "El INDEC sigue esos precios y calcula la variación mensual del grupo, que es parte del IPC.",
      l: "Dependen de decisiones de gobierno y no tanto del mercado. Cuando suben fuerte, empujan la inflación general aunque lo demás esté calmo.",
      o: "Las tarifas suelen ajustarse en saltos, así que el mes a mes es irregular."
    },
    estacionales: {
      q: "Cuánto subieron los precios que cambian con la época del año: frutas, verduras, ropa de temporada, turismo.",
      c: "El INDEC mide las variaciones mensuales de ese grupo dentro del IPC.",
      l: "Suben y bajan con el clima y la temporada, por eso se los separa del núcleo: sirven para entender un mes puntual, no la tendencia.",
      o: "Un mes de verduras caras no significa que cambie la inflación de fondo."
    },
    transporte: RUBRO("transporte (combustibles, autos, boletos, pasajes)", "autos, nafta, boletos de colectivo y tren, pasajes y servicios de transporte"),
    salud: RUBRO("salud (prepagas, medicamentos, consultas)", "medicamentos, prepagas, consultas y tratamientos"),
    educacion: RUBRO("educación (cuotas, útiles, cursos)", "cuotas, matrículas, útiles y cursos"),
    prendas: RUBRO("ropa y calzado", "ropa y zapatillas"),
    equipamiento: RUBRO("equipamiento del hogar (electrodomésticos, muebles, limpieza)", "muebles, electrodomésticos y artículos de limpieza"),
    comunicaciones: RUBRO("comunicaciones (celular, internet, telefonía)", "celulares, internet y telefonía"),
    bebidas: RUBRO("bebidas alcohólicas y tabaco", "bebidas alcohólicas y cigarrillos"),
    uva: {
      q: "Una unidad de cuenta que se actualiza todos los días según la inflación. Se usa en créditos hipotecarios y alquileres.",
      c: "Arrancó en abril de 2016 y el BCRA la actualiza cada día con el CER, que sigue a la inflación ya publicada. Su valor en pesos sube de a poco, todos los días.",
      l: "Si pedís un crédito en UVA, la cuota se calcula en UVA: tu cuota en pesos acompaña la inflación.",
      o: "Lo que sube es el valor de la UVA en pesos, no tu sueldo: si tu sueldo no acompaña la inflación, la cuota pesa más."
    },
    cer: {
      q: "Un índice que sigue la inflación día a día y sirve para ajustar deudas, bonos y contratos.",
      c: "El BCRA lo calcula con el IPC del INDEC. Vale 1 en febrero de 2002 y se actualiza todos los días siguiendo la inflación ya publicada por el INDEC.",
      l: "Si el CER sube 30% en un año, algo que se ajusta por CER (un bono, un crédito, un alquiler) sube 30%. Es la regla de \"ajustar por inflación\".",
      o: "Es un coeficiente técnico. Importa más por las cosas que ajusta que por su número."
    },
    reservas: {
      q: "Los dólares y otros activos que tiene el Banco Central guardados. Son la \"caja de ahorros\" del país en moneda extranjera.",
      c: "Se suman los dólares, el oro, el yuan y otros activos que el BCRA tiene. Se expresan en millones de dólares.",
      l: "Más reservas dan más capacidad para pagar deuda externa, frenar una corrida y sostener el tipo de cambio. Que bajen es una señal de que el BCRA está gastando dólares.",
      o: "Son reservas brutas: incluyen dólares que el BCRA debe devolver (depósitos de bancos, swaps con otros países). Las netas, que los descuentan, son bastante menores."
    },
    reservasSinDEG: {
      q: "Las reservas sin contar los Derechos Especiales de Giro (DEG) asignados por el FMI en 2009.",
      c: "Es el total de reservas menos esos DEG, que forman parte del activo pero no son dólares disponibles.",
      l: "Da una idea más conservadora de la caja que hay. Es una manera de ver las reservas sin lo que no se puede usar de inmediato.",
      o: "Sigue siendo una cifra bruta: no descuenta las deudas de corto plazo del BCRA."
    },
    riesgo: {
      q: "Cuánto más paga Argentina por pedir plata prestada que el país más seguro del mundo (EE. UU.). Mide la desconfianza de los inversores.",
      c: "Es la diferencia entre el rendimiento de los bonos argentinos en dólares y el de los bonos del Tesoro de EE. UU. Se mide en puntos básicos: 100 puntos son 1 punto porcentual (el índice de JP Morgan, el EMBI).",
      l: "Un riesgo país de 700 puntos significa que Argentina tiene que pagar 7 puntos porcentuales más por año que EE. UU. para conseguir plata. Cuanto más bajo, más confianza hay y más fácil es conseguir crédito; cuando sube, es una señal de alarma.",
      o: "Cambia todos los días con el humor del mercado."
    },

    /* ---------- dinero y tasas ---------- */
    base: {
      q: "Los pesos que emitió el Banco Central: los billetes y monedas y lo que los bancos tienen depositado en el BCRA.",
      c: "Es la suma de la circulación monetaria y los depósitos de los bancos en sus cuentas del BCRA. Se mide en millones de pesos.",
      l: "Mide cuántos pesos puso en la calle el BCRA. Si crece mucho más rápido que la economía y los precios, hay más pesos persiguiendo los mismos bienes, y eso puede empujar la inflación.",
      o: "Crecer no es malo en sí mismo: la economía necesita más pesos a medida que crecen los precios."
    },
    circ: {
      q: "Los billetes y monedas en circulación, en manos de la gente y de los bancos.",
      c: "Es el efectivo emitido y que no está guardado en el BCRA. Se mide en millones de pesos.",
      l: "Muestra cuánto efectivo hay dando vueltas. Es parte de la base monetaria.",
      o: "Con tantos pagos digitales, el efectivo representa cada vez menos de la plata total."
    },
    m2: {
      q: "Cuánto creció en 12 meses el dinero de uso cotidiano del sector privado: billetes más lo que hay en cuentas corrientes y cajas de ahorro.",
      c: "El BCRA suma el efectivo en manos del público y los depósitos a la vista del sector privado y calcula cuánto cambió frente a un año atrás.",
      l: "Compararlo con la inflación interanual: si el dinero crece menos que los precios, hay menos plata en términos reales; si crece más, hay más plata dando vueltas.",
      o: "Es una variación nominal (en pesos de cada momento), no descuenta la inflación."
    },
    depositos: {
      q: "La plata que personas y empresas tienen guardada en los bancos.",
      c: "Se suman los depósitos en efectivo en las entidades financieras. Se expresa en millones de pesos.",
      l: "Si crecen más que la inflación, la gente confía en dejar su plata en los bancos. Si caen, se la está llevando a otro lado (dólares, ladrillos, inversiones) o la está gastando.",
      o: "Está en pesos nominales: para ver si creció de verdad hay que descontar la inflación."
    },
    prestamos: {
      q: "La plata que los bancos le prestaron a personas y empresas.",
      c: "Es el total de préstamos al sector privado en millones de pesos: adelantos, documentos, hipotecarios, prendarios, tarjetas y personales.",
      l: "Que el crédito crezca por encima de la inflación es señal de que la actividad se está financiando. Si cae, puede ser que los bancos presten menos o que la gente no pueda o no quiera endeudarse.",
      o: "Un aumento muy rápido puede esconder más morosidad (gente que no puede pagar)."
    },
    badlar: {
      q: "La tasa de interés que pagan los bancos privados por plazos fijos grandes (más de un millón de pesos) a 30 a 35 días.",
      c: "El BCRA promedia las tasas que informan los bancos privados por depósitos a plazo fijo de más de un millón de pesos. Se expresa como tasa nominal anual (TNA).",
      l: "Es una referencia de cuánto rinde ahorrar en pesos. Para saber si ganás o perdés, compará: tasa mensual (TNA dividido 12, aproximadamente) contra inflación del mes. Si la tasa es mayor, el ahorro le gana a los precios.",
      o: "La TNA no incluye el efecto de reinvertir los intereses cada mes."
    },
    tamar: {
      q: "La tasa que pagan los bancos privados por plazos fijos de más de mil millones de pesos. Es una referencia para los depósitos de empresas e inversores grandes.",
      c: "El BCRA promedia las tasas que pagan los bancos privados por depósitos a plazo fijo de más de mil millones de pesos, a 30 a 35 días. Se expresa como tasa nominal anual.",
      l: "Sirve para saber cuánto pagan los bancos por los depósitos grandes. Suele estar cerca de la BADLAR.",
      o: "No es la tasa a la que ahorra una persona común."
    },
    tasaDep: {
      q: "La tasa que pagan los bancos por un plazo fijo a 30 días, para depósitos comunes.",
      c: "Es el promedio de lo que informan los bancos para depósitos a plazo fijo a 30 días, como tasa nominal anual.",
      l: "Es la tasa más parecida a la que vos podés conseguir por un plazo fijo. Compará lo que rinde en un mes con la inflación del mes.",
      o: "La tasa nominal anual (TNA) no es lo que ganás en un año: depende de cuántas veces reinviertas."
    },
    tasaPers: {
      q: "La tasa que cobran los bancos por préstamos personales: lo que cuesta endeudarse.",
      c: "El BCRA promedia las tasas que informan los bancos para préstamos personales, como tasa nominal anual.",
      l: "Cuanto más alta, más caro es financiarse. Compararla con la inflación muestra el costo real: si la tasa es mucho mayor que la inflación, pagás más de lo que se desvalorizó la deuda.",
      o: "El costo final incluye gastos y seguros, y suele ser más alto que la tasa que se publica."
    },
    tasaPases: {
      q: "La tasa a la que los bancos se prestan plata entre sí por un día, contra bonos.",
      c: "Es el promedio de las operaciones de pases entre terceros a 1 día que informa el BCRA.",
      l: "Marca el piso del costo de la plata en pesos de muy corto plazo. Si sube, hay más escasez de pesos en el sistema.",
      o: "Es un dato técnico del mercado entre bancos."
    },
    tasaBaibar: {
      q: "La tasa a la que los bancos se prestan plata entre sí, sin garantía.",
      c: "Es el promedio de lo que informan los bancos por préstamos entre ellos.",
      l: "Cuando sube, los bancos desconfían entre sí o hay menos pesos disponibles.",
      o: "Es un dato técnico del mercado entre bancos."
    },
    tasaAdelantos: {
      q: "La tasa que cobran los bancos por los adelantos en cuenta corriente: la plata que se pide prestada \"en el descubierto\".",
      c: "El BCRA promedia lo que cobran los bancos, como tasa nominal anual.",
      l: "Es una de las formas más caras y más rápidas de financiarse para una empresa. Si sube, se encarece el capital de trabajo.",
      o: "Es una tasa de corto plazo."
    },
    depCC: {
      q: "La plata en cuentas corrientes bancarias, la que se usa para pagar el día a día.",
      c: "Es el saldo total de depósitos en cuenta corriente, en millones de pesos.",
      l: "Es plata que no rinde intereses y está disponible. Si crece, hay más plata lista para gastarse.",
      o: "Está en pesos nominales."
    },
    depCA: {
      q: "La plata en cajas de ahorro, la cuenta común.",
      c: "Es el saldo total de depósitos en caja de ahorro, en millones de pesos.",
      l: "Es dinero disponible que rinde poco o nada. Crece cuando la gente deja plata a la vista.",
      o: "Está en pesos nominales."
    },
    depPlazo: {
      q: "La plata que está inmovilizada en plazos fijos durante un tiempo.",
      c: "Es el saldo total de depósitos a plazo, en millones de pesos.",
      l: "Cuando crece, hay más gente ahorrando en pesos y dejando la plata quieta. Cuando cae, la gente prefiere tenerla líquida o la lleva a otro destino.",
      o: "Está en pesos nominales."
    },
    credAdelantos: {
      q: "Lo prestado por los bancos en adelantos en cuenta corriente.",
      c: "Es el saldo total de adelantos a empresas y personas, en millones de pesos.",
      l: "Es crédito de muy corto plazo: se usa para cubrir pagos de todos los días.",
      o: "Está en pesos nominales."
    },
    credDocumentos: {
      q: "Lo prestado por los bancos contra documentos: cheques y pagarés que las empresas descuentan.",
      c: "Es el saldo total de documentos descontados y comprados, en millones de pesos.",
      l: "Mide el crédito que usan las empresas para financiar sus ventas.",
      o: "Está en pesos nominales."
    },
    credHipotecarios: {
      q: "Lo prestado por los bancos para comprar vivienda.",
      c: "Es el saldo total de préstamos hipotecarios, en millones de pesos.",
      l: "Si crece, hay más gente accediendo a una casa con crédito. Es uno de los créditos más sensibles a la inflación y a las tasas.",
      o: "Está en pesos nominales."
    },
    credPrendarios: {
      q: "Lo prestado por los bancos con garantía de un bien, como un auto o una maquinaria.",
      c: "Es el saldo total de préstamos prendarios, en millones de pesos.",
      l: "Mide la financiación de autos y equipos. Crece cuando la gente y las empresas se animan a comprar bienes durables.",
      o: "Está en pesos nominales."
    },
    factTotal: {
      q: "Cuánto cambió la base monetaria en el día y por qué razones, en suma.",
      c: "El BCRA calcula cada día qué operaciones crearon o retiraron pesos: compras de dólares, pagos de intereses, operaciones con el Tesoro, etc. Este es el total.",
      l: "Positivo es que el BCRA puso más pesos en circulación. Negativo, que retiró.",
      o: "Un día no dice mucho. Mirá el acumulado."
    },
    factCompras: {
      q: "Cuántos pesos se crearon (o retiraron) por las compras (o ventas) de dólares del BCRA al sector privado.",
      c: "Cuando el BCRA compra dólares, paga con pesos nuevos. Esta serie mide el efecto en pesos de esas compras.",
      l: "Positivo: el BCRA compró dólares y puso pesos en circulación. Negativo: vendió dólares y retiró pesos.",
      o: "Es el efecto en pesos, no la cantidad de dólares."
    },
    factOtras: {
      q: "El efecto sobre la base monetaria de todas las demás operaciones del BCRA.",
      c: "Es la parte del cambio diario de la base que no explican las compras de divisas ni las operaciones con el Tesoro.",
      l: "Sirve para completar el cuadro de por qué cambió la cantidad de pesos.",
      o: "Es un dato técnico."
    },

    /* ---------- actividad y empleo ---------- */
    emae: {
      q: "Una foto mensual del ritmo de la economía: es como un \"PBI mes a mes\".",
      c: "El INDEC reúne datos de producción de muchos sectores (industria, agro, comercio, servicios, construcción) y los ordena en un índice base 2004 = 100. \"Desestacionalizado\" quiere decir que se le quita lo que cambia por la época del año, como las vacaciones.",
      l: "Si sube mes a mes, la actividad se recupera; si baja, se enfría. Para saber si la economía creció, mirá la variación contra hace un año. Se publica con unos dos meses de demora.",
      o: "Se revisa: los datos anteriores pueden cambiar cuando salen los nuevos."
    },
    ipi: {
      q: "Cuánto produce la industria manufacturera (fábricas de alimentos, autos, textiles, químicos, etc.).",
      c: "El INDEC mide el volumen de producción de las ramas industriales en un índice. Se publica sin el efecto de la época del año.",
      l: "Muestra si las fábricas producen más o menos que antes. Cae cuando bajan las ventas, el consumo o la demanda de exportación.",
      o: "Es solo una parte de la economía: no incluye comercio ni servicios."
    },
    cemento: {
      q: "Cuánto cemento se usa: una forma de medir si se construye más o menos.",
      c: "Es el insumo cemento dentro del índice de actividad de la construcción (ISAC) del INDEC.",
      l: "Cuando la construcción se mueve, suele moverse el empleo y la obra. Es un indicador adelantado de cuánto se invierte.",
      o: "Muestra un insumo, no el total de la construcción."
    },
    pbi: {
      q: "El valor de todo lo que produce el país en un trimestre.",
      c: "El INDEC suma el valor de los bienes y servicios finales producidos, a precios constantes de 2004. Así se descuenta la inflación y se ve el crecimiento real.",
      l: "Si sube respecto del mismo trimestre del año pasado, la economía creció. Si baja en dos trimestres seguidos, se habla de recesión técnica.",
      o: "Sale con meses de demora y se revisa."
    },
    desoc: {
      q: "De cada 100 personas que quieren trabajar, cuántas no tienen trabajo.",
      c: "El INDEC lo mide cada trimestre con una encuesta a hogares (EPH) en 31 ciudades. Cuenta a quienes no trabajaron ni una hora en la semana y buscaron empleo activamente, sobre el total de personas que trabajan o buscan.",
      l: "Una desocupación de 7% quiere decir que 7 de cada 100 personas activas buscan trabajo y no lo consiguen. Si sube, hay menos empleo; si baja, hay más (o menos gente busca).",
      o: "No mide la informalidad ni la calidad del empleo: una persona con changas se cuenta como ocupada."
    },
    salarios: {
      q: "Cómo evolucionan en promedio los sueldos de los trabajadores en blanco.",
      c: "El INDEC calcula un índice (base octubre 2016 = 100) a partir de lo que informan empresas y organismos públicos. Mide el sueldo del mismo puesto, no el de quienes entran y salen.",
      l: "Compará su variación contra la inflación del mismo período: si los salarios suben menos, el poder de compra cae. Si suben más, mejora.",
      o: "Mide los sueldos de los trabajadores registrados."
    },
    salPriv: {
      q: "Cómo evolucionan los sueldos en blanco del sector privado.",
      c: "Es la parte privada del índice de salarios del INDEC (base octubre 2016 = 100).",
      l: "Compará su variación contra la inflación del mismo período para saber si ganan o pierden poder de compra.",
      o: "Cada sector y convenio se mueve distinto."
    },
    salNoReg: {
      q: "Cómo evolucionan los sueldos en negro (informales) del sector privado.",
      c: "El INDEC lo estima con la encuesta a hogares y se publica con un retraso de 5 meses.",
      l: "Compará con la inflación y con los sueldos en blanco para ver si la informalidad gana o pierde frente a los precios.",
      o: "Es una estimación con rezago de varios meses."
    },
    salPub: {
      q: "Cómo evolucionan los sueldos del sector público.",
      c: "Es la parte pública del índice de salarios del INDEC (base octubre 2016 = 100).",
      l: "Compará su variación contra la inflación del mismo período.",
      o: "Depende de las paritarias de cada gobierno."
    },
    ripte: {
      q: "El sueldo promedio de los trabajadores en blanco con empleo estable.",
      c: "La Secretaría de Trabajo lo calcula con los aportes que se declaran al sistema previsional. Se usa para actualizar indemnizaciones y montos de juicios laborales.",
      l: "Es una forma de ver cuánto cobra en promedio un trabajador registrado. Comparalo con la inflación para ver si le gana.",
      o: "No incluye trabajadores informales ni autónomos."
    },
    smvm: {
      q: "El sueldo mínimo que puede cobrar un trabajador en blanco por una jornada completa.",
      c: "Lo fija el Consejo del Salario (Estado, empresas y sindicatos) y se actualiza por resolución.",
      l: "Es un piso legal. Comparalo con la inflación acumulada para ver cuánto poder de compra tiene ese mínimo.",
      o: "Pocos trabajadores cobran exactamente el mínimo, pero funciona como referencia para planes y convenios."
    },
    haber: {
      q: "Lo mínimo que cobra un jubilado por mes.",
      c: "Lo informa ANSES y se actualiza por ley según la movilidad jubilatoria.",
      l: "Compará su variación contra la inflación para ver si pierde o gana poder de compra.",
      o: "Puede no incluir bonos adicionales."
    },

    /* ---------- cuentas del Estado ---------- */
    resPrim: {
      q: "Lo que el Estado nacional recaudó menos lo que gastó, sin contar los intereses de la deuda.",
      c: "La Secretaría de Hacienda resta, mes a mes, los gastos primarios a los ingresos. Se muestra en millones de pesos.",
      l: "Superávit (número positivo) significa que el Estado gasta menos de lo que cobra antes de pagar los intereses. Déficit (negativo) significa que gasta más y tiene que financiarse con deuda o emisión de pesos.",
      o: "Con los intereses de la deuda, el resultado final (financiero) es menor. El primario no los cuenta."
    },
    recaud: {
      q: "Todo lo que cobra el Estado nacional en impuestos: IVA, Ganancias, derechos de exportación, aportes y contribuciones.",
      c: "ARCA lo suma cada mes. Se expresa en millones de pesos.",
      l: "Como los precios suben, la recaudación casi siempre sube en pesos. Lo importante es compararla con la inflación para ver si sube más o menos que los precios.",
      o: "Está en pesos nominales."
    },
    recaudIA: {
      q: "Cuánto más cobró el Estado en impuestos que en el mismo mes del año pasado, en porcentaje.",
      c: "ARCA compara la recaudación del mes contra la del mismo mes de un año atrás, en pesos.",
      l: "Compará este número con la inflación interanual: si es mayor, la recaudación crece por encima de los precios (más actividad o más impuestos); si es menor, cae en términos reales.",
      o: "No descuenta la inflación."
    },
    expo: {
      q: "Cuánto vende Argentina al exterior en un mes, en millones de dólares.",
      c: "El INDEC suma el valor de los bienes (soja, maíz, petróleo, autos, etc.) que salen del país.",
      l: "Las exportaciones traen dólares al país. Cuanto más, más dólares ingresan.",
      o: "Es solo de bienes, no de servicios."
    },
    impo: {
      q: "Cuánto compra Argentina al exterior en un mes, en millones de dólares.",
      c: "El INDEC suma el valor de los bienes que entran al país.",
      l: "Cuando la economía crece, las importaciones suben porque se compran más insumos y maquinaria. Cuando se frena, bajan.",
      o: "Es solo de bienes, no de servicios."
    },
    saldo: {
      q: "La diferencia entre lo que el país exporta y lo que importa.",
      c: "Es exportaciones menos importaciones del mismo mes.",
      l: "Positivo (superávit): entran más dólares por comercio de los que salen. Negativo (déficit): salen más de los que entran.",
      o: "No incluye servicios, turismo ni pagos de deuda."
    },
    resFin: {
      q: "Lo que le queda (o le falta) al Estado nacional después de pagar los intereses de la deuda.",
      c: "Es el resultado primario menos los intereses netos de la deuda. Lo publica la Secretaría de Hacienda en millones de pesos.",
      l: "Positivo (superávit financiero): el Estado cobra más de lo que gasta incluyendo intereses, y puede bajar deuda. Negativo (déficit): tiene que financiarse con más deuda o con emisión de pesos. Es la medida más completa del equilibrio fiscal.",
      o: "Un mes puntual puede dar muy distinto por el calendario de pagos de intereses. Mirá el acumulado del año o los últimos 12 meses."
    },
    intereses: {
      q: "Lo que el Estado nacional paga por mes por los intereses de su deuda, descontando lo que cobra como intereses.",
      c: "Hacienda suma los intereses pagados en pesos y en dólares y les resta las rentas de la propiedad que cobra. Se expresa en millones de pesos.",
      l: "Cuanto más pesan los intereses, menos plata queda del superávit primario. Si superan al resultado primario, el resultado financiero da negativo.",
      o: "Los pagos de deuda en dólares se concentran en enero y julio, así que el mes a mes es muy irregular."
    },
    resPrimAcum: {
      q: "La suma de los resultados primarios de cada mes desde enero del año en curso.",
      c: "Se acumulan los resultados mensuales y la cuenta vuelve a cero cada enero.",
      l: "Es la forma más simple de ver cómo va el año fiscal. Si viene subiendo mes a mes, el Estado mantiene el superávit.",
      o: "Un mes con aguinaldo o pagos grandes puede bajar mucho el acumulado y recuperarse después."
    },
    resFinAcum: {
      q: "La suma de los resultados financieros (con intereses) desde enero del año en curso.",
      c: "Es el resultado primario menos los intereses, acumulado mes a mes. Vuelve a cero cada enero.",
      l: "Muestra si, después de pagar la deuda, lo que va del año cierra con superávit o con déficit.",
      o: "Los meses con pagos de deuda (enero y julio) lo mueven fuerte."
    },
    resPrim12: {
      q: "La suma del resultado primario de los últimos 12 meses.",
      c: "Se suman los 12 últimos resultados mensuales. Así se compara con el año anterior sin que importe el calendario.",
      l: "Es la medida que se usa para comparar con metas anuales. Si sube, la tendencia fiscal mejora.",
      o: "Está en pesos de cada momento: con inflación alta, los números nuevos son mayores casi siempre."
    },
    resFin12: {
      q: "La suma del resultado financiero (con intereses) de los últimos 12 meses.",
      c: "Se suman los 12 últimos resultados financieros mensuales.",
      l: "Es la forma más completa de ver si el Estado cerró el último año con superávit o déficit.",
      o: "Está en pesos de cada momento, sin ajuste por inflación."
    },
    iva: {
      q: "Lo que el Estado nacional cobra por el Impuesto al Valor Agregado, descontando los reintegros.",
      c: "ARCA recauda el IVA sobre ventas, importaciones y servicios. Hacienda lo informa neto de reintegros, en millones de pesos.",
      l: "Es el impuesto que mejor refleja el consumo y la actividad. Si crece más que la inflación, hay más ventas en términos reales.",
      o: "Está en pesos de cada momento: comparalo con la inflación."
    },
    ganancias: {
      q: "Lo que cobra el Estado nacional por el impuesto a las ganancias de personas y empresas.",
      c: "ARCA lo recauda (incluye retenciones a trabajadores y pagos de sociedades). Se informa en millones de pesos.",
      l: "Refleja los resultados de las empresas y los sueldos más altos. Suele tener picos en los meses de vencimiento anual.",
      o: "Los meses de vencimientos grandes distorsionan el mes a mes."
    },
    aportes: {
      q: "Lo que ingresa al sistema por los aportes y contribuciones de los trabajadores y las empresas a la seguridad social.",
      c: "Se calculan como un porcentaje de los sueldos en blanco (aportes del trabajador y contribuciones patronales). Se informan en millones de pesos.",
      l: "Se mueve con el empleo registrado y los sueldos. Financia en buena parte las jubilaciones.",
      o: "Si aumenta menos que la inflación, los sueldos registrados pierden frente a los precios."
    },
    derExp: {
      q: "Lo que cobra el Estado nacional por las exportaciones, las \"retenciones\".",
      c: "Es un porcentaje del valor exportado (sobre todo del agro), que cobra la Aduana. Se informa en millones de pesos.",
      l: "Depende de los precios internacionales, del tipo de cambio y de la alícuota que fije el gobierno. Si baja una alícuota, baja la recaudación aunque se exporte lo mismo.",
      o: "Es muy estacional: en los meses de cosecha gruesa suele ser mayor."
    },
    debCred: {
      q: "Lo que cobra el Estado por el impuesto a los débitos y créditos bancarios (el \"impuesto al cheque\").",
      c: "Es un porcentaje sobre cada movimiento en cuentas bancarias. Se informa en millones de pesos.",
      l: "Crece con el movimiento de plata en el sistema bancario. Sube cuando se mueve más plata, aunque no necesariamente haya más actividad real.",
      o: "Parte de este impuesto se puede computar como pago a cuenta de Ganancias."
    },
    bienesPers: {
      q: "Lo que cobra el Estado por el impuesto sobre el patrimonio de las personas.",
      c: "ARCA lo recauda cada año sobre bienes en el país y en el exterior. Se informa en millones de pesos.",
      l: "Es poco en el total, pero muy visible. Se concentra en pocos meses del año.",
      o: "Depende de los cambios de alícuotas, valuaciones y regímenes especiales."
    },
    jubil: {
      q: "Lo que el Estado nacional gasta por mes en jubilaciones y pensiones del sistema contributivo (con aportes).",
      c: "Hacienda suma lo pagado por ANSES. Se informa en millones de pesos.",
      l: "Es el gasto más grande del Estado nacional. Crece con la cantidad de jubilados y con la movilidad (los aumentos automáticos).",
      o: "En junio y diciembre sube por el aguinaldo."
    },
    pami: {
      q: "Lo que el Estado nacional transfiere al PAMI (INSSJP), la obra social de los jubilados.",
      c: "Es la prestación del Instituto Nacional de Servicios Sociales para Jubilados y Pensionados, en millones de pesos.",
      l: "Financia atención médica y medicamentos de jubilados. Es uno de los rubros grandes de la seguridad social.",
      o: "Parte de su financiamiento viene de aportes y no de transferencias directas."
    },
    asig: {
      q: "Lo que el Estado nacional paga en asignaciones familiares y universales, como la AUH.",
      c: "Es el gasto de ANSES por asignaciones familiares y la Asignación Universal por Hijo, en millones de pesos.",
      l: "Es una de las principales ayudas a familias con hijos. Se ajusta por movilidad.",
      o: "Se actualiza por una fórmula; su poder de compra depende de la inflación."
    },
    pensNC: {
      q: "Lo que el Estado nacional paga en pensiones no contributivas (sin aportes previos): invalidez, vejez, madres de siete hijos y otras.",
      c: "Hacienda suma las pensiones pagadas por ANSES a personas que no tienen aportes, en millones de pesos.",
      l: "Mide la asistencia a personas en situación de vulnerabilidad. Cuando cambian los requisitos, cambia la cantidad de beneficiarios.",
      o: "No incluye las jubilaciones comunes."
    },
    salEstado: {
      q: "Lo que el Estado nacional gasta por mes en sueldos de su personal.",
      c: "Hacienda suma las remuneraciones de la administración nacional, organismos y fuerzas, en millones de pesos.",
      l: "Compará su variación con la inflación para ver si los sueldos públicos le ganan o pierden. Es un gasto que no se puede recortar de un día para otro.",
      o: "No incluye los empleados provinciales ni municipales."
    },
    bpCC: {
      q: "Si el país gana o pierde dólares en sus intercambios con el resto del mundo, sin contar préstamos ni inversiones.",
      c: "El INDEC suma exportaciones menos importaciones de bienes y servicios, más los intereses y utilidades que cobramos o pagamos y las transferencias (como remesas). Se expresa en millones de dólares por trimestre.",
      l: "Superávit (positivo): entran más dólares de los que salen. Déficit (negativo): el país necesita financiarse con deuda o inversión extranjera. Cuando el déficit es grande y sostenido, aumenta la presión sobre el dólar.",
      o: "Un trimestre puntual puede ser engañoso por la cosecha, que concentra exportaciones. Mirá los últimos 4 trimestres."
    },
    bpCC12: {
      q: "La cuenta corriente sumada de los últimos 4 trimestres.",
      c: "Se suman los últimos cuatro resultados trimestrales de la cuenta corriente, en millones de dólares.",
      l: "Quita la estacionalidad de la cosecha y muestra la tendencia del último año.",
      o: "Es un dato con rezago: sale unos tres meses después de cerrar el trimestre."
    },
    bpCF: {
      q: "Cómo se financió el resto: la plata que entra y sale del país por préstamos, inversiones, compra de activos y reservas.",
      c: "El INDEC suma la inversión directa, de cartera, otra inversión (préstamos, depósitos), derivados y la variación de reservas. Se expresa en millones de dólares por trimestre.",
      l: "Con el signo del INDEC, un valor positivo indica que el país prestó o invirtió afuera más de lo que recibió (va de la mano de un superávit de cuenta corriente). Negativo, que se financió con dinero del exterior. En teoría, cuenta corriente y cuenta financiera tienden a compensarse.",
      o: "Es la que más confunde: positivo no significa \"entraron dólares\"."
    },
    bpCap: {
      q: "Transferencias de capital y compra o venta de activos no financieros, como patentes o derechos.",
      c: "El INDEC lo informa en millones de dólares por trimestre. Es una cuenta chica.",
      l: "Rara vez cambia el panorama. Se suma a la cuenta corriente para ver el resultado total de lo que el país ahorra o pide al exterior.",
      o: "Es un valor muy chico en comparación con las otras cuentas."
    },
    bpBienes: {
      q: "La diferencia entre lo que Argentina exporta y lo que importa en bienes, según el balance de pagos.",
      c: "El INDEC resta importaciones a exportaciones de bienes (valores FOB), en millones de dólares por trimestre.",
      l: "Es el componente más fuerte de la cuenta corriente: el superávit de bienes compensa el déficit de servicios y de rentas.",
      o: "Es trimestral. El saldo comercial mensual puede diferir levemente por criterios de valuación."
    },
    bpServicios: {
      q: "La diferencia entre lo que el país cobra y paga por servicios con el exterior: turismo, transporte, fletes, software, etc.",
      c: "El INDEC resta los egresos a los ingresos por servicios, en millones de dólares por trimestre.",
      l: "Suele ser negativo, sobre todo por el turismo de argentinos en el exterior. Es un rubro que se mueve con el tipo de cambio.",
      o: "Un valor muy negativo en verano o vacaciones de invierno es normal."
    },
    bpIngresos: {
      q: "Lo que pagamos o cobramos en intereses, utilidades de empresas y transferencias con el exterior.",
      c: "Se calcula como la cuenta corriente menos el balance de bienes y de servicios. Incluye los intereses de la deuda externa, las utilidades que giran las empresas extranjeras y las remesas.",
      l: "Suele ser negativo: el país paga más intereses y utilidades de los que cobra.",
      o: "Es un cálculo propio a partir de datos del INDEC."
    },
    bpEyO: {
      q: "La diferencia que queda cuando las cuentas del balance de pagos no cierran exactamente.",
      c: "Se calcula para que la suma sea cero. Se expresa en millones de dólares por trimestre.",
      l: "Un valor grande puede indicar dólares que salen o entran sin registro, o fallas de medición.",
      o: "Es un dato técnico, no una cuenta con un sentido propio."
    },
    bpReservas: {
      q: "Cuánto cambiaron las reservas internacionales en el trimestre, por todas las operaciones del balance de pagos.",
      c: "Es parte de la cuenta financiera. Se expresa en millones de dólares por trimestre.",
      l: "Positivo: subieron las reservas. Negativo: bajaron. Mide el cambio, no el nivel.",
      o: "Puede diferir del cambio de reservas del BCRA por valuaciones y otros movimientos."
    }
  };

  window.EconoGlosario = G;
})();
