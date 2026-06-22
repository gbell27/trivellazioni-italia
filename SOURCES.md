# Fonti — registro del progetto

Principio: ogni dato viene da una fonte pubblica dichiarata, ogni cifra nei testi è calcolata dai dati.

_Aggiornato: 2026-06-22._

## Dataset che alimentano la mappa

| cosa | fonte | licenza | file locale | URL |
|---|---|---|---|---|
| Pozzi perforati in Italia 1895-2021: coordinate, anno, esito, scopo, profondità, operatore<br>_Schede PDF per singolo pozzo su www.videpi.com/deposito/pozzi/profili/pdf/ (naming non sempre derivabile dal nome: non agganciate per evitare link rotti)._ | Progetto ViDEPI (via UNMIG/MASE) | dati pubblici (documentazione di titoli minerari cessati) | `data/raw/pozzi-storici.csv` | [https://unmig.mase.gov.it/ricerca-e-coltivazione-di-idrocarburi/dati-storici-progetto-videpi/](https://unmig.mase.gov.it/ricerca-e-coltivazione-di-idrocarburi/dati-storici-progetto-videpi/) |
| Geometrie dei titoli minerari vigenti (concessioni e permessi) + storia dei provvedimenti con link ai decreti | UNMIG/MASE | CC BY 4.0 | `data/raw/titoli-idrocarburi.kml` | [https://unmig.mase.gov.it/wp-content/uploads/dati/kml/titoli-idrocarburi.kml](https://unmig.mase.gov.it/wp-content/uploads/dati/kml/titoli-idrocarburi.kml) |
| Attributi dei titoli vigenti: id, tipo, titolari, conferimento, vigenza, zona | UNMIG/MASE | CC BY 4.0 | `data/raw/titoli-idrocarburi.csv` | [https://unmig.mase.gov.it/ricerca-e-coltivazione-di-idrocarburi/elenco-dei-titoli-minerari/](https://unmig.mase.gov.it/ricerca-e-coltivazione-di-idrocarburi/elenco-dei-titoli-minerari/) |
| PDF dei provvedimenti (conferimenti, proroghe, trasferimenti) per ciascun titolo<br>_Schema di URL ricavato dai link nel KML dei titoli; linkati nei popup dei titoli._ | UNMIG/MASE | documenti pubblici | — | https://unmig.mase.gov.it/wp-content/uploads/decreti/{id}_{AAAAMMGG}.pdf |
| Produzione mensile per titolo e per minerale, 2004-2026<br>_Sezione produzioni / databook UNMIG._ | UNMIG/MASE | dati pubblici | `data/raw/produzione-2026.csv` | [https://unmig.mase.gov.it/ricerca-e-coltivazione-di-idrocarburi/](https://unmig.mase.gov.it/ricerca-e-coltivazione-di-idrocarburi/) |
| Piattaforme marine (139): operatore, minerale, titolo, anno di costruzione, distanza dalla costa | UNMIG/MASE | CC BY 4.0 | `data/raw/piattaforme.kml` | [https://unmig.mase.gov.it/wp-content/uploads/dati/kml/piattaforme.kml](https://unmig.mase.gov.it/wp-content/uploads/dati/kml/piattaforme.kml) |
| Istanze per il conferimento di nuovi titoli (28): tipo, data, superficie, richiedenti, ubicazione<br>_Registro ufficiale: https://unmig.mase.gov.it/ricerca-e-coltivazione-di-idrocarburi/elenco-dei-titoli-minerari/_ | UNMIG/MASE | CC BY 4.0 | `data/raw/istanze-idrocarburi.kml` | [https://unmig.mase.gov.it/wp-content/uploads/dati/kml/istanze-idrocarburi.kml](https://unmig.mase.gov.it/wp-content/uploads/dati/kml/istanze-idrocarburi.kml) |

## Mappa di base e librerie

| componente | uso | licenza | URL |
|---|---|---|---|
| OpenStreetMap | dati della mappa di base | ODbL | [https://www.openstreetmap.org/copyright](https://www.openstreetmap.org/copyright) |
| CARTO basemaps | tiles dark / light | © CARTO | [https://carto.com/attributions](https://carto.com/attributions) |
| Esri World Imagery | vista satellitare | © Esri e fornitori | [https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) |
| MapLibre GL JS | libreria mappa (incorporata nel file) | BSD-3-Clause | [https://maplibre.org](https://maplibre.org) |

## Riferimenti e fonte ufficiale

| cosa | fonte | URL |
|---|---|---|
| WebGIS ufficiale del MASE (app ArcGIS): titoli, pozzi, piattaforme, istanze, stoccaggio<br>_Fonte autorevole per la situazione attuale; carica gli stessi 12 KML pubblici di unmig.mase.gov.it._ | UNMIG/MASE | [https://www.arcgis.com/apps/instant/basic/index.html?appid=7ca4e5edfc4349e48dc3529795988d89](https://www.arcgis.com/apps/instant/basic/index.html?appid=7ca4e5edfc4349e48dc3529795988d89) |
| Progetto ViDEPI — descrizione e finalità<br>_Contesto sull'archivio dei pozzi storici._ | Società Geologica Italiana | [https://www.socgeol.it/295/progetto-videpi.html](https://www.socgeol.it/295/progetto-videpi.html) |
| Da dove arriva il petrolio dell'UE (origini delle importazioni)<br>_Contesto 'stato del settore'; pagina da citare, non scaricabile automaticamente._ | Consiglio dell'Unione Europea | [https://www.consilium.europa.eu/it/infographics/where-does-the-eu-get-its-oil-from/](https://www.consilium.europa.eu/it/infographics/where-does-the-eu-get-its-oil-from/) |

---

**Attribuzione.** I dati restano dei rispettivi titolari, alle licenze sopra indicate; questo progetto ne ripubblica elaborazioni e fatti derivati, con attribuzione, senza fini commerciali. I titoli, le piattaforme e le istanze UNMIG/MASE sono CC BY 4.0; i pozzi ViDEPI sono documentazione pubblica di titoli cessati. Le date di accesso ai file scaricati automaticamente sono in `sources.json`.
