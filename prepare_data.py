#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prepare_data.py — La memoria delle trivellazioni
=================================================
Trasforma i dati grezzi ufficiali (in data/raw/) nei file JSON che alimentano
la mappa (in data/processed/). Eseguibile e modificabile: è qui che si rimette
mano ai dati in futuro.

Passi:
  1) Pozzi ViDEPI:   conversione coordinate Monte Mario -> WGS84, decodifica esito/scopo.
  2) Titoli UNMIG:   geometrie + storia provvedimenti con link ai PDF dei decreti (dal KML),
                     attributi (titolari, conferimento, stato) dal CSV, titolari "puliti".
  3) Join spaziale:  a quale titolo vigente appartiene ogni pozzo (point-in-polygon).
  4) Produzione:     volumi mensili per titolo 2004-2026 -> serie annuale per minerale.

Uso:
    pip install -r requirements.txt
    python prepare_data.py

Output in data/processed/: wells_it.json, titoli_it.geojson, title_info_it.json, prod_by_title.json
"""
import os, re, json, warnings, urllib.request
import numpy as np
import pandas as pd
import geopandas as gpd
import html
from lxml import etree
from shapely.geometry import Polygon, MultiPolygon, mapping
warnings.filterwarnings("ignore")

RAW = os.path.join("data", "raw")
OUT = os.path.join("data", "processed")
os.makedirs(OUT, exist_ok=True)

POZZI_CSV   = os.path.join(RAW, "pozzi-storici.csv")
TITOLI_CSV  = os.path.join(RAW, "titoli-idrocarburi.csv")
TITOLI_KML  = os.path.join(RAW, "titoli-idrocarburi.kml")
PROD_CSV    = os.path.join(RAW, "produzione-2026.csv")
KML_URL     = "https://unmig.mase.gov.it/wp-content/uploads/dati/kml/titoli-idrocarburi.kml"
KML_BASE    = "https://unmig.mase.gov.it/wp-content/uploads/dati/kml/"
VIDEPI_POZZI_KML = "https://www.videpi.com/videpi/kml/pozzi-pdf.kml"  # schede PDF per pozzo (titoli cessati)

# --- Meridiano di Monte Mario (Roma) e bounding box Italia ---
MONTE_MARIO = 12.4523333
ITALIA_BBOX = (6.0, 35.0, 19.0, 47.5)  # lon_min, lat_min, lon_max, lat_max

# --- Legenda ufficiale UNMIG 2009 ---
ESITO = {
    "GA": "Gas", "GO": "Gas prevalente e olio", "OG": "Olio prevalente e gas", "OL": "Olio",
    "NP": "Non produttivo", "IG": "Indiziato a gas", "II": "Indiziato a gas ed olio",
    "IO": "Indiziato ad olio", "IS": "Incidentato e/o sospeso", "MG": "Manifestazioni di gas",
    "MM": "Manifestazioni di gas ed olio", "MO": "Manifestazioni di olio", "X": "Non disponibile",
}
SCOPO = {
    "A": "Accertamento", "E": "Esplorativo", "F": "Sfiato", "I": "Iniezione", "M": "Monitoraggio",
    "P": "Approfondimento", "S": "Sviluppo", "ST": "Stratigrafico", "T": "Stoccaggio", "X": "Non disponibile",
}

def norm_titolo(s):
    """Normalizza il nome del titolo (maiuscolo, spazi multipli -> singolo): nel KML alcuni
    titoli 'in codice' hanno spazi doppi (es. 'F.C  2.AG') che nel CSV sono singoli ('F.C 2.AG'),
    e senza questa normalizzazione il join fallisce e i titolari restano vuoti."""
    return re.sub(r"\s+", " ", str(s).upper()).strip()


def classe_esito(code):
    """Raggruppa l'esito in 6 classi di colore per la mappa."""
    if code in ("GA", "MG", "IG"): return "gas"
    if code in ("OL", "MO", "IO"): return "olio"
    if code in ("GO", "OG", "MM", "II"): return "misto"
    if code == "NP": return "sterile"
    return "altro"

