"""Arma data/deuda.json: deuda bruta del Tesoro por acreedor y deuda neta (sin la parte en manos del propio Estado).

Fuente: Secretaría de Finanzas, «Datos trimestrales de la deuda»
(https://www.argentina.gob.ar/economia/finanzas/datos-trimestrales-de-la-deuda), presentación gráfica de cada
trimestre, cuadro «Deuda Bruta de la Administración Central por acreedor». Cada informe trae dos columnas:
el diciembre anterior (a) y el trimestre del informe (b).

Se corre a mano cuando sale un informe nuevo (uno por trimestre, con unos tres meses de atraso):
    python scripts/build_deuda.py
Necesita PyMuPDF (pip install pymupdf). No usa claves.
"""
import json, re, sys, tempfile, urllib.request, pathlib, datetime

PAGINA = "https://www.argentina.gob.ar/economia/finanzas/datos-trimestrales-de-la-deuda"
SALIDA = pathlib.Path(__file__).resolve().parent.parent / "data" / "deuda.json"
CUANTOS = 8          # informes más recientes que se leen
UA = {"User-Agent": "Mozilla/5.0 (econochanta)"}
FILAS = ["agencias", "privado", "elegible", "multi", "total"]


def bajar(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def num(s):
    return float(s.replace("(", "-").replace(")", "").replace("%", "").replace(".", "").replace(",", "."))


def leer_cuadro(texto):
    """Devuelve {fecha: {fila: (millones, %PBI fin de período)}} o None si el formato no cuadra."""
    toks = [t.strip() for t in texto.split("\n") if t.strip()]
    fechas = [t for t in toks if re.fullmatch(r"\d\d-\d\d-\d{4}", t)]
    if len(fechas) < 2:
        return None
    i = max(k for k, t in enumerate(toks) if t == "(%)")
    nums = [t for t in toks[i + 1:] if re.fullmatch(r"\(?-?[\d.]+(,\d+)?\)?%?", t)]
    if len(nums) < 50:
        return None
    filas = [nums[j:j + 10] for j in range(0, 50, 10)]
    # formato A (2025-2026): a, %, %PBI fin, %PBI prom, b, %, %PBI fin, %PBI prom, var, var%
    a = {f: (num(v[0]), v[2]) for f, v in zip(FILAS, filas)}
    b = {f: (num(v[4]), v[6]) for f, v in zip(FILAS, filas)}
    # cuadra si las partes suman el total y el total es un monto (no un porcentaje)
    ok = lambda x: x["total"][0] > 1000 and abs(x["agencias"][0] + x["privado"][0] + x["multi"][0] - x["total"][0]) < 2
    if ok(a) and ok(b):
        return {fechas[0]: a, fechas[1]: b}
    # formato B (al revés): var%, var, %PBI prom, %PBI fin, %, b, %PBI prom, %PBI fin, %, a
    b = {f: (num(v[5]), v[3]) for f, v in zip(FILAS, filas)}
    a = {f: (num(v[9]), v[7]) for f, v in zip(FILAS, filas)}
    if ok(a) and ok(b):
        return {fechas[1]: a, fechas[0]: b}  # en este formato la fecha del informe va primero
    return None


def main():
    import fitz  # PyMuPDF
    html = bajar(PAGINA).decode("utf-8", "replace")
    pdfs = re.findall(r'href="([^"]+presentacion[^"]+\.pdf)"', html)[:CUANTOS]
    if not pdfs:
        sys.exit("No encontré informes en la página de la Secretaría de Finanzas.")
    serie = {}
    for url in pdfs:
        url = url if url.startswith("http") else "https://www.argentina.gob.ar" + url
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as t:
            t.write(bajar(url))
        doc = fitz.open(t.name)
        for pag in doc:
            tx = pag.get_text()
            if "por acreedor" in tx and "Agencias del Sector" in tx and "Total Deuda P" in tx:
                cuadro = leer_cuadro(tx)
                if cuadro:
                    for fecha, filas in cuadro.items():
                        serie.setdefault(fecha, filas)   # el informe más nuevo manda
                else:
                    print("Formato no reconocido:", url)
                break
        doc.close()
    puntos = []
    for fecha in sorted(serie, key=lambda f: f[6:] + f[3:5] + f[:2]):
        x = serie[fecha]
        puntos.append({
            "fecha": fecha[6:] + "-" + fecha[3:5] + "-" + fecha[:2],
            "total": x["total"][0], "agencias": x["agencias"][0], "privado": x["privado"][0],
            "elegible": x["elegible"][0], "multi": x["multi"][0],
            "pbi": {k: x[k][1] for k in ("total", "agencias", "privado", "multi")},
        })
    doc = {
        "fuente": "Secretaría de Finanzas, Deuda Bruta de la Administración Central por acreedor (informes trimestrales)",
        "url": PAGINA,
        "unidad": "millones de dólares",
        "nota": "Deuda neta = deuda bruta menos la parte en manos de agencias del sector público nacional (BCRA, FGS de la ANSES, Banco Nación y otros). El % del PBI es el de cada informe, a tipo de cambio de fin de período.",
        "generado": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "puntos": puntos,
    }
    SALIDA.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print("ok", len(puntos), "trimestres, último", puntos[-1]["fecha"])


if __name__ == "__main__":
    main()
