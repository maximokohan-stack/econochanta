# Econochanta

El tablero de la economía argentina: dólar, inflación, actividad, empleo, cuentas fiscales, comercio exterior, dinero y mercados, con datos oficiales y gráficos propios. Las noticias y las herramientas personales quedan en un segundo plano.

PWA estática (HTML, CSS y JS sin build). Los datos salen de APIs públicas sin clave. Si una serie falla, se avisa y se muestra el último dato o el de ejemplo.

## Probarlo

Con el servidor del proyecto (puerto 8770) o con cualquier servidor estático:

```bash
python -m http.server 8770 --directory .
```

Abrí `http://localhost:8770`. En el celular, desde la misma red: `http://<ip-de-tu-pc>:8770`.

## Qué tiene

La pantalla principal es una **matriz**: una tabla con 48 indicadores en 8 grupos. Cada fila muestra el dato, su período, la variación contra el dato anterior y contra hace 12 meses, y una tendencia. Al tocar una fila se abre su gráfico con selector de período, mínimo y máximo, fuente, tabla de datos y descarga en CSV.

| Pestaña | Contenido |
|---|---|
| **Tablero** | La matriz. Grupos: Dólar, Precios (inflación, núcleo, regulados, rubros, UVA, CER), Actividad, Empleo y salarios, Fiscal, Comercio exterior, Dinero y tasas, Mercados. Búsqueda, filtro por grupo y orden por variación |
| **Banco Central** | 27 indicadores del BCRA en 5 grupos (reservas y tipo de cambio, base monetaria, tasas de interés, depósitos, crédito al sector privado), gráficos de tasas, compras de divisas, tipo de cambio, depósitos y crédito por tipo, tabla de qué movió la base monetaria y cotizaciones de 39 monedas |
| **Acciones y bonos** | Acciones y bonos en vivo (con demora) con búsqueda y orden |
| **Noticias** | Titulares por tema y por medio |
| **Tu plata** | Variación real de tu plata, termómetro 0-100, inflación personal con el backup de Plata, dólar y alertas activas |
| **Más** | Calculadoras (plazo fijo contra dólar, sueldo contra inflación), alertas de brecha, perfil y fuentes |

El color indica dirección (azul sube, naranja baja), no si algo es bueno o malo. Cada fila muestra su período porque los datos mensuales y trimestrales se publican con rezago.

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
| Inflación por rubro, EMAE, IPI, PBI, salarios, desocupación, comercio, resultado fiscal, recaudación, SMVM, haber mínimo, RIPTE | datos.gob.ar (INDEC, Hacienda, ARCA, Trabajo, ANSES) |
| Acciones y bonos | data912 (con demora) |
| Noticias | `news.json`, generado por `scripts/fetch_news.py` desde RSS públicos |

Las series de datos.gob.ar tienen un comportamiento particular: devuelven vacío si el pedido no encaja con el largo de la serie. `series.js` prueba varias formas de pedido hasta que una devuelva datos.

### Noticias

`python scripts/fetch_news.py` baja los feeds de Ámbito, Infobae, La Nación, iProfesional y Perfil, se queda con las últimas 48 horas, clasifica por tema según palabras del título y escribe `news.json`. Solo se guarda título, medio, fecha y link. El workflow `.github/workflows/news.yml` lo corre cada hora de 6 a 23 hs (hora de Buenos Aires) cuando el repo esté en GitHub.

### Inflación personal con Plata

En Perfil elegís el backup de Plata. Se procesa en el navegador y solo se guardan totales por categoría (no movimientos ni notas). Cada categoría se cruza con el índice del INDEC de su rubro (transporte, salud, educación, ropa, hogar). Las que no tienen índice propio usan la inflación general. Comida y servicios todavía no tienen serie mensual disponible.

## Estructura

```
index.html   vistas y markup
styles.css   tokens, tema claro y oscuro
app.js       modelo, render y navegación por hash
series.js    catálogo de series y carga (47 series)
charts.js    gráficos SVG: líneas, barras, sparklines, CSV
tablero.js   matriz de indicadores y vista de acciones y bonos
api.js       dólar y datos para Tu plata, con respaldo
data.js      datos de ejemplo y valores por defecto
news.json    titulares (generado)
scripts/     fetch_news.py
sw.js        cache offline del shell
manifest.webmanifest
assets/icon.svg
```

## Iterar el diseño con ramas

```bash
git switch -c ui/bento      # probar una variante
git switch main             # volver
```

Una rama por variante visual, y se comparan lado a lado.

## Siguiente paso

1. Subir el repo a GitHub (privado) para que el workflow actualice `news.json` solo.
2. Alertas push reales: hace falta un cron que revise y avise.
3. Elegir una variante visual (ramas `ui/*`).
4. Revisar con `design:accessibility-review` y `design:design-critique`.
