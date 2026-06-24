# La memoria delle trivellazioni

**Un secolo di pozzi e titoli di idrocarburi in Italia, su una mappa navigabile.**
Dati pubblici, codice riproducibile, nessun numero scritto a mano. Né pro né contro: memoria e divulgazione.

🔗 **Mappa online:** https://gabrielebellavia.it/trivellazioni-italia/

---

## Cos'è

Una mappa interattiva che mette in un solo posto la storia industriale del sottosuolo italiano:

- **~7.264 pozzi** perforati in Italia dal **1895 al 2023** (elenco ufficiale **UNMIG**, *pozzi storici*), colorati per *esito alla perforazione* (gas, olio, indizi, non produttivo…);
- i **titoli minerari vigenti** (concessioni e permessi) con titolari, storia dei **decreti** (link ai PDF ufficiali) e **produzione** annuale **2004–2026**;
- due strati dal **MASE**: **139 piattaforme marine** e **28 istanze** di nuovi titoli — le richieste di nuove esplorazioni, attivabili dalla toolbar.

Filtri per esito, periodo di perforazione, titolare, "solo pozzi in un titolo vigente", "solo titoli che producono". Click su un punto → scheda del pozzo + il titolo che lo contiene + andamento della produzione.

## Perché

Il WebGIS ufficiale del MASE è completo e autorevole, ma fotografa **l'oggi**: i titoli vigenti. Qui l'obiettivo è diverso e complementare:

- la **profondità storica** — un secolo di pozzi, inclusi i ~3.300 che ricadono sotto titoli ormai cessati, che le mappe ufficiali non mostrano più;
- un **racconto navigabile** anche per chi non è del settore: in Italia si estraggono combustibili fossili, e se ne stanno chiedendo di nuovi;
- essere **aperto e riproducibile**: ogni cifra deriva dai dati, ogni fonte è dichiarata.

Distinzione importante: il **colore di un punto è l'esito storico del pozzo** (cosa trovò alla perforazione), *non* la produzione attuale del titolo. Una concessione che produce oggi può contenere pozzi secchi (grigi): è normale, non una contraddizione.

## Dati e fonti

| Strato | Fonte | Licenza / natura |
|---|---|---|
| Pozzi 1895–2023 | elenco **UNMIG** (*pozzi storici*, CSV) | dati pubblici |
| Titoli vigenti, piattaforme, istanze | **UNMIG/MASE** (KML) | CC BY 4.0 |
| Produzione mensile per titolo | **UNMIG/MASE** | dati pubblici |
| Mappa di base | **OpenStreetMap**, **CARTO** | © OSM, © CARTO |
| Libreria mappa | **MapLibre GL JS** | BSD |

Registro completo dei link e delle date in [`SOURCES.md`](SOURCES.md).

## Come è fatto (riproducibilità)

```
prepare_data.py   # dati grezzi (CSV/KML) → JSON puliti in data/processed/
build_map.py      # JSON + template src/ → index.html + app.js + style.css
```

Per rigenerare tutto da zero:

```bash
pip install -r requirements.txt
python prepare_data.py
python build_map.py
python -m http.server   # poi apri http://localhost:8000
```

Il sito è fatto di tre file generati nella root — `index.html`, `app.js` (la logica con dentro i dati), `style.css` — più `preview.png`. MapLibre arriva dalla CDN, non è incorporato. Le cifre nei testi (pozzi georeferenziati, anni, copertura…) sono **calcolate dai dati** in fase di build, non scritte a mano. I tre file (più `preview.png`) si pubblicano così come sono su GitHub Pages.

## Note e limiti (in chiaro)

- Le coordinate dei pozzi sono convertite dal **meridiano di Monte Mario** a WGS84. **58 pozzi** hanno coordinate assenti o errate nella fonte ufficiale (verificato anche sull'elenco UNMIG aggiornato al 2023 e su quello di coltivazione) e restano esclusi — **con il motivo a fianco** — in `data/processed/scartati.txt`. Due pozzi con coordinate errate nel CSV ufficiale UNMIG (**MONTE ENOC 005 OR C**, **TEMPA ROSSA 001 DIR ST QUATER**) sono stati recuperati dalle coordinate corrette dell'elenco UNMIG di coltivazione.
- I **perimetri dei titoli** sono indicativi (semplificati per alleggerire il file).
- L'aggancio pozzo↔titolo e titolo↔produzione avviene per **id univoco**, non per nome: i nomi non sono unici (es. due concessioni diverse chiamate "SAN MARCO").
- Le **istanze** non hanno un documento per singola domanda: il popup rimanda al registro UNMIG. I **titoli concessi**, invece, linkano i PDF dei decreti.

## Crediti e licenza

Interfaccia ispirata alle mappe di **PalermoHub** ([opendatasicilia.it](https://palermohub.opendatasicilia.it/) · repo [SiciliaHub/palermohub](https://github.com/SiciliaHub/palermohub)), progetto di **Open Data Sicilia** curato da @aborruso, @cirospat e @gbvitrano, di cui ho rielaborato il template con stile e layout propri.

- **Interfaccia / presentazione:** Creative Commons CC BY-SA 4.0 (derivata da PalermoHub).
- **Codice della pipeline** (gli script Python): MIT.
- **Dati:** dei rispettivi titolari — ViDEPI (pubblici), UNMIG/MASE (CC BY 4.0) — qui ripubblicati come elaborazioni e fatti derivati, con attribuzione.

Prototipo civico indipendente, senza fini commerciali.
