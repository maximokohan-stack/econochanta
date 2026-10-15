#!/usr/bin/env python3
"""
Genera news.json con titulares de economia argentina (solo titulo, medio, fecha y link).

- Fuentes: feeds RSS publicos de cada medio. No se copia el texto de las notas.
- Ventana: ultimas 48 horas.
- Temas: se asignan por palabras clave del titulo.
- Pensado para correr cada hora (ver .github/workflows/news.yml) o a mano:
    python scripts/fetch_news.py
Solo usa la libreria estandar.
"""
import json
import re
import sys
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

FEEDS = [
    ("Ámbito", "https://www.ambito.com/rss/pages/economia.xml"),
    ("Infobae", "https://www.infobae.com/arc/outboundfeeds/rss/category/economia/"),
    ("La Nación", "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/?outputType=xml"),
    ("iProfesional", "https://www.iprofesional.com/rss/economia"),
    ("Perfil", "https://www.perfil.com/feed/economia"),
]

TEMAS = [
    ("dolar", "Dólar", ["dolar", "blue", "mep", "ccl", "cambio", "brecha", "cepo", "tipo de cambio", "divisa", "billete verde"]),
    ("inflacion", "Inflación y precios", ["inflacion", "ipc", "precios", "canasta", "indec", "aumento", "alquiler", "tarifas", "supermercado"]),
    ("mercados", "Mercados", ["bono", "bonos", "accion", "acciones", "merval", "riesgo pais", "bolsa", "wall street", "tasa", "plazo fijo", "caucion", "cedear", "cripto", "bitcoin"]),
    ("actividad", "Actividad y empleo", ["salario", "salarios", "empleo", "desempleo", "industria", "pbi", "consumo", "actividad", "paritaria", "jubilacion", "jubilaciones", "pyme", "ventas", "construccion"]),
    ("politica", "Política económica", ["fmi", "gobierno", "caputo", "milei", "bcra", "banco central", "reservas", "deficit", "superavit", "impuesto", "impuestos", "retenciones", "reforma", "presupuesto", "deuda", "ley"]),
    ("empresas", "Empresas", ["empresa", "empresas", "compania", "inversion", "inversiones", "ypf", "vaca muerta", "exportaciones", "importaciones", "balance", "ganancia"]),
]

VENTANA_HORAS = 48
POR_MEDIO = 25
MAX_ITEMS = 110
UA = "Mozilla/5.0 (Econochanta lector personal de titulares)"


def sin_acentos(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def tema_de(titulo):
    t = " " + re.sub(r"[^a-z0-9 ]+", " ", sin_acentos(titulo)) + " "
    for tid, _label, claves in TEMAS:
        for k in claves:
            if " " + k + " " in t:
                return tid
    return "otros"


def parse_fecha(txt):
    if not txt:
        return None
    try:
        d = parsedate_to_datetime(txt)
    except Exception:
        try:
            d = datetime.fromisoformat(txt.replace("Z", "+00:00"))
        except Exception:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)


def descargar(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=20).read()


def items_de(data):
    root = ET.fromstring(data)
    out = []
    for it in root.iter("item"):
        titulo = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        fecha = parse_fecha(it.findtext("pubDate"))
        if titulo and link and link.startswith("http"):
            out.append((titulo, link, fecha))
    return out


def main():
    ahora = datetime.now(timezone.utc)
    desde = ahora - timedelta(hours=VENTANA_HORAS)
    items, fuentes, vistos = [], [], set()

    for medio, url in FEEDS:
        try:
            crudos = items_de(descargar(url))
            n = 0
            crudos.sort(key=lambda x: x[2] or desde, reverse=True)
            for titulo, link, fecha in crudos:
                if n >= POR_MEDIO:
                    break
                if fecha is None or fecha < desde or fecha > ahora + timedelta(hours=1):
                    continue
                clave = re.sub(r"\W+", "", sin_acentos(titulo))[:80]
                if clave in vistos:
                    continue
                vistos.add(clave)
                items.append({
                    "titulo": titulo,
                    "medio": medio,
                    "url": link,
                    "fecha": fecha.isoformat().replace("+00:00", "Z"),
                    "tema": tema_de(titulo),
                })
                n += 1
            fuentes.append({"medio": medio, "ok": True, "n": n})
        except Exception as e:  # un medio caido no tira abajo al resto
            fuentes.append({"medio": medio, "ok": False, "n": 0, "error": str(e)[:80]})

    items.sort(key=lambda x: x["fecha"], reverse=True)
    items = items[:MAX_ITEMS]

    salida = {
        "actualizado": ahora.isoformat().replace("+00:00", "Z"),
        "ventanaHoras": VENTANA_HORAS,
        "temas": [{"id": t[0], "label": t[1]} for t in TEMAS] + [{"id": "otros", "label": "Otros"}],
        "fuentes": fuentes,
        "items": items,
    }
    destino = Path(__file__).resolve().parent.parent / "news.json"
    destino.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"news.json: {len(items)} titulares, " + ", ".join(f"{f['medio']} {'ok' if f['ok'] else 'ERROR'}({f['n']})" for f in fuentes))
    if not any(f["ok"] for f in fuentes):
        sys.exit(1)


if __name__ == "__main__":
    main()
