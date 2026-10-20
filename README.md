# Econochanta

El tablero de la economía argentina: dólar, inflación, actividad, empleo, cuentas fiscales, comercio exterior, dinero y mercados, con datos oficiales y gráficos propios. Las noticias y las herramientas personales quedan en un segundo plano.

PWA estática (HTML, CSS y JS sin build). Los datos salen de APIs públicas sin clave. Si una serie falla, se avisa y se muestra el último dato o el de ejemplo.

**Diseño desktop first.** La interfaz está pensada primero para escritorio (dos paneles: lista y detalle) y se adapta después a tablet y celular. En `styles.css` el diseño base es el de escritorio y las adaptaciones están al final con `max-width` (1100, 820 y 560 px); en pantallas táctiles los controles pasan a 44 px.

## Probarlo

Con el servidor del proyecto (puerto 8770) o con cualquier servidor estático:

```bash
python -m http.server 8770 --directory .
```

Abrí `http://localhost:8770`. En el celular, desde la misma red: `http://<ip-de-tu-pc>:8770`.

## Qué tiene

El diseño es una **mesa**: a la izquierda la lista de indicadores, agrupados y con su tendencia; a la derecha el detalle del indicador elegido (valor grande, variación contra el dato anterior y contra hace 12 meses, gráfico con selector de período, mínimo, máximo y promedio, tabla de datos y descarga en CSV). En celular la lista ocupa toda la pantalla y el detalle se abre aparte, con un botón para volver.

La estructura sigue la de pulsomacro.com.ar: una portada, un menú de Argentina con sus temas, noticias y calculadoras. Cada tema de Argentina abre su propia mesa.

| Sección | Contenido |
|---|---|
| **Inicio** | Buscador de indicadores y secciones, dólares hoy, los datos del día (inflación, riesgo país, reservas, actividad, desocupación, resultado fiscal, saldo comercial), tus favoritos y un menú de "¿Qué querés ver?" |
| **Argentina** | Menú de temas, con un submenú que queda a la vista en cada uno |
| &nbsp;&nbsp;Dólares | Oficial, MEP, CCL, blue, mayorista, brecha y compras de divisas del BCRA. `#dolares` |
| &nbsp;&nbsp;Inflación y reservas | Inflación mensual e interanual, núcleo, regulados y estacionales, 7 rubros, UVA, CER, reservas y riesgo país. `#inflacion` |
| &nbsp;&nbsp;Tasas y pesos | BADLAR, TAMAR, tasas de depósitos y préstamos, base monetaria, circulación, M2, depósitos y préstamos. `#tasas` |
| &nbsp;&nbsp;Cuentas del Estado | Resultado fiscal (primario y financiero, mensual, acumulado del año y últimos 12 meses), intereses, impuestos y gastos por rubro, tortas de ingresos y gastos, comercio exterior y balance de pagos (cuenta corriente, financiera y capital). `#estado` |
| &nbsp;&nbsp;Actividad y empleo | EMAE, industria, construcción, PBI, desocupación, salarios, salario mínimo y haber mínimo. `#actividad` |
| &nbsp;&nbsp;Banco Central | 27 indicadores del BCRA en 5 grupos, gráficos de tasas, compras de divisas, tipo de cambio, depósitos y crédito, factores de la base monetaria y 39 monedas. `#bcra` |
| &nbsp;&nbsp;Acciones y bonos | Acciones y bonos en vivo (con demora) con búsqueda y orden. `#mercados` |
| **Noticias** | Titulares por tema y por medio |
| **Calculadoras** | Plazo fijo contra dólar, sueldo contra inflación |
| **Tu plata** | Variación real de tu plata, termómetro 0-100, inflación personal con el backup de Plata, dólar y alertas activas |
| **Más** | Glosario, alertas de brecha, perfil y fuentes |

Cada indicador se puede abrir por URL: `#inflacion:infM`. Los links viejos `#tablero:id` siguen andando y llevan al tema que corresponde.

