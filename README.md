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

# Testovací beh — len 1 strana z viacerých registrov
node isvd-registers.js --registry certified-institutions,accredited-programs --max-pages 1 --debug
```

Príklad výpisu pri testovacom behu:

```
=== Register certifikovaných vzdelávacích inštitúcií ===
URL: https://isvd.iedu.sk/ViewCertifiedEducationalInstitutionsRegistry
[debug] Processing page 1 of registry certified-institutions
[debug] Total 'Zobraziť viac' clicks: 0
[debug] Best table score: 11212
Page 1: extracted 10 rows, added 10 new.
[debug] Trying next page via selector: button:has-text('→')
Reached safety limit of 1 pages for certified-institutions.
Saved: ./output/register-certifikovanych-vzdelavacich-institucii.csv
Rows:  10

=== Register akreditovaných vzdelávacích programov ===
URL: https://isvd.iedu.sk/ViewAccreditedEducationalProgramsRegistry
[debug] Processing page 1 of registry accredited-programs
[debug] expandAllShowMore round=1, candidates=31
[debug] expandAllShowMore round=2, candidates=17
[debug] expandAllShowMore round=3, candidates=9
[debug] expandAllShowMore round=4, candidates=5
[debug] Total 'Zobraziť viac' clicks: 34
[debug] Best table score: 11010
Page 1: extracted 10 rows, added 10 new.
[debug] Trying next page via selector: button:has-text('→')
Reached safety limit of 1 pages for accredited-programs.
Saved: ./output/register-akreditovanych-vzdelavacich-programov.csv
Rows:  10

Done.
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

## Známe obmedzenia

**SPA navigačné linky (`Odkaz na vzdel. programy` v registri certifikovaných inštitúcií)**

Stĺpce `Odkaz na vzdel. programy - Akreditované URL` a `Odkaz na vzdel. programy - Neakreditované URL` obsahujú hodnotu `https://isvd.iedu.sk/Registers` namiesto konkrétnych URL filtrovaných pre danú inštitúciu. Tieto linky na stránke ISVD nepoužívajú štandardný `href` atribút — navigácia prebieha cez JavaScript `@click` handler bez zmeny `href`. Extrahovanie skutočného cieľa by vyžadovalo simuláciu kliknutia a zachytenie výslednej URL, čo je pre každý riadok príliš pomalé.
