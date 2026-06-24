# Architettura del progetto

Guida per chi mette le mani nel codice (incluso il te stesso fra sei mesi).

## In una frase

Tutto il progetto è **una catena**:

```
data/raw/        dati ufficiali (CSV + KML)
    │
    │   python3 prepare_data.py      ← pulisce, converte, aggrega
    ▼
data/processed/  JSON pronti (pozzi, titoli, produzione, piattaforme, istanze)
    │
    │   python3 build_map.py         ← incolla i JSON nei template di src/
    ▼
index.html + app.js + style.css   il sito (più preview.png). MapLibre arriva dalla CDN.
```

Il sito online è fatto di quei file generati nella root. Tutto il resto in `src/` e gli script servono a generarli.

## Per rifare tutto: due comandi

```bash
pip install -r requirements.txt
python3 prepare_data.py     # scarica i KML mancanti, legge i CSV, scrive data/processed/
python3 build_map.py        # genera index.html + app.js + style.css nella root
python3 -m http.server      # poi apri http://localhost:8000
```

`prepare_data.py` **riscarica da solo i KML** dalle URL ufficiali se non li trova in
`data/raw/`. I **CSV** invece devono essere presenti in `data/raw/` (sono già nel repo,
sono dati pubblici: UNMIG in CC BY 4.0, ViDEPI documentazione pubblica).

## I file, in ordine di importanza

### Il cuore — ti basta questo per la mappa

| file | cosa fa |
|---|---|
| `prepare_data.py` | trasforma i grezzi in JSON. **È qui che si rimette mano ai dati.** Converte le coordinate dei pozzi (Monte Mario → WGS84), decodifica esiti/scopi, costruisce le geometrie dei titoli coi link ai decreti, aggrega la produzione per titolo e quella nazionale, prepara piattaforme e istanze. |
| `build_map.py` | genera `index.html` + `app.js` + `style.css`: legge i JSON, li **inietta** nella logica (vedi "il meccanismo dei placeholder"), calcola le cifre della copy dai dati (nessun numero a mano). |
| `src/shell.html` | il **guscio**: struttura HTML e `<head>` con Open Graph. Qui vivono toolbar, pannello filtri, modali. |
| `src/style.css` | lo **stile** (tutto il CSS). build_map lo copia in `style.css` nella root. |
| `src/app.js` | la **logica** della mappa: dati, filtri, popup, grafici, zoom, deep linking. È il file più denso (vedi la mappa delle funzioni). |
| MapLibre | la libreria della mappa, caricata dalla **CDN** (`unpkg.com/maplibre-gl@5.6.1`): non è più nel repo. |
| `data/raw/` | i dati ufficiali di partenza. |
| `data/processed/` | i JSON generati. **Non si modificano a mano**: li riscrive `prepare_data.py`. |

### Gli aiutanti — utili ma non essenziali

| file | cosa fa |
|---|---|
| `gen_preview.py` | genera `preview.png`, l'anteprima social: i pozzi reali che disegnano l'Italia. |
| `via_procedure.json` | mappatura curata istanza → procedura VIA (portale ambientale). Aggiungi una riga, poi `build_map.py`. |
| `SOURCES.md` | registro delle fonti (licenze, URL), mantenuto a mano. |
| `requirements.txt` | dipendenze Python. |


## Il meccanismo non ovvio: i placeholder

In `src/app.js` vedrai righe come `const WELLS=__WELLS__`. Non è un bug: `__WELLS__` è un
**segnaposto**. Quando lanci `build_map.py`, lo script lo sostituisce col contenuto del JSON
corrispondente (`wells_it.json`). Così durante lo sviluppo la logica resta separata dai dati,
e nel file finale i dati sono dentro.

Segnaposto dei dati: `__WELLS__ __TITLES__ __TI__ __PROD__ __PIATT__ __ISTANZE__ __VIA__ __NATPROD__`.
Più alcuni di copy calcolati dai dati: `__N_GEOREF__`, `__ANNO_MIN__`, ecc.

**Regola d'oro**: nei file generati (`index.html`, `app.js`) non deve restare nessun `__X__`.

## Dove mettere le mani

| voglio cambiare… | modifico… | poi lancio |
|---|---|---|
| i **dati** (pulizia, nuovi campi) | `prepare_data.py` | `prepare_data.py` + `build_map.py` |
| lo **stile** | `src/style.css` | `build_map.py` |
| **HTML o testi** | `src/shell.html` | `build_map.py` |
| il **comportamento** della mappa | `src/app.js` | `build_map.py` |
| una **fonte** | `SOURCES.md` (a mano) | — |
| un **link VIA** a un'istanza | `via_procedure.json` | `build_map.py` |

**Mai** modificare a mano i file generati nella root (`index.html`, `app.js`, `style.css`): si toccano i sorgenti in `src/` e si ri-builda, altrimenti le modifiche si perdono.

Prima di committare conviene validare: `app.js` deve passare `node --check`, e non devono restare segnaposto `__X__`.

## Mappa delle funzioni di `src/app.js`

Per scopo, così trovi subito dove guardare:

- **setup** — `ECOL`/`ELAB`/`EORD` (colori, etichette, ordine degli esiti), `map` (creazione mappa), `CARTO`/`tilesFor` (basemap).
- **geometria & popup** — `_ringArea`/`_geomArea`/`TAREA` (aree dei titoli, per scegliere l'area più piccola al click annidato), `popupAt`/`popup`, `resultBounds`/`zoomToCurrent`/`extGeom` (inquadratura).
- **grafici** — `buildLine` (costruttore SVG con scrubber interattivo), `spark` (mini-grafico nel popup), `wireCharts` (aggancia hover/touch), `barChart`/`decadeBars` (pozzi per decennio), `fmtVol` (formatta i volumi con unità automatica).
- **contenuto dei popup** — `wellHTML` (pozzo), `titleHTML`/`titleBlock`/`prodBlock` (titolo + produzione), `platHTML` (piattaforma), `istanzaHTML` (istanza + link VIA), `provHTML` (decreti).
- **filtri** — `buildEsiti`/`activeEsiti` (chip esiti, data-driven), `initDecades` (slider anni), `initTitolari`/`selectedHolders` (titolari), `apply` (applica tutti i filtri insieme).
- **stato condiviso** — `syncURL`/`restoreFromURL` (deep linking: i filtri finiscono nell'URL), `toggleLayers` (accendi/spegni livelli).
- **pannelli** — `modal` (guida), `trend`/`renderTrend` (Andamento nazionale).
