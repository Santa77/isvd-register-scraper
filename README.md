# isvd-register-scraper

Nástroj na automatické sťahovanie dát z verejných registrov ISVD (Informačný systém vzdelávania dospelých, https://isvd.iedu.sk/). Výstupom sú CSV súbory pripravené na ďalšie spracovanie.

## Požiadavky

- Node.js 18+
- `npm install` (nainštaluje Playwright a csv-stringify)
- Pri prvom spustení je potrebný Chromium browser: `npx playwright install chromium`

## Použitie

```bash
# Zoznam dostupných registrov
node isvd-registers.js --list

# Stiahnuť všetky registre
node isvd-registers.js --all

# Stiahnuť jeden alebo viac registrov
node isvd-registers.js --registry certified-institutions
node isvd-registers.js --registry certified-institutions,accredited-programs

# Vlastný výstupný priečinok (default: ./output)
node isvd-registers.js --all --output-dir ./data
```

### Ďalšie prepínače

| Prepínač | Default | Popis |
|---|---|---|
| `--visible` | — | Zobrazí okno prehliadača (vhodné na ladenie) |
| `--debug` | — | Verbose logovanie do konzoly |
| `--delay-ms N` | 250 | Pauza medzi UI akciami v ms |
| `--timeout-ms N` | 60000 | Timeout navigácie v ms |
| `--max-pages N` | 1000 | Max počet stránok na register |

## Dostupné registre

| Slug | Názov registra |
|---|---|
| `certified-institutions` | Register certifikovaných vzdelávacích inštitúcií |
| `accredited-programs` | Register akreditovaných vzdelávacích programov |
| `non-accredited-programs` | Register neakreditovaných vzdelávacích programov |
| `authorised-institutions` | Register autorizovaných inštitúcií |
| `cross-sector-training-centers` | Register nadpodnikových vzdelávacích centier |
| `authorised-persons` | Register autorizovaných osôb |
| `national-guarantors` | Register národných garantov |
| `microcertificate-institutions` | Register inštitúcií poskytujúcich mikroosvedčenia |
| `career-counselors` | Register poskytovateľov kariérového poradenstva pre dospelých |

Register je možné zadať aj ako časť názvu (bez diakritiky), URL alebo cestu k výstupnému súboru.

## Výstup

CSV súbory sa uložia do `./output/` (alebo do priečinka zadaného cez `--output-dir`). Každý register má vlastný súbor podľa slovenského názvu, napr. `register-certifikovanych-vzdelavacich-institucii.csv`. URL adresy z buniek tabuľky sa exportujú ako samostatné stĺpce s príponou ` URL`.
