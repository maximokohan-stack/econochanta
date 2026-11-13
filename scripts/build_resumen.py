"""Arma data/resumen.json: las series de la web ya recortadas, para que abra con un solo pedido.

Lee el catalogo de series.js (CAT) y baja cada serie de su fuente (ArgentinaDatos, datos.gob.ar y
BCRA). Las diarias se guardan con sus ultimos ~3 años y las mensuales con hasta 10 años, que es lo
que usan el Inicio y las secciones. La web igual completa en vivo lo que cambia durante el dia.
No usa claves ni tokens.
"""
import json
import os
import re
import ssl
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SALIDA = os.path.join(RAIZ, "data", "resumen.json")
AD = "https://api.argentinadatos.com/v1/"
DG = "https://apis.datos.gob.ar/series/api/series/?format=json"
BCRA = "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/"
MAX_DIARIAS = 800
MAX_PUNTOS = 1300


def catalogo():
    txt = open(os.path.join(RAIZ, "series.js"), encoding="utf-8").read()
    cat = {}
    patron = re.compile(r'^\s{4}(\w+): \{ src: "(ad|adc|dg|bcra)", (?:path|id): ("[^"]*"|\d+)(?:, mult: ([\d.]+))?', re.M)
    for m in patron.finditer(txt):
        cat[m.group(1)] = {"src": m.group(2), "ref": m.group(3).strip('"'), "mult": float(m.group(4) or 1)}
    return cat


def get(url, timeout=60):
    # curl: algunas APIs publicas rechazan el cliente de Python
    r = subprocess.run(["curl", "-sL", "--fail", "-m", str(timeout), "-A", "econochanta-resumen", url],
                       capture_output=True, check=True)
    return json.loads(r.stdout)


def bajar(key, c):
    hoy = date.today().isoformat()
    if c["src"] == "ad":
        pts = [[x["fecha"], float(x["valor"])] for x in get(AD + c["ref"]) if x.get("valor") is not None]
    elif c["src"] == "adc":
        pts = [[x["fecha"], float(x["venta"])] for x in get(AD + "cotizaciones/dolares/" + c["ref"]) if x.get("venta") is not None]
    elif c["src"] == "bcra":
        desde = (date.today() - timedelta(days=800)).isoformat()
        r = get(BCRA + c["ref"] + "?desde=" + desde + "&hasta=" + hoy + "&limit=3000")
        det = (r.get("results") or [{}])[0].get("detalle") or []
        pts = [[x["fecha"], float(x["valor"])] for x in det if x.get("valor") is not None]
    else:
        pts = []
        variantes = ["&start_date=" + (date.today() - timedelta(days=365 * a)).isoformat() for a in (10, 6, 4, 2)]
        variantes += ["&sort=desc&limit=" + str(n) for n in (120, 60, 24)]
        for v in variantes:
            r = get(DG + "&ids=" + c["ref"] + v + ("" if "limit" in v else "&limit=1000"))
            pts = [[x[0], float(x[1]) * c["mult"]] for x in r.get("data") or [] if x[1] is not None and x[0] <= hoy]
            if pts:
                break
    pts.sort(key=lambda p: p[0])
    pts = [[d, round(v, 6)] for d, v in pts if d <= hoy]
    diaria = len(pts) > 2 and (date.fromisoformat(pts[-1][0]) - date.fromisoformat(pts[-2][0])).days <= 4
    return pts[-(MAX_DIARIAS if diaria else MAX_PUNTOS):]


def main():
    cat = catalogo()
    out, fallas = {}, []

    def uno(item):
        k, c = item
        try:
            return k, bajar(k, c), None
        except Exception as e:  # una serie caida no frena las demas
            return k, None, str(e)[:120]

    with ThreadPoolExecutor(max_workers=8) as ex:
        for k, pts, err in ex.map(uno, cat.items()):
            if pts:
                out[k] = pts
            else:
                fallas.append(k + (": " + err if err else ": vacia"))

    # lo que fallo esta vez se conserva de la corrida anterior
    try:
        previo = json.load(open(SALIDA, encoding="utf-8")).get("series", {})
    except (OSError, ValueError):
        previo = {}
    for k, v in previo.items():
        out.setdefault(k, v)

    if len(out) < len(cat) // 2:
        sys.exit("Demasiadas fallas, no se guarda: " + "; ".join(fallas[:10]))
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    doc = {"generado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "series": out}
    with open(SALIDA, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    print("%d series, %d KB" % (len(out), os.path.getsize(SALIDA) // 1024))
    for f in fallas:
        print("FALLO", f)


if __name__ == "__main__":
    main()
