# La memoria delle trivellazioni

**Un secolo di pozzi e titoli di idrocarburi in Italia, su una mappa navigabile.**
Dati pubblici, codice riproducibile. Né pro né contro: memoria e divulgazione.

🔗 [**Mappa online**](https://gabrielebellavia.it/trivellazioni-italia/)

---

## Cos'è

Una mappa interattiva che mette in un solo posto la storia industriale del sottosuolo italiano:

- **~7.245 pozzi** perforati in Italia dal **1895 al 2021** (archivio **ViDEPI**), colorati per *esito alla perforazione* (gas, olio, indizi, non produttivo…);
- i **titoli minerari vigenti** (concessioni e permessi) con titolari, storia dei **decreti** (link ai PDF ufficiali) e **produzione** annuale **2004-2026**;
- due strati dal **MASE**: **139 piattaforme marine** e **28 istanze** di nuovi titoli - le richieste di nuove esplorazioni, attivabili dalla toolbar.

Filtri per esito, periodo di perforazione, titolare, "solo pozzi in un titolo vigente", "solo titoli che producono". Click su un punto → scheda del pozzo + il titolo che lo contiene + andamento della produzione.

## Perché

Il WebGIS ufficiale del MASE è completo e autorevole, ma fotografa **l'oggi**: i titoli vigenti. Qui l'obiettivo è diverso e complementare:

- la **profondità storica** - un secolo di pozzi, inclusi i ~3.300 che ricadono sotto titoli ormai cessati, che le mappe ufficiali non mostrano più;
- un **racconto navigabile** anche per chi non è del settore: in Italia si estraggono combustibili fossili, e se ne stanno chiedendo di nuovi;
- essere **aperto e riproducibile**: ogni cifra deriva dai dati, ogni fonte è dichiarata.

Distinzione importante: il **colore di un punto è l'esito storico del pozzo** (cosa trovò alla perforazione), *non* la produzione attuale del titolo. Una concessione che produce oggi può contenere pozzi secchi (grigi): è normale, non una contraddizione.

## Dati e fonti

| Strato | Fonte | Licenza / natura |
|---|---|---|
| Pozzi 1895-2021 | Progetto **ViDEPI** (via UNMIG/MASE) | dati pubblici (titoli cessati) |
| Titoli vigenti, piattaforme, istanze | **UNMIG/MASE** (KML) | CC BY 4.0 |
| Produzione mensile per titolo | **UNMIG/MASE** | dati pubblici |
| Mappa di base | **OpenStreetMap**, **CARTO** | © OSM, © CARTO |
| Libreria mappa | **MapLibre GL JS** | BSD |

Registro completo dei link e delle date in [`SOURCES.md`](SOURCES.md).

## Come è fatto (riproducibilità)

```
prepare_data.py   # dati grezzi (CSV/KML) → JSON puliti in data/processed/
build_map.py      # JSON + template src/ → index.html (mappa autoconsistente)
serve.py          # server locale per provarla (vedi nota Chrome sotto)
```

`index.html` è un file unico (~3,6 MB) con dati e libreria incorporati: si pubblica così com'è su GitHub Pages. Le cifre nei testi (pozzi georeferenziati, anni, copertura…) sono **calcolate dai dati** in fase di build, non scritte a mano.

## Note e limiti (in chiaro)

- Le coordinate dei pozzi sono convertite dal **meridiano di Monte Mario** a WGS84; **60 pozzi** con coordinate non interpretabili sono esclusi (elenco in `data/processed/scartati.txt`).
- I **perimetri dei titoli** sono indicativi (semplificati per alleggerire il file).
- L'aggancio pozzo↔titolo e titolo↔produzione avviene per **id univoco**, non per nome: i nomi non sono unici (es. due concessioni diverse chiamate "SAN MARCO").
- Le **istanze** non hanno un documento per singola domanda: il popup rimanda al registro UNMIG. I **titoli concessi**, invece, linkano i PDF dei decreti.


## Crediti

Interfaccia ispirata ai lavori di **[@opendatasicilia](https://github.com/opendatasicilia) (PalermoHub / Open Data Sicilia)**, rielaborata con stile e layout propri.

I dati restano dei rispettivi titolari, licenza CC BY 4.0. Questo progetto ne ripubblica elaborazioni e fatti derivati, con attribuzione.

Prototipo civico indipendente. Nessun fine commerciale.