Lo que pulsomacro tiene y Econochanta todavía no: Ganadería (Cañuelas, hacienda, carne, granos) y El mundo (EE. UU. y otros países). Las fuentes abiertas son difíciles o piden clave.

Es oscuro por defecto, con una variante clara (botón arriba a la derecha).

**Look Mosaico.** Azul noche con acento azul violáceo, esquinas redondeadas y navegación en pastillas. Los indicadores clave se muestran como recuadros con calor: el color dice si el último movimiento mejora (verde) o empeora (rojo) la situación, y es más intenso cuanto más se movió el dato; los que no se califican quedan en azul. El brillo de los recuadros sigue al puntero. En Cuentas del Estado, ingresos y gastos se pueden ver como torta o como mosaico, donde el tamaño de cada recuadro es su parte del total.

### Ingresos y gastos del Estado

Al pie de Cuentas del Estado hay dos tortas: de dónde sale la plata (IVA, Ganancias, aportes, retenciones, impuesto al cheque y otros) y en qué se gasta (jubilaciones, sueldos, subsidios, asignaciones, PAMI, transferencias a provincias y otros). Se pueden ver por último trimestre, acumulado del año, últimos 4 trimestres y año anterior, con la lista completa de rubros debajo de cada torta.

Los datos son del informe mensual de ingresos y gastos del Estado nacional de la Secretaría de Hacienda (IMIG), vía datos.gob.ar. El detalle por rubro solo está completo por trimestre, así que las tortas usan datos trimestrales; los indicadores de la lista usan los mensuales disponibles. Los montos están en pesos de cada período, sin ajustar por inflación, y los rubros detallados pueden no sumar exactamente el total oficial.

### Cómo se lee

- **Qué mide y cómo se lee.** Cada indicador trae un bloque que explica en lenguaje común qué es, cómo se mide, cómo leerlo y qué tener en cuenta, con una cuenta en números de hoy para algunos (por ejemplo, la inflación del mes llevada a un año). Las 65 explicaciones están en `glosario.js` y también se leen juntas, con buscador, en Más, Glosario (`#glosario`). No llevan cifras que envejezcan: eso lo da el dato en vivo.
- **Resumen del día.** Al entrar se ve un resumen con cuatro frases generadas desde los datos y las tarjetas de los indicadores clave. Cada tarjeta lleva al gráfico.
- **Colores con sentido.** ▲ y ▼ indican la dirección. El color indica si es mejor o peor para la economía: verde mejora, rojo empeora, gris no se califica. Por ejemplo, una suba de la inflación es roja y una suba de las reservas es verde. El dólar, las tasas y los agregados monetarios no se califican, porque depende de quién los mire. Las acciones y bonos usan verde y rojo solo por precio.
- **Favoritos.** Cada indicador se puede marcar con ★. Los favoritos quedan arriba de la lista y en el resumen, y se guardan en el navegador.
- **Datos desactualizados.** Si el último dato de una serie es más viejo de lo normal para su frecuencia, la fila lo avisa.
- **Teclado.** Las flechas arriba y abajo (y Inicio y Fin) recorren la lista, Enter abre el indicador, y "Saltar al contenido" va directo al contenido sin cambiar de sección.

Cada indicador muestra su período porque los datos mensuales y trimestrales se publican con rezago.

### Accesibilidad

Se revisó contra WCAG 2.1 AA con contrastes calculados. Los bordes de campos y botones tienen al menos 3:1 y el texto 4,5:1 en ambos temas (en el claro los colores del acento son más oscuros por eso). Los gráficos usan trazos distintos además del color y tienen una tabla de datos equivalente; las filas y tarjetas tienen una etiqueta completa para lectores de pantalla; los cambios de sección y de favoritos se anuncian; y en celular el foco pasa al detalle al abrirlo y vuelve a la fila al regresar.

## Cómo se calcula (resumen)