# --- Conversione coordinate -----------------------------------------------
def dms_to_dd(value):
    """'12°34'56''E' -> (gradi_decimali, suffisso E/W). Ritorna (None, None) se non valido."""
    m = re.match(r"(\d+)°(\d+)'([\d,\.]+)''\s*([EW])?", str(value).strip())
    if not m:
        return None, None
    g, p, s = float(m.group(1)), float(m.group(2)), float(m.group(3).replace(",", "."))
    if p >= 60 or s >= 60:
        return None, None
    return g + p / 60 + s / 3600, m.group(4)

def geolocalizza(pz):
    """
    Calcola lat/lon WGS84 per tutti i pozzi (due passate).
      - In MARE: la longitudine è già in Greenwich; se non cade in Italia si prova l'offset da Monte Mario.
      - A TERRA: la longitudine è un offset da Monte Mario. Il suffisso E/W a volte è errato: dopo una
        prima assegnazione si correggono i pochi pozzi il cui lato è incoerente con la MEDIANA della loro
        provincia (ancora geografica ricavata dai dati stessi, senza tabelle esterne).
    Ritorna (serie lat, serie lon); i pozzi non collocabili restano NaN e verranno scartati.
    """
    lo, la_, hi, ha = ITALIA_BBOX
    MMv = MONTE_MARIO
    pz = pz.copy()
    lat, mm, suf = [], [], []
    for _, r in pz.iterrows():
        a, _s = dms_to_dd(r["Latitudine"])
        b, s = dms_to_dd(r["Longitudine"])
        lat.append(a); mm.append(b); suf.append(s)
    pz["_lat"], pz["_m"], pz["_suf"] = lat, mm, suf
    pz["_off"] = pz["Terra/ Mare"].astype(str).str.strip().str.upper().eq("M")

    def inside(lon, la):
        return (lon is not None and la is not None and not pd.isna(lon) and not pd.isna(la)
                and lo <= lon <= hi and la_ <= la <= ha)

    def base_lon(r):
        m, a, s = r["_m"], r["_lat"], r["_suf"]
        if pd.isna(m) or pd.isna(a):
            return np.nan
        if r["_off"]:                                  # offshore: prima Greenwich
            for c in (m, MMv + m, MMv - m):
                if inside(c, a):
                    return c
            return np.nan
        return (MMv + m) if s == "E" else ((MMv - m) if s == "W" else (MMv + m))
    pz["_lon"] = pz.apply(base_lon, axis=1)

    # mediana di longitudine per provincia = ancora geografica (ricavata dai dati stessi)
    onm = (~pz["_off"]) & pz["_lon"].notna()
    pz["_med"] = np.nan
    pz.loc[onm, "_med"] = pz.loc[onm].groupby("Provincia/ Zona marina")["_lon"].transform("median")

    def final_lon(r):                                   # onshore: candidato più vicino alla mediana provinciale
        m, a = r["_m"], r["_lat"]
        if r["_off"] or pd.isna(m) or pd.isna(a):
            return r["_lon"]
        cands = [c for c in (MMv + m, MMv - m, m) if inside(c, a)]
        if not cands:
            return np.nan
        if pd.isna(r["_med"]):
            return cands[0]
        return min(cands, key=lambda c: abs(c - r["_med"]))
    pz["_lon"] = pz.apply(final_lon, axis=1)

    okm = pz.apply(lambda r: inside(r["_lon"], r["_lat"]), axis=1)
    return pz["_lat"].where(okm), pz["_lon"].where(okm)

# --- Titolari: da "ENI (63,34% r.u.) - ROCKHOPPER CIVITA (22,89%)" a ['ENI','ROCKHOPPER CIVITA']
def estrai_titolari(s):
    out = []
    for parte in re.split(r"\s-\s", str(s or "")):
        nome = re.sub(r"\s*\([^)]*\)\s*", "", parte).strip()  # toglie la (percentuale)
        if nome and nome.lower() != "nan":
            out.append(nome)
    visti, res = set(), []
    for n in out:
        if n.upper() not in visti:
            visti.add(n.upper()); res.append(n)
    return res

# --- KML: geometrie + provvedimenti con link ai decreti --------------------
def scarica_kml_se_assente():
    if not os.path.exists(TITOLI_KML):
        print("KML assente: lo scarico da UNMIG...")
        urllib.request.urlretrieve(KML_URL, TITOLI_KML)

