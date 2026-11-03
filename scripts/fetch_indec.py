"""Baja series de la API oficial del INDEC (https://api.indec.gob.ar/v1) y las guarda en data/indec.json.

Necesita el token en la variable de entorno INDEC_TOKEN (en GitHub: secreto del repositorio).
El token nunca se escribe en el archivo de salida: la web solo lee data/indec.json.

Cada serie queda con el mismo nombre que usa la web (series.js), asi la web puede completar
con estos puntos los meses que datos.gob.ar todavia no publico.
"""
import calendar
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE = "https://api.indec.gob.ar/v1/"
TOKEN = os.environ.get("INDEC_TOKEN", "").strip()
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "indec.json")
PAGINA = 1000


def pedir(tabla, params):
    """Trae todas las filas de una tabla, de a 1000 (limite del servicio)."""
    filas, offset = [], 0
    while True:
        q = dict(params)
        q["limit"] = PAGINA
        q["offset"] = offset
        url = BASE + tabla + "?" + urllib.parse.urlencode(q, safe=".,()*")
        req = urllib.request.Request(url, headers={"Authorization": "Bearer " + TOKEN, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                lote = json.load(r)
        except urllib.error.HTTPError as e:
            raise RuntimeError("%s -> HTTP %s" % (tabla, e.code))
        filas.extend(lote)
        if len(lote) < PAGINA:
            return filas
        offset += PAGINA


def fecha_mes(periodo, fin=False):
    """'202609' -> '2026-09-01' (o '2026-09-30' si fin)."""
    a, m = int(periodo[:4]), int(periodo[4:6])
    d = calendar.monthrange(a, m)[1] if fin else 1
    return "%04d-%02d-%02d" % (a, m, d)


def serie(filas, valor="valor", fin=False, escala=1.0):
    pts = {}
    for f in filas:
        v = f.get(valor)
        if v is None:
            continue
        pts[fecha_mes(f["periodo"], fin)] = round(float(v) * escala, 6)
    return [[d, pts[d]] for d in sorted(pts)]


def main():
    if not TOKEN:
        sys.exit("Falta INDEC_TOKEN")
    out, fallas = {}, []

    def intentar(nombre, fn):
        try:
            out.update(fn())
        except Exception as e:  # una tabla caida no debe tirar las demas
            fallas.append("%s: %s" % (nombre, e))

    # EMAE: indice desestacionalizado y su variacion mensual (en %)
    def emae():
        f = pedir("estimador-mensual-de-actividad-economica-nivel-general", {"order": "periodo.asc"})
        idx = [x for x in f if x["tipo_de_indicador_descripcion"] == "Índice serie desestacionalizada"]
        var = [x for x in f if x["tipo_de_indicador_descripcion"] == "Var % mensual serie desestacionalizada"]
        return {"emae": serie(idx), "emaeVM": serie(var)}
    intentar("emae", emae)

    # IPC nacional: indices por categoria y division + inflacion mensual e interanual
    def ipc():
        f = pedir("ipc_nacional", {
            "region": "eq.Nacional",
            "tipo_de_indicador": "in.(Indice,v_m,v_ia)",
            "codigo": "in.(0,N,R,E,02,03,05,06,07,08,10)",
            "order": "periodo.asc",
        })
        cod = {"0": "ipcGeneral", "N": "ipcNucleo", "R": "ipcRegulados", "E": "ipcEstacionales", "07": "ipcTransporte",
               "06": "ipcSalud", "10": "ipcEducacion", "03": "ipcPrendas", "05": "ipcEquipamiento",
               "08": "ipcComunicaciones", "02": "ipcBebidas"}
        res = {}
        for c, k in cod.items():
            res[k] = serie([x for x in f if x["codigo"] == c and x["tipo_de_indicador"] == "Indice"])
        gen = [x for x in f if x["codigo"] == "0" and x["nivel"].lower() == "nivel general"]
        res["infM"] = serie([x for x in gen if x["tipo_de_indicador"] == "v_m"], fin=True)
        res["infIA"] = serie([x for x in gen if x["tipo_de_indicador"] == "v_ia"], fin=True)
        return res
    intentar("ipc", ipc)

    # Indice de salarios (base octubre 2016 = 100)
    def salarios():
        f = pedir("indice_salarios", {
            "tipo_de_indicador": "eq.Indice", "codigo": "in.(100,110,120,200)", "order": "periodo.asc"})
        cod = {"100": "salarios", "110": "salPrivado", "120": "salPublico", "200": "salNoReg"}
        return {k: serie([x for x in f if x["codigo"] == c]) for c, k in cod.items()}
    intentar("salarios", salarios)

    # Industria manufacturera: indice desestacionalizado, nivel general
    def ipi():
        f = pedir("ipi_manufacturero", {
            "codigo_CLaNAE_2004": "eq.D", "serie": "eq.Serie desestacionalizada",
            "tipo_de_indicador": "eq.Índice", "order": "periodo.asc"})
        return {"ipi": serie(f)}
    intentar("ipi", ipi)

    # EPH: desocupacion trimestral (total 31 aglomerados) y pobreza/indigencia semestral
    def eph():
        f = pedir("mercado_trabajo_eph", {"area_geografica_nom": "eq.T_31_A", "order": "anio.asc,trimestre.asc"})
        pts = [[ "%04d-%02d-01" % (x["anio"], (x["trimestre"] - 1) * 3 + 1), x["tasa_de_desocupacion"]]
               for x in f if x.get("tasa_de_desocupacion") is not None]
        return {"desocupacion": pts}
    intentar("eph", eph)

    def pobreza():
        f = pedir("pobreza_eph", {"area_geografica_nom": "eq.T_31_A", "order": "anio.asc,semestre.asc"})
        def pts(col):
            return [["%04d-%02d-01" % (x["anio"], 1 if x["semestre"] == 1 else 7), x[col]]
                    for x in f if x.get(col) is not None]
        return {"pobreza": pts("tasa_pobreza_personas"), "indigencia": pts("tasa_indigencia_personas")}
    intentar("pobreza", pobreza)

    if not out:
        sys.exit("No se pudo bajar nada: " + "; ".join(fallas))

    # Si una tabla fallo, se conserva lo que ya habia para esas series.
    previo = {}
    try:
        with open(SALIDA, encoding="utf-8") as fh:
            previo = json.load(fh).get("series", {})
    except (OSError, ValueError):
        pass
    for k, v in previo.items():
        out.setdefault(k, v)

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    doc = {"fuente": "INDEC, API oficial (api.indec.gob.ar)",
           "generado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "series": out}
    with open(SALIDA, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    for k in sorted(out):
        print("%-18s %4d puntos, ultimo %s" % (k, len(out[k]), out[k][-1][0] if out[k] else "-"))
    for f in fallas:
        print("FALLO", f)


if __name__ == "__main__":
    main()
