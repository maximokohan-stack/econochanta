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

    # ---------- datos nuevos (data/indec_extra.json) ----------
    # Se guardan aparte para no tocar las series que ya usa la web. En cada tabla se imprime qué valores
    # trae (códigos, regiones, tipos) para poder revisar la estructura en el registro de la Action.
    extra, extra_fallas = {}, []

    def mostrar(nombre, filas, cols):
        print("== %s: %d filas" % (nombre, len(filas)))
        for c in cols:
            vals = sorted({str(f.get(c)) for f in filas})
            print("   %s (%d): %s" % (c, len(vals), " | ".join(vals[:40])))

    def intentar_extra(nombre, fn):
        try:
            extra[nombre] = fn()
        except Exception as e:
            extra_fallas.append("%s: %s" % (nombre, e))

    # IPC: los rubros que faltan (alimentos 01, vivienda 04, recreación 09, restaurantes 11, bienes varios 12)
    def ipc_rubros():
        f = pedir("ipc_nacional", {"region": "eq.Nacional", "tipo_de_indicador": "eq.Indice",
                                   "codigo": "in.(01,04,09,11,12)", "order": "periodo.asc"})
        mostrar("ipc_rubros", f, ["codigo", "descripcion", "nivel", "clasificador"])
        return {c: {"nombre": next((x["descripcion"] for x in f if x["codigo"] == c), c), "puntos": serie([x for x in f if x["codigo"] == c])}
                for c in sorted({x["codigo"] for x in f})}
    intentar_extra("ipc_rubros", ipc_rubros)

    # IPC por región: nivel general, inflación mensual e interanual
    def ipc_regiones():
        f = pedir("ipc_nacional", {"codigo": "eq.0", "tipo_de_indicador": "in.(v_m,v_ia)", "order": "periodo.asc"})
        mostrar("ipc_regiones", f, ["region", "nivel", "tipo_de_indicador"])
        res = {}
        for r in sorted({x["region"] for x in f}):
            g = [x for x in f if x["region"] == r and x["nivel"].lower() == "nivel general"]
            res[r] = {"infM": serie([x for x in g if x["tipo_de_indicador"] == "v_m"], fin=True),
                      "infIA": serie([x for x in g if x["tipo_de_indicador"] == "v_ia"], fin=True)}
        return res
    intentar_extra("ipc_regiones", ipc_regiones)

    # Canasta básica alimentaria y total (GBA)
    def canastas():
        f = pedir("valorizacion_canastas_cba_cbt", {"order": "periodo.asc"})
        mostrar("canastas", f, ["clasificador", "nivel", "codigo", "descripcion", "indicador", "tipo_de_indicador", "tipo_de_indicador_descripcion", "region", "unidad_de_medida"])
        res = {}
        for clave in sorted({(x["codigo"], x["tipo_de_indicador"]) for x in f}):
            g = [x for x in f if (x["codigo"], x["tipo_de_indicador"]) == clave]
            res["%s|%s" % clave] = {"descripcion": g[0].get("descripcion"), "tipo": g[0].get("tipo_de_indicador_descripcion"),
                                    "unidad": g[0].get("unidad_de_medida"), "puntos": serie(g, fin=True)}
        return res
    intentar_extra("canastas", canastas)

    # Mercado de trabajo completo (31 aglomerados)
    def trabajo():
        f = pedir("mercado_trabajo_eph", {"area_geografica_nom": "eq.T_31_A", "order": "anio.asc,trimestre.asc"})
        cols = ["tasa_de_actividad", "tasa_de_empleo", "tasa_de_empleo_formal", "tasa_de_empleo_informal", "tasa_de_desocupacion",
                "tasa_de_ocupacion_demandante", "tasa_de_subocupacion", "tasa_de_subocupacion_demandante", "tasa_de_subocupacion_no_demandante"]
        print("== trabajo: %d filas; ultima: %s" % (len(f), {c: f[-1].get(c) for c in cols} if f else "-"))
        return {c: [["%04d-%02d-01" % (x["anio"], (x["trimestre"] - 1) * 3 + 1), x[c]] for x in f if x.get(c) is not None] for c in cols}
    intentar_extra("trabajo", trabajo)

    # Pobreza e indigencia en hogares (semestral)
    def pobreza_hogares():
        f = pedir("pobreza_eph", {"area_geografica_nom": "eq.T_31_A", "order": "anio.asc,semestre.asc"})
        return {c: [["%04d-%02d-01" % (x["anio"], 1 if x["semestre"] == 1 else 7), x[c]] for x in f if x.get(c) is not None]
                for c in ("tasa_pobreza_hogares", "tasa_indigencia_hogares")}
    intentar_extra("pobreza_hogares", pobreza_hogares)

    # Canasta de crianza (GBA, desde 2020)
    def crianza():
        f = pedir("canasta-crianza", {"order": "Periodo.asc"})
        cols = [c for c in (f[0].keys() if f else []) if c[:4] in ("bys_", "cuid", "tot_")]
        print("== crianza: %d filas; columnas %s; ultima %s" % (len(f), cols, f[-1] if f else "-"))
        return {c: [[fecha_mes(str(x["Periodo"]), fin=True), x[c]] for x in f if x.get(c) is not None] for c in cols}
    intentar_extra("crianza", crianza)

    # Población total del país (1 de julio de cada año)
    def poblacion():
        f = pedir("proyecciones_poblacion_nacional_2022_2040", {"order": "fecha.asc"})
        mostrar("poblacion", f, ["sexo_cod", "sexo_nom"])
        por = {}
        for x in f:
            por.setdefault(x["fecha"], {}).setdefault(x["sexo_nom"], 0)
            por[x["fecha"]][x["sexo_nom"]] += x["poblacion"] or 0
        tot = {}
        for a, s in por.items():
            t = [v for k, v in s.items() if "total" in str(k).lower() or str(k).lower() in ("ambos sexos", "ambos")]
            tot[a] = t[0] if t else sum(s.values())
        print("   poblacion por anio:", {a: (por[a], tot[a]) for a in sorted(por)[:5]})
        return [[str(a), tot[a]] for a in sorted(tot)]
    intentar_extra("poblacion", poblacion)

    if extra:
        prev_extra = {}
        ruta_extra = os.path.join(os.path.dirname(SALIDA), "indec_extra.json")
        try:
            with open(ruta_extra, encoding="utf-8") as fh:
                prev_extra = json.load(fh).get("datos", {})
        except (OSError, ValueError):
            pass
        for k, v in prev_extra.items():
            extra.setdefault(k, v)
        with open(ruta_extra, "w", encoding="utf-8") as fh:
            json.dump({"fuente": "INDEC, API oficial (api.indec.gob.ar)",
                       "generado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                       "datos": extra}, fh, ensure_ascii=False, separators=(",", ":"))
    for f in extra_fallas:
        print("FALLO EXTRA", f)

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