def _localname(tag):
    return etree.QName(tag).localname

def _coords_to_polygon(text):
    pts = [(float(t.split(",")[0]), float(t.split(",")[1]))
           for t in text.split() if len(t.split(",")) >= 2]
    return Polygon(pts) if len(pts) >= 3 else None

def parse_kml():
    """Ritorna un GeoDataFrame con: titolo, geometry, provv (lista decreti con link)."""
    parser = etree.XMLParser(recover=True, huge_tree=True)  # KML UNMIG leggermente malformato
    root = etree.parse(TITOLI_KML, parser).getroot()
    decreto_re = re.compile(
        r'href="(https://unmig\.mase\.gov\.it/wp-content/uploads/decreti/(\d+)_(\d{8})\.pdf)"[^>]*>([^<]+)</a>')
    righe = []
    for pm in root.iter():
        if _localname(pm) != "Placemark":
            continue
        nome, desc = None, ""
        for c in pm:
            if _localname(c) == "name": nome = (c.text or "").strip()
            if _localname(c) == "description": desc = c.text or ""
        polys = []
        for el in pm.iter():
            if _localname(el) == "Polygon":
                for sub in el.iter():
                    if _localname(sub) == "outerBoundaryIs":
                        for s2 in sub.iter():
                            if _localname(s2) == "coordinates" and s2.text:
                                p = _coords_to_polygon(s2.text)
                                if p: polys.append(p)
        if not (nome and polys):
            continue
        geom = polys[0] if len(polys) == 1 else MultiPolygon(polys)
        matches = decreto_re.findall(desc)
        provv = [{"data": f"{ymd[6:8]}/{ymd[4:6]}/{ymd[0:4]}", "natura": nat.strip(), "pdf": url}
                 for url, idc, ymd, nat in matches]
        tid = matches[0][1] if matches else None      # id univoco del titolo (dai link dei decreti)
        righe.append({"titolo": norm_titolo(nome), "id": tid, "geometry": geom,
                      "provv": json.dumps(provv, ensure_ascii=False)})
    return gpd.GeoDataFrame(righe, crs="EPSG:4326")

# === STRATI EXTRA DAL MASE (piattaforme, istanze di nuovi titoli) =========
def _scarica_layer(fn):
    """Scarica un KML del MASE se non già presente in data/raw (fonte: portale UNMIG)."""
    import urllib.request
    dest = os.path.join(RAW, fn)
    if not os.path.exists(dest):
        req = urllib.request.Request(KML_BASE + fn, headers={"User-Agent": "trivellazioni-italia/1.0"})
        open(dest, "wb").write(urllib.request.urlopen(req, timeout=60).read())
    return dest

def _clean_desc(desc):
    t = re.sub(r"<[^>]+>", " ", desc or "")
    t = html.unescape(t).replace("\xa0", " ")        # &nbsp; &agrave; ... -> testo reale
    return re.sub(r"\s+", " ", t).strip()

def _placemarks(path):
    root = etree.fromstring(open(path, "rb").read(), etree.XMLParser(recover=True))
    for el in root.iter():
        if isinstance(el.tag, str) and _localname(el) == "Placemark":
            yield el

def _nome_desc(pm):
    nome = desc = ""
    for c in pm.iter():
        ln = _localname(c)
        if ln == "name" and c.text and not nome: nome = c.text.strip()
        if ln == "description" and c.text and not desc: desc = c.text
    return re.sub(r"\s+", " ", nome).strip(), desc

