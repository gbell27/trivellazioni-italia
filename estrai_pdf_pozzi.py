#!/usr/bin/env python3
"""
Estrae in CSV gli elenchi pozzi UNMIG/MASE pubblicati in PDF.

Riconosce due formati (dal testo della prima pagina):
  - "storici"      : Elenco dei pozzi petroliferi perforati in Italia 1895-2023
                     https://unmig.mase.gov.it/wp-content/uploads/2024/07/pozzi-storici.pdf
  - "coltivazione" : Elenco dei pozzi per la coltivazione di idrocarburi (coordinate decimali)
                     https://unmig.mase.gov.it/wp-content/uploads/2018/08/pozzi-idrocarburi.pdf

COME FUNZIONA
  I PDF UNMIG hanno colonne allineate a sinistra a coordinate x FISSE (l'intestazione invece
  è centrata, quindi NON la si usa per i confini). Lo script assegna ogni parola alla colonna
  la cui x di inizio e' la massima <= x della parola. I confini qui sotto sono tarati sul layout
  attuale dei due PDF: se UNMIG cambia impaginazione, vanno ritoccati (sono gli unici numeri magici).

Uso:
    python3 estrai_pdf_pozzi.py INPUT.pdf [OUTPUT.csv] [--tipo storici|coltivazione]

Dipendenze: pdfplumber   (pip install pdfplumber)
"""
import sys, csv, re
import pdfplumber

# (x_inizio_colonna, nome_colonna_nel_CSV).  "_idname" = Codice/Id attaccato al Nome -> splittato dopo.
TEMPLATES = {
    "storici": [
        (40, "_idname"), (200, "Anno"), (233, "Scopo"), (250, "Esito"),
        (270, "Profondità"), (294, "Tipo titolo"), (310, "Nome titolo minerario"),
        (450, "Operatore"), (575, "Provincia/ Zona marina"), (615, "Terra/ Mare"),
        (635, "Latitudine"), (684, "Longitudine"), (745, "Profilo"),
        (770, "Disponibile"), (786, "Pdf"),
    ],
    "coltivazione": [
        (45, "_idname"), (165, "Min"), (178, "Ub"), (191, "Stato"), (205, "Campo"),
        (290, "Centrale"), (415, "Concessione"), (505, "Piattaforma"), (575, "Operatore"),
        (700, "Longitudine"), (740, "Latitudine"), (772, "Sez"), (785, "Pr"),
    ],
}
# nome reale della prima colonna (per il CSV) dopo lo split _idname
IDCOL = {"storici": "Codice", "coltivazione": "Id"}


def detect_tipo(pdf):
    head = (pdf.pages[0].extract_text() or "").upper()
    return "coltivazione" if "COLTIVAZIONE" in head else "storici"


def rows_of(page, ytol=3):
    """Raggruppa le parole in righe per coordinata verticale."""
    out = []
    for w in sorted(page.extract_words(use_text_flow=False), key=lambda w: (w["top"], w["x0"])):
        for r in out:
            if abs(r[0] - w["top"]) <= ytol:
                r[1].append(w); break
        else:
            out.append([w["top"], [w]])
    return [sorted(ws, key=lambda w: w["x0"]) for _, ws in out]


def extract(path, tipo=None):
    with pdfplumber.open(path) as pdf:
        tipo = tipo or detect_tipo(pdf)
        tpl = TEMPLATES[tipo]
        starts = [x for x, _ in tpl]
        names = [n for _, n in tpl]
        idcol = IDCOL[tipo]
        out_cols = [idcol, "Nome pozzo"] + [n for n in names if n != "_idname"]

        rows = []
        for p in pdf.pages:
            for ws in rows_of(p):
                # riga dati = inizia con cifre (Codice/Id, eventualmente attaccato al nome)
                if not re.match(r"^\d{1,6}[A-ZÀ-Ù]", ws[0]["text"]):
                    continue
                cells = {n: [] for n in names}
                for w in ws:
                    col = names[0]
                    for i, sx in enumerate(starts):
                        if w["x0"] >= sx:
                            col = names[i]
                    cells[col].append(w["text"])
                joined = {n: " ".join(v).strip() for n, v in cells.items()}
                # split Codice/Id <-> Nome pozzo dalla prima colonna
                m = re.match(r"^(\d{1,6})\s*(.*)$", joined["_idname"])
                if not m:
                    continue
                rid, name = m.group(1), m.group(2)
                row = {idcol: rid, "Nome pozzo": name}
                row.update({n: joined[n] for n in names if n not in ("_idname",)})
                # 'Nome pozzo' e' gia' in out_cols (proviene dallo split, non dal template)
                rows.append([row.get(c, "") for c in out_cols])
        return out_cols, rows, tipo


def main():
    pos = [a for a in sys.argv[1:] if not a.startswith("--")]
    tipo = sys.argv[sys.argv.index("--tipo") + 1] if "--tipo" in sys.argv else None
    if not pos:
        print(__doc__); raise SystemExit(2)
    inp = pos[0]
    out = pos[1] if len(pos) > 1 else re.sub(r"\.pdf$", "", inp, flags=re.I) + ".csv"
    cols, rows, tipo = extract(inp, tipo)
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(cols); w.writerows(rows)
    print(f"[{tipo}] {len(rows)} pozzi -> {out}")


if __name__ == "__main__":
    main()
