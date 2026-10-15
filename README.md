# Econochanta

La economía argentina filtrada por lo que vos tenés. Sin chamuyo.

PWA estática (HTML, CSS y JS sin build). El inicio es una tapa de noticias económicas en vivo; el resto mide todo contra tu perfil.

Los datos salen de APIs públicas (sin clave). Si alguna cae, esa parte usa los valores de ejemplo de `data.js` y la app avisa cuál.

## Probarlo

Con el servidor del proyecto (puerto 8770) o con cualquier servidor estático:

```bash
python -m http.server 8770 --directory .
```

Abrí `http://localhost:8770`. En el celular, desde la misma red: `http://<ip-de-tu-pc>:8770`.

## Qué tiene

| Pantalla | Qué hace |
|---|---|
| **Inicio** | Tapa de noticias en vivo: lo último, secciones por tema, filtros por tema y medio, cinta del dólar y resumen de tu plata |
| **Tu plata** | Variación real de tu plata (desde ayer y 30 días), mensaje del día, termómetro 0-100 ponderado por tu perfil, inflación personal, dólar y brecha, alertas activas |
| **Perfil** | 5 datos de exposición (sueldo, ahorros en pesos y en USD, alquiler/UVA, gasto en USD) e importación del backup de Plata. Todo en `localStorage` |
| **Calcular** | Plazo fijo vs dólar, y sueldo vs inflación |
| **Alertas** | Umbrales de brecha MEP, CCL y blue. Se evalúan al abrir la app |

## Cómo se calcula (resumen)

- **Exposición:** sueldo x 3 (referencia), ahorros en pesos y ahorros en USD a valor MEP. De ahí salen los pesos relativos.
- **Termómetro:** 5 factores (inflación, plazo fijo contra precios, brecha CCL, movimiento del dólar 30 días, reservas). Cada uno da un puntaje 0-100 y se promedia con pesos que dependen de tu perfil.
- **Tu plata en términos reales:** cada parte de tu plata (sueldo, ahorro en pesos, dólares) se ajusta por su propia variación menos la inflación.

Es una aproximación para decidir, no asesoramiento financiero.

## De dónde salen los datos

| Dato | Fuente |
|---|---|
| Cotizaciones (oficial, MEP, CCL, blue) | DolarAPI |
| Histórico del dólar, inflación, tasas de plazo fijo | ArgentinaDatos |
| Reservas | API del BCRA |
| Inflación por rubro (INDEC) | datos.gob.ar |
| Noticias | `news.json`, generado por `scripts/fetch_news.py` desde RSS públicos |

### Noticias

`python scripts/fetch_news.py` baja los feeds de Ámbito, Infobae, La Nación, iProfesional y Perfil, se queda con las últimas 48 horas, clasifica por tema según palabras del título y escribe `news.json`. Solo se guarda título, medio, fecha y link. El workflow `.github/workflows/news.yml` lo corre cada hora de 6 a 23 hs (hora de Buenos Aires) cuando el repo esté en GitHub.

### Inflación personal con Plata

En Perfil elegís el backup de Plata. Se procesa en el navegador y solo se guardan totales por categoría (no movimientos ni notas). Cada categoría se cruza con el índice del INDEC de su rubro (transporte, salud, educación, ropa, hogar). Las que no tienen índice propio usan la inflación general. Comida y servicios todavía no tienen serie mensual disponible.

## Estructura

```
index.html   vistas y markup
styles.css   tokens, tema claro y oscuro
app.js       modelo, render y navegación por hash
api.js       capa de datos en vivo con respaldo
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
