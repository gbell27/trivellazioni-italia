#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_map.py — La memoria delle trivellazioni
==============================================
Assembla il sito a partire da:
  - i JSON in data/processed/  (prodotti da prepare_data.py)
  - i template in src/         (shell.html = guscio HTML, style.css = stile, app.js = logica)
MapLibre arriva dalla CDN (unpkg), non è più imballato nel file.

Uso:
    python build_map.py
Genera nella root della repo (pronti per GitHub Pages):
  - index.html   il guscio, con le cifre della copy calcolate dai dati
  - app.js       la logica con dentro i dati (GENERATO: non modificare a mano, vedi src/app.js)
  - style.css    lo stile (copia di src/style.css)

Per cambiare lo STILE: modifica src/style.css (o src/shell.html per l'HTML).
Per cambiare il COMPORTAMENTO della mappa: modifica src/app.js.
Per cambiare i DATI: modifica prepare_data.py e ri-eseguilo.
"""
import os
import json

OUT = os.path.join("data", "processed")

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def stats(wells_str, prod_str):
    """Calcola le cifre della copy DAI DATI veri (niente numeri scritti a mano)."""
    feats = json.loads(wells_str)["features"]
    anni = [f["properties"]["anno"] for f in feats if f["properties"].get("anno")]
    prod = json.loads(prod_str)
    p_anni = [yr for t in prod.values() for yr, _ in t.get("series", [])]
    scart = os.path.join(OUT, "scartati.txt")
    n_scart = sum(1 for l in open(scart, encoding="utf-8") if l.strip() and not l.startswith("#")) if os.path.exists(scart) else 0
    it = lambda n: f"{n:,}".replace(",", ".")
    return {
        "__N_GEOREF__":  it(len(feats)),
        "__N_VIGENTE__": it(sum(1 for f in feats if f["properties"].get("titolo"))),
        "__N_SCARTATI__": it(n_scart),
        "__ANNO_MIN__": str(min(anni)), "__ANNO_MAX__": str(max(anni)),
        "__PROD_MIN__": str(min(p_anni)), "__PROD_MAX__": str(max(p_anni)),
        "__PROD_ACT_MIN__": str(max(p_anni) - 1),
    }

def main():
    wells  = read(os.path.join(OUT, "wells_it.json"))
    titles = read(os.path.join(OUT, "titoli_it.geojson"))
    tinfo  = read(os.path.join(OUT, "title_info_it.json"))
    prod   = read(os.path.join(OUT, "prod_by_title.json"))
    piatt  = read(os.path.join(OUT, "piattaforme.geojson"))
    istanze = read(os.path.join(OUT, "istanze.geojson"))
    natprod = read(os.path.join(OUT, "nat_prod.json"))

    # mappa curata istanza->procedura VIA (chiave = nome normalizzato a minuscole/spazi)
    via_src = json.load(open("via_procedure.json", encoding="utf-8")).get("by_nome", {})
    via_map = {" ".join(k.lower().split()): v for k, v in via_src.items()}
    via = json.dumps(via_map, ensure_ascii=False)

    app   = read(os.path.join("src", "app.js"))
    shell = read(os.path.join("src", "shell.html"))

    # inietta i dati nella logica -> app.js (file separato, con dentro la "sfilza" di dati)
    app = (app.replace("__WELLS__", wells)
              .replace("__TITLES__", titles)
              .replace("__TI__", tinfo)
              .replace("__PROD__", prod)
              .replace("__PIATT__", piatt)
              .replace("__ISTANZE__", istanze)
              .replace("__VIA__", via)
              .replace("__NATPROD__", natprod))
    app = "// FILE GENERATO da build_map.py \u2014 non modificare a mano. Sorgente: src/app.js\n" + app

    # cifre della copy nel guscio, calcolate dai dati (nessun numero hardcoded)
    html = shell
    for ph, val in stats(wells, prod).items():
        html = html.replace(ph, val)

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    with open("app.js", "w", encoding="utf-8") as f:
        f.write(app)
    with open("style.css", "w", encoding="utf-8") as f:   # copia 1:1 del sorgente
        f.write(read(os.path.join("src", "style.css")))

    print(f"Scritti: index.html ({len(html)//1024} KB) + app.js ({len(app)//1024} KB) + style.css")
    print("Pubblica tutti e tre (pi\u00F9 preview.png) con GitHub Pages.")

if __name__ == "__main__":
    main()