def parse_piattaforme(path):
    """Piattaforme marine (punti) con operatore, minerale, titolo, anno, distanza costa."""
    feats = []
    for pm in _placemarks(path):
        nome, desc = _nome_desc(pm)
        xy = None
        for el in pm.iter():
            if _localname(el) == "Point":
                for s in el.iter():
                    if _localname(s) == "coordinates" and s.text:
                        a = s.text.strip().split(","); xy = [float(a[0]), float(a[1])]
        if not xy:
            continue
        t = _clean_desc(desc)
        g = lambda pat: (re.search(pat, t).group(1).strip() if re.search(pat, t) else None)
        feats.append({"type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(xy[0], 5), round(xy[1], 5)]},
            "properties": {"nome": nome, "op": g(r"Operatore\s+(.+?)\s+Titolo"),
                "min": g(r"Minerale\s+([A-Za-z]+)"), "titolo": g(r"Titolo minerario\s+(.+?)\s+Zona"),
                "anno": g(r"Anno costruzione\s+(\d{4})"), "dist": g(r"Distanza costa\s+([\d.,]+)")}})
    return {"type": "FeatureCollection", "features": feats}

def parse_istanze(path):
    """Istanze di nuovi titoli (aree) con tipo, data, superficie, richiedenti, ubicazione."""
    feats = []
    for pm in _placemarks(path):
        nome, desc = _nome_desc(pm)
        polys = []
        for el in pm.iter():
            if _localname(el) == "Polygon":
                for sub in el.iter():
                    if _localname(sub) == "outerBoundaryIs":
                        for s2 in sub.iter():
                            if _localname(s2) == "coordinates" and s2.text:
                                pp = _coords_to_polygon(s2.text)
                                if pp: polys.append(pp)
        if not polys:
            continue
        geom = polys[0] if len(polys) == 1 else MultiPolygon(polys)
        t = _clean_desc(desc)
        g = lambda pat: (re.search(pat, t).group(1).strip() if re.search(pat, t) else None)
        tipo = g(r"^(Istanza di (?:permesso di ricerca|concessione di coltivazione) in (?:terraferma|mare))")
        feats.append({"type": "Feature", "geometry": mapping(geom),
            "properties": {"nome": nome, "tipo": tipo,
                "data": g(r"presentazione\s+(\d{2}/\d{2}/\d{4})"),
                "sup": g(r"Superficie\s+([\d.,]+)\s*km"),
                "rich": g(r"(?i)Richiedenti\s+(.+?)(?:\s+Pubblicazione|\s+Ubicazione|\s+COORDINATE|$)"),
                "loc": g(r"(?i)Ubicazione:?\s+([^(]+?)\s*\(")}})
    return {"type": "FeatureCollection", "features": feats}


# === PIPELINE =============================================================
def videpi_pdf_map():
    """Mappa nome pozzo -> URL della scheda PDF ViDEPI (da pozzi-pdf.kml: pozzi in titoli cessati)."""
    import urllib.request
    dest = os.path.join(RAW, "pozzi-pdf.kml")
    if not os.path.exists(dest):
        req = urllib.request.Request(VIDEPI_POZZI_KML, headers={"User-Agent": "trivellazioni-italia/1.0"})
        open(dest, "wb").write(urllib.request.urlopen(req, timeout=60).read())
    m = {}
    for pm in _placemarks(dest):
        nm = url = ""
        for c in pm.iter():
            if _localname(c) == "SimpleData" and c.get("name") == "NOME_LINEA": nm = (c.text or "").strip()
            if _localname(c) == "SimpleData" and c.get("name") == "URL": url = (c.text or "").strip()
        if nm and url:
            m[norm_titolo(nm)] = url
    return m

