"""Arma data/deuda.json: deuda bruta del Tesoro por acreedor y deuda neta (sin la parte en manos del propio Estado).

Fuente: Secretaría de Finanzas, «Datos trimestrales de la deuda»
(https://www.argentina.gob.ar/economia/finanzas/datos-trimestrales-de-la-deuda), presentación gráfica de cada
trimestre, cuadro «Deuda Bruta de la Administración Central por acreedor». Cada informe trae dos columnas:
el diciembre anterior (a) y el trimestre del informe (b).

Además:
- Por organismo internacional (FMI, BID, Banco Mundial, CAF): planilla «Excel» del último trimestre, hoja A.2.1.
- Deuda propia del BCRA al cierre de cada trimestre: API de estadísticas del BCRA v4.0, series 158 (LEBAC, LEDIV y
  BOPREAL, en US$), 1258 (letras en pesos), 1262 (pases pasivos) y 5 (tipo de cambio de referencia, para pasar pesos a US$).

Se corre a mano cuando sale un informe nuevo (uno por trimestre, con unos tres meses de atraso):
    python scripts/build_deuda.py
Necesita PyMuPDF y openpyxl (pip install pymupdf openpyxl). No usa claves.
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


BCRA = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/"


def serie_bcra(idv, desde, hasta):
    import bisect
    d = json.loads(bajar(BCRA + str(idv) + "?desde=" + desde + "&hasta=" + hasta + "&limit=3000"))
    pts = sorted((x["fecha"], x["valor"]) for x in d["results"][0]["detalle"])
    fechas = [p[0] for p in pts]
    def al(f):  # último dato publicado hasta esa fecha
        i = bisect.bisect_right(fechas, f) - 1
        return pts[i][1] if i >= 0 else None
    return al


def deuda_bcra(fechas):
    desde = (datetime.date.fromisoformat(fechas[0]) - datetime.timedelta(days=15)).isoformat()
    hasta = fechas[-1]
    usd, pesos, pases, tc = (serie_bcra(i, desde, hasta) for i in (158, 1258, 1262, 5))
    out = {}
    for f in fechas:
        t = tc(f)
        if None in (usd(f), pesos(f), t):
            continue
        p = pases(f) or 0
        out[f] = {"titulos": round(usd(f), 1), "letras_pesos": round(pesos(f) / t, 1), "pases": round(p / t, 1),
                  "total": round(usd(f) + pesos(f) / t + p / t, 1)}
    return out


def organismos(html):
    """FMI, BID, Banco Mundial y CAF del último trimestre (hoja A.2.1, en miles de US$ → millones)."""
    import openpyxl, io
    xls = re.findall(r'href="([^"]+deuda_publica[^"]+\.xlsx)"', html)
    if not xls:
        return None, None
    url = xls[0] if xls[0].startswith("http") else "https://www.argentina.gob.ar" + xls[0]
    wb = openpyxl.load_workbook(io.BytesIO(bajar(url)), read_only=True, data_only=True)
    nombres = {"- FMI": "FMI", "- BID": "BID", "- BIRF": "Banco Mundial", "- CAF": "CAF"}
    out = {}
    for fila in wb["A.2.1"].iter_rows(values_only=True):
        vals = [c for c in fila if c not in (None, "")]
        if vals and isinstance(vals[0], str) and vals[0].strip() in nombres:
            out[nombres[vals[0].strip()]] = round(vals[-1] / 1000, 1)
    return out or None, vencimientos(wb)


MESES_ES = ("Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre")


def vencimientos(wb):
    """Perfil de vencimientos: los próximos 12 meses (hoja A.3.1) y por año (A.3.6), en millones de US$."""
    def filas(nombre):
        out = []
        for r in wb[nombre].iter_rows(values_only=True):
            v = [c for c in r if c not in (None, "")]
            if v and isinstance(v[0], str):
                out.append((v[0].strip(), v[1:]))
        return out
    try:
        cab = next(n_v for n_v in filas("A.3.1") if n_v[0] in MESES_ES)
        cab = [cab[0]] + [str(c).strip() for c in cab[1]]
        idx = [i for i, c in enumerate(cab) if c in MESES_ES]
        meses = [cab[i] for i in idx]
        m = filas("A.3.1")
        def fila(nom):
            for i, (n, v) in enumerate(m):
                if n.upper().startswith(nom):
                    return i, v
            raise KeyError(nom)
        grupos = {"bonos": ["TÍTULOS PÚBLICOS", "LETRAS DEL TESORO"], "organismos": ["ORGANISMOS INTERNACIONALES", "ORGANISMOS OFICIALES"],
                  "otros": ["PRESTAMOS GARANTIZADOS", "BANCA COMERCIAL", "AVALES", "PAGARÉS DEL TESORO", "ADELANTOS TRANSITORIOS BCR"]}
        g = {k: [0.0] * len(idx) for k in grupos}
        for k, ns in grupos.items():
            for n in ns:
                try:
                    _, v = fila(n)
                except KeyError:
                    continue
                for j, ix in enumerate(idx):
                    g[k][j] += v[ix] / 1000
        it, vt = fila("TOTAL")
        tot = [vt[ix] / 1000 for ix in idx]
        cap, inte = m[it + 1][1], m[it + 2][1]
        a = filas("A.3.6")
        anios = next(([str(int(c)) if isinstance(c, float) else str(c) for c in v[:-1]] for n, v in a if n.upper().startswith("TIPO DE ACREEDOR")), None)
        anual = next(([round(x / 1000, 1) for x in v[:-1]] for n, v in a if n == "TOTAL"), None)
        return {"meses": meses, "grupos": {k: [round(x, 1) for x in v] for k, v in g.items()}, "total": [round(x, 1) for x in tot],
                "doce": {"total": round(vt[-1] / 1000, 1), "capital": round(cap[-1] / 1000, 1), "interes": round(inte[-1] / 1000, 1)},
                "anual": {"anios": anios, "total": anual}}
    except Exception as e:
        print("Vencimientos: no se pudo leer la planilla:", e)
        return None


def historia(pagina):
    """Deuda bruta del Tesoro por acreedor en % del PBI, a fin de cada año (gráfico del informe trimestral)."""
    ws = pagina.get_text("words")
    anios = [(w[4], (w[0] + w[2]) / 2) for w in ws if re.fullmatch(r"20\d\d", w[4])]
    trim = [w[4] for w in ws if w[4] in ("IT", "IIT", "IIIT", "IVT")]
    pc = [((w[0] + w[2]) / 2, w[1], float(w[4][:-1].replace(",", "."))) for w in ws if re.fullmatch(r"\d+,\d%", w[4])]
    out, vistos = [], set()
    for nombre, x in sorted(anios, key=lambda a: a[1]):
        col = sorted([v for v in pc if abs(v[0] - x) < 9], key=lambda v: v[1])
        if len(col) != 5 or nombre in vistos:
            continue
        tot, seg = col[0][2], [v[2] for v in col[1:]]
        if abs(sum(seg) - tot) > 0.8:
            continue
        vistos.add(nombre)
        out.append({"anio": nombre, "total": tot, "agencias": seg[0], "neta": round(tot - seg[0], 1)})
    if trim and out:
        out[-1]["anio"] = trim[0] + " " + out[-1]["anio"]   # el último punto es el trimestre del informe, no un fin de año
    return out or None


def main():
    import fitz  # PyMuPDF
    html = bajar(PAGINA).decode("utf-8", "replace")
    pdfs = re.findall(r'href="([^"]+presentacion[^"]+\.pdf)"', html)[:CUANTOS]
    if not pdfs:
        sys.exit("No encontré informes en la página de la Secretaría de Finanzas.")
    serie, hist = {}, None
    for url in pdfs:
        url = url if url.startswith("http") else "https://www.argentina.gob.ar" + url
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as t:
            t.write(bajar(url))
        doc = fitz.open(t.name)
        if hist is None:   # el primer informe de la lista es el más nuevo
            for pag in doc:
                if "acreedor en % del PBI" in pag.get_text().replace("\n", " "):
                    hist = historia(pag)
                    break
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
    bc = deuda_bcra([p["fecha"] for p in puntos])
    for p in puntos:
        if p["fecha"] in bc:
            p["bcra"] = bc[p["fecha"]]
    orgs, venc = organismos(html) or (None, None)
    doc = {
        "fuente": "Secretaría de Finanzas, Deuda Bruta de la Administración Central por acreedor (informes trimestrales)",
        "fuente_bcra": "BCRA, API de estadísticas v4.0: series 158, 1258, 1262 y 5",
        "organismos": orgs,
        "vencimientos": venc,
        "historia": hist,
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
