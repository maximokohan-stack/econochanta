# Econochanta

La economía argentina filtrada por lo que vos tenés. Sin chamuyo.

Prototipo de UI/UX, PWA estática (HTML, CSS y JS sin build). Usa **datos de ejemplo** en `data.js`.

## Probarlo

Con el servidor del proyecto (puerto 8770) o con cualquier servidor estático:

```bash
python -m http.server 8770 --directory .
```

Abrí `http://localhost:8770`. En el celular, desde la misma red: `http://<ip-de-tu-pc>:8770`.

## Qué tiene

| Pantalla | Qué hace |
|---|---|
| **Hoy** | Variación real de tu plata (desde ayer y 30 días), mensaje del día, termómetro 0-100 ponderado por tu perfil, dólar y brecha, alertas activas |
| **Perfil** | 5 datos de exposición (sueldo, ahorros en pesos y en USD, alquiler/UVA, gasto en USD). Se guardan en `localStorage` |
| **Calcular** | Plazo fijo vs dólar, y sueldo vs inflación |
| **Alertas** | Umbrales de brecha MEP, CCL y blue. Se evalúan al abrir la app |

## Cómo se calcula (resumen)

- **Exposición:** sueldo x 3 (referencia), ahorros en pesos y ahorros en USD a valor MEP. De ahí salen los pesos relativos.
- **Termómetro:** 5 factores (inflación, plazo fijo contra precios, brecha CCL, movimiento del dólar 30 días, reservas). Cada uno da un puntaje 0-100 y se promedia con pesos que dependen de tu perfil.
- **Tu plata en términos reales:** cada parte de tu plata (sueldo, ahorro en pesos, dólares) se ajusta por su propia variación menos la inflación.

Es una aproximación para decidir, no asesoramiento financiero.

## Estructura

```
index.html   vistas y markup
styles.css   tokens, tema claro y oscuro
app.js       modelo, render y navegación por hash
data.js      datos mock y valores por defecto
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

1. Reemplazar `data.js` por datos reales: DolarAPI (cotizaciones), BCRA (reservas, tasas) y ArgentinaDatos (inflación).
2. Alertas push reales: hace falta un cron (por ejemplo GitHub Actions) que revise y avise.
3. Inflación personal con los gastos de Plata (`Documents/gastos-app`).
4. Revisar con `design:accessibility-review` y `design:design-critique`.