def main():
    scarica_kml_se_assente()

    # 1) Titoli: geometrie + decreti (KML) + attributi (CSV)
    poly = parse_kml()
    tit = pd.read_csv(TITOLI_CSV, sep=";", encoding="latin-1")
    tit["titolo"] = tit["titolo"].map(norm_titolo)
    tit["id"] = tit["id"].astype(str)
    poly["id"] = poly["id"].astype(str)

    # I NOMI NON SONO UNICI (es. "SAN MARCO" sono 2 concessioni diverse, Marche ed Emilia-Romagna):
    # si aggancia tutto per id; per i nomi che collidono la chiave porta la regione, così
    # pozzi, titolari e produzione restano separati.
    name_ids = tit.groupby("titolo")["id"].nunique()
    collisi = set(name_ids[name_ids > 1].index)
    def chiave(nome, zona):
        return f"{nome} \u2014 {str(zona).strip().title()}" if nome in collisi and pd.notna(zona) else nome
    tit["chiave"] = [chiave(n, z) for n, z in zip(tit["titolo"], tit["zona"])]

    cols = ["id", "titolo", "zona", "chiave", "tipo", "titolari", "conferimento", "vigenza"]
    poly = poly.drop(columns=["titolo"]).merge(tit.drop_duplicates("id")[cols], on="id", how="left")
    poly["titolo"] = poly["chiave"]      # chiave unica usata ovunque (join pozzi, title_info, geojson)
    print(f"Titoli (poligoni): {len(poly)}  | nomi risolti per id: {sorted(collisi) or 'nessuna collisione'}")

    # 2) Pozzi: conversione + decodifica
    pz = pd.read_csv(POZZI_CSV, sep=";", encoding="latin-1")
    # Il CSV ufficiale UNMIG (1895-2023) usa intestazioni leggermente diverse: le normalizziamo,
    # cosi la pipeline accetta sia questo sia vecchi export ViDEPI.
    pz.columns = pz.columns.str.strip()
    pz = pz.rename(
        columns={
            "Prof": "Profondità",
            "Provincia/ Zona": "Provincia/ Zona marina",
            "Nome titolo": "Nome titolo minerario",
            "Disp": "Disponibile",
        }
    )

    pz["lat"], pz["lon"] = geolocalizza(pz)

    # Pochi pozzi hanno coordinate ERRATE nel CSV ViDEPI ma corrette nell'elenco UNMIG di
    # coltivazione (dati 2021, gradi decimali WGS84): le recuperiamo a mano, citando la fonte.
    COORD_OVERRIDE = {
        "MONTE ENOC 005 OR C": (40.338069, 15.877158),
        "TEMPA ROSSA 001 DIR ST QUATER": (40.4206, 16.06593),
    }
    nomi = pz["Nome pozzo"].astype(str).str.strip()
    for nm, (la, lo) in COORD_OVERRIDE.items():
        pz.loc[nomi == nm, ["lat", "lon"]] = [la, lo]

    n_tot = len(pz)

    def motivo_scarto(r):
        la, lo = str(r["Latitudine"]).strip(), str(r["Longitudine"]).strip()
        la_dms, lo_dms = re.match(r"\d+°\d+'", la), re.match(r"\d+°\d+'", lo)
        if not la_dms and not lo_dms:
            return "coordinate assenti nella fonte"
        if (la_dms and dms_to_dd(la)[0] is None) or (lo_dms and dms_to_dd(lo)[0] is None):
            return "coordinate non valide alla fonte (minuti o secondi >= 60)"
        return "coordinate fuori area (probabile errore nella fonte)"

    scartati = pz[pz["lat"].isna() | pz["lon"].isna()]
    with open(os.path.join(OUT, "scartati.txt"), "w", encoding="utf-8") as fh:
        fh.write("# Pozzi esclusi dalla mappa: coordinate assenti o errate nella fonte ufficiale.\n")
        fh.write("# Verificato anche sull'elenco UNMIG aggiornato al 2023 e su quello di coltivazione:\n")
        fh.write("# per questi pozzi non risultano coordinate valide pubblicate.\n")
        fh.write("# nome\tmotivo\n")
        for _, r in scartati.iterrows():
            fh.write(f"{r['Nome pozzo']}\t{motivo_scarto(r)}\n")
    pz = pz.dropna(subset=["lat", "lon"])
    print(f"Pozzi: {n_tot} totali, {len(pz)} georeferenziati ({n_tot - len(pz)} scartati -> data/processed/scartati.txt)")
    wells = gpd.GeoDataFrame(pz, geometry=gpd.points_from_xy(pz["lon"], pz["lat"]), crs="EPSG:4326")

    # 3) Join spaziale pozzo -> titolo che lo contiene
    j = gpd.sjoin(wells, poly[["titolo", "geometry"]], predicate="within", how="left")
    j = j.drop(columns="index_right", errors="ignore")
    # un pozzo dentro più titoli sovrapposti genererebbe righe duplicate: ne teniamo una
    j = j[~j.index.duplicated(keep="first")]
    n_in = int(j["titolo"].notna().sum())
    print(f"Pozzi dentro un titolo vigente: {n_in} ({100*n_in//len(j)}%)")

    # 4) title_info (con titolari puliti) + GeoJSON pozzi/titoli
    title_info = {}
    for _, r in poly.iterrows():
        title_info[r["titolo"]] = {
            "tipo": r.get("tipo"), "titolari": r.get("titolari"),
            "conferimento": r.get("conferimento"), "vigenza": r.get("vigenza"),
            "provv": json.loads(r["provv"]) if isinstance(r["provv"], str) else [],
            "holders": estrai_titolari(r.get("titolari")),
        }

    try:
        pdfmap = videpi_pdf_map()
        print(f"  schede ViDEPI per pozzo disponibili: {len(pdfmap)}")
    except Exception as e:
        pdfmap = {}
        print("  ViDEPI pozzi-pdf non disponibile (offline?):", e)

    feats = []
    for _, r in j.iterrows():
        code = str(r["Esito"])
        anno = int(r["Anno"]) if pd.notna(r["Anno"]) else None
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(r["lon"], 5), round(r["lat"], 5)]},
            "properties": {
                "nome": r["Nome pozzo"], "anno": anno,
                "dec": (anno // 10 * 10) if anno is not None else None,
                "esito": ESITO.get(code, code), "ecls": classe_esito(code),
                "scopo": SCOPO.get(str(r["Scopo"]), str(r["Scopo"])),
                "prof": None if pd.isna(r["Profondità"]) else int(r["Profondità"]),
                "op": r["Operatore"], "prov": r["Provincia/ Zona marina"], "tm": r["Terra/ Mare"],
                "titolo": r["titolo"] if pd.notna(r["titolo"]) else None,
                "pdf": pdfmap.get(norm_titolo(str(r["Nome pozzo"]))),
            },
        })
    json.dump({"type": "FeatureCollection", "features": feats},
              open(os.path.join(OUT, "wells_it.json"), "w"), ensure_ascii=False)
    json.dump(title_info, open(os.path.join(OUT, "title_info_it.json"), "w"), ensure_ascii=False)

    poly2 = poly.copy()
    poly2["geometry"] = poly2["geometry"].simplify(0.002)  # alleggerisce il file
    poly2[["titolo", "tipo", "geometry"]].to_file(os.path.join(OUT, "titoli_it.geojson"), driver="GeoJSON")

    # 5) Produzione: serie annuale per minerale, per titolo
    p = pd.read_csv(PROD_CSV, sep=";", encoding="latin-1")
    p["Titolo"] = p["Titolo"].astype(str).map(norm_titolo)
    p["Totale"] = pd.to_numeric(p["Totale"], errors="coerce").fillna(0)
    p["Anno"] = pd.to_numeric(p["Anno"], errors="coerce")
    p = p.dropna(subset=["Anno"]).copy()
    p["Anno"] = p["Anno"].astype(int)
    # escludi l'ultimo anno se palesemente PARZIALE (anno in corso): meno della metà del precedente
    _ta = p.groupby("Anno")["Totale"].sum().sort_index()
    if len(_ta) >= 2 and _ta.iloc[-1] < 0.5 * _ta.iloc[-2]:
        p = p[p["Anno"] != int(_ta.index[-1])].copy()
    # 5a) Produzione NAZIONALE per minerale per anno (pannello "Andamento nazionale")
    nat = {}
    for (mn, yr), v in p.groupby(["Minerale", "Anno"])["Totale"].sum().items():
        if v > 0:
            nat.setdefault(mn, []).append([int(yr), float(v)])
    for mn in nat:
        nat[mn].sort()
    # 5a-bis) Produzione storica nazionale 1980-2003 (UNMIG): estende a ritroso Gas e Olio.
    #   Unita della fonte: Gas in migliaia di Sm3, Olio in tonnellate -> *1000 (Sm3 e kg, coerenti
    #   col resto). Le righe con Anno=0 sono il cumulato pre-1980 e vanno escluse.
    hist_path = os.path.join(RAW, "produzione-storica-annuale.csv")
    if os.path.exists(hist_path):
        hl = open(hist_path, encoding="latin-1").read().splitlines()
        hi = next((i for i, l in enumerate(hl) if l.startswith("Minerale;")), None)
        hagg = {}
        if hi is not None:
            for line in hl[hi + 1 :]:
                f = line.split(";")
                if len(f) < 6:
                    continue
                mn, an, pv = f[0].strip(), f[4].strip(), f[5].strip()
                if not an.isdigit() or an == "0":
                    continue
                hagg[(mn, int(an))] = hagg.get((mn, int(an)), 0) + float(pv.replace(".", "") or 0)
        added = 0
        for mn in ("Gas", "Olio"):
            if mn not in nat:
                continue
            have = {y for y, _ in nat[mn]}
            for yr in range(1980, 2004):
                if yr not in have and (mn, yr) in hagg and hagg[(mn, yr)] > 0:
                    nat[mn].append([yr, hagg[(mn, yr)] * 1000])
                    added += 1
            nat[mn].sort()
        print(f"  + produzione storica 1980-2003: {added} punti annui (Gas/Olio)")
    json.dump(nat, open(os.path.join(OUT, "nat_prod.json"), "w"), ensure_ascii=False)
    prod = {}
    pmax = int(pd.to_numeric(p["Anno"], errors="coerce").max())   # ultimo anno nei dati
    recent = {pmax, pmax - 1}                                      # finestra "attivo": ultimi due anni
    # mappe nome -> chiave unica (per i nomi che collidono si sceglie con la Regione)
    chiave_unica = {r["titolo"]: r["chiave"] for _, r in tit.iterrows() if r["titolo"] not in collisi}
    chiave_regione = {(r["titolo"], str(r["zona"]).upper().strip()): r["chiave"]
                      for _, r in tit.iterrows() if r["titolo"] in collisi}

    def calcola(g):
        minerals = {}
        for mn, gm in g.groupby("Minerale"):
            ann = gm.groupby("Anno")["Totale"].sum()
            minerals[mn] = {int(y): float(v) for y, v in ann.items() if v > 0}
        if not minerals:
            return None
        dom = max(minerals, key=lambda m: sum(minerals[m].values()))
        series = sorted([[y, minerals[dom][y]] for y in minerals[dom]])
        smin = {m: sorted([[y, v] for y, v in minerals[m].items()]) for m in minerals}
        ly = max(int(y) for m in minerals for y in minerals[m])
        lyt = {m: minerals[m][ly] for m in minerals if ly in minerals[m] and minerals[m][ly] > 0}
        attivo = any(minerals[m].get(y, 0) > 0 for m in minerals for y in recent)
        return {"dom": dom, "series": series, "smin": smin, "ly": ly, "lyt": lyt, "attivo": attivo}

    for tit_name, g in p.groupby("Titolo"):
        if tit_name in collisi:                                    # nome ambiguo: separa per Regione
            for reg, gr in g.groupby(g["Regione"].astype(str).str.upper().str.strip()):
                key, d = chiave_regione.get((tit_name, reg)), calcola(gr)
                if key and d:
                    prod[key] = d
        else:
            d = calcola(g)
            if d:
                prod[chiave_unica.get(tit_name, tit_name)] = d
    json.dump(prod, open(os.path.join(OUT, "prod_by_title.json"), "w"), ensure_ascii=False)
    n_match = len(set(prod) & set(title_info))
    print(f"Produzione: {len(prod)} titoli, {n_match} agganciati ai vigenti, "
          f"{sum(1 for k in prod if k in title_info and prod[k]['attivo'])} attivi {pmax-1}-{pmax}")
    # 6) Strati extra dal MASE: piattaforme (punti) e istanze di nuovi titoli (aree)
    piatt = parse_piattaforme(_scarica_layer("piattaforme.kml"))
    istanze = parse_istanze(_scarica_layer("istanze-idrocarburi.kml"))
    json.dump(piatt, open(os.path.join(OUT, "piattaforme.geojson"), "w"), ensure_ascii=False)
    json.dump(istanze, open(os.path.join(OUT, "istanze.geojson"), "w"), ensure_ascii=False)
    print(f"Extra MASE: {len(piatt['features'])} piattaforme, {len(istanze['features'])} istanze")
    print("Fatto. File in data/processed/. Ora: python build_map.py")

if __name__ == "__main__":
    main()
