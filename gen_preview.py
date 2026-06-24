#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_preview.py - genera preview.png (1200x630) per Open Graph / Twitter Card.
L'anteprima E' la mappa: i pozzi reali plottati a formare l'Italia, col titolo sopra.
Uso: python gen_preview.py  (dopo prepare_data.py)
"""
import json, math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ECOL = {"gas": "#e6550d", "olio": "#31a354", "misto": "#756bb1",
        "indizi": "#3182bd", "sterile": "#8a8f98", "altro": "#c3c7cd"}

W = json.load(open("data/processed/wells_it.json"))["features"]
xs, ys, cs, anni = [], [], [], []
for f in W:
    lon, lat = f["geometry"]["coordinates"]
    xs.append(lon); ys.append(lat)
    cs.append(ECOL.get(f["properties"].get("ecls"), "#c3c7cd"))
    a = f["properties"].get("anno")
    if a: 
        anni.append(a)
amin, amax = min(anni), max(anni)
it = lambda n: f"{n:,}".replace(",", ".")

BG = "#1b2127"
fig = plt.figure(figsize=(12, 6.3), dpi=100)
fig.patch.set_facecolor(BG)
ax = fig.add_axes([0, 0, 1, 1]); ax.set_facecolor(BG); ax.axis("off")
# limiti scelti così che l'Italia (proporzioni corrette ~cos42°) stia a destra,
# lasciando lo spazio a sinistra per il testo
ax.set_xlim(-12, 20); ax.set_ylim(35.0, 47.4)
ax.scatter(xs, ys, s=3, c=cs, alpha=0.5, linewidths=0)

fig.text(0.05, 0.66, "La memoria\ndelle trivellazioni", color="#e8edf1",
         fontsize=44, fontweight="bold", va="center", linespacing=1.04)
fig.text(0.052, 0.40, "Un secolo di pozzi e titoli di idrocarburi in Italia",
         color="#aeb9c2", fontsize=17)
fig.text(0.052, 0.33, f"{it(len(W))} pozzi \u00b7 {amin}\u2013{amax} \u00b7 dati pubblici, mappa navigabile",
         color="#e0902f", fontsize=14.5, family="DejaVu Sans Mono")
fig.text(0.052, 0.08, "gabrielebellavia.it/trivellazioni-italia",
         color="#7f8b94", fontsize=12.5, family="DejaVu Sans Mono")

fig.savefig("preview.png", facecolor=BG)
print(f"preview.png generato: {it(len(W))} pozzi, {amin}-{amax}")