- **Exposición:** sueldo x 3 (referencia), ahorros en pesos y ahorros en USD a valor MEP. De ahí salen los pesos relativos.
- **Termómetro:** 5 factores (inflación, plazo fijo contra precios, brecha CCL, movimiento del dólar 30 días, reservas). Cada uno da un puntaje 0-100 y se promedia con pesos que dependen de tu perfil.
- **Tu plata en términos reales:** cada parte de tu plata (sueldo, ahorro en pesos, dólares) se ajusta por su propia variación menos la inflación.

Es una aproximación para decidir, no asesoramiento financiero.

## De dónde salen los datos

| Dato | Fuente |
|---|---|
| Cotizaciones del dólar | DolarAPI |
| Histórico del dólar, inflación, UVA, riesgo país, tasas de plazo fijo | ArgentinaDatos |
| Reservas, base monetaria, depósitos, préstamos, tasas, CER | API del BCRA v4.0 |
| Inflación por rubro, EMAE, IPI, PBI, salarios, desocupación, comercio, balance de pagos, resultado fiscal, ingresos y gastos por rubro, recaudación, SMVM, haber mínimo, RIPTE | datos.gob.ar (INDEC, Hacienda, ARCA, Trabajo, ANSES) |
| Acciones y bonos | data912 (con demora) |
| Noticias | `news.json`, generado por `scripts/fetch_news.py` desde RSS públicos |

Las series de datos.gob.ar tienen un comportamiento particular: devuelven vacío si el pedido no encaja con el largo de la serie. `series.js` prueba varias formas de pedido hasta que una devuelva datos.

### Noticias

`python scripts/fetch_news.py` baja los feeds de Ámbito, Infobae, La Nación, iProfesional y Perfil, se queda con las últimas 48 horas, clasifica por tema según palabras del título y escribe `news.json`. Solo se guarda título, medio, fecha y link. El workflow `.github/workflows/news.yml` de GitHub Actions lo corre cada hora de 6 a 23 hs (hora de Buenos Aires) y hace commit de `news.json`. También se puede disparar a mano desde la pestaña Actions o con `gh workflow run news.yml`. Para subir workflows, el token de `gh` necesita el permiso `workflow` (`gh auth refresh -h github.com -s workflow`).

### Inflación personal con Plata

En Perfil elegís el backup de Plata. Se procesa en el navegador y solo se guardan totales por categoría (no movimientos ni notas). Cada categoría se cruza con el índice del INDEC de su rubro (transporte, salud, educación, ropa, hogar). Las que no tienen índice propio usan la inflación general. Comida y servicios todavía no tienen serie mensual disponible.

## Estructura

```
index.html   vistas y markup
styles.css   tokens, componentes y, al final, adaptación a pantallas chicas
glosario.js  qué mide cada indicador, cómo se mide y cómo leerlo
app.js       Tu plata, perfil, alertas, calculadoras, noticias y navegación por hash (menú y submenú)
tablero.js   portada, secciones de Argentina (cada una con su mesa de indicadores), Banco Central y acciones y bonos
series.js    catálogo de series y carga (69 series de 5 fuentes)
charts.js    gráficos SVG: líneas, barras, sparklines, CSV
api.js       dólar y datos para Tu plata, con respaldo
data.js      datos de ejemplo y valores por defecto
news.json    titulares (los actualiza el workflow cada hora)
scripts/     fetch_news.py
.github/     workflow que actualiza news.json
sw.js        cache offline del shell
manifest.webmanifest
assets/icon.svg
```

## Siguiente paso

1. Alertas push reales: hace falta un cron que revise y avise.
2. Secciones El mundo y Ganadería, como en pulsomacro (las fuentes abiertas son más difíciles).
3. Revisar con `design:accessibility-review` y `design:design-critique`.
4. Publicar el sitio (hoy el repo es privado; GitHub Pages en un repo privado hace público el sitio).
