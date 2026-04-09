#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { stringify } = require("csv-stringify/sync");

const REGISTRIES = [
  {
    slug: "certified-institutions",
    title: "Register certifikovaných vzdelávacích inštitúcií",
    url: "https://isvd.iedu.sk/ViewCertifiedEducationalInstitutionsRegistry",
    file: "register-certifikovanych-vzdelavacich-institucii.csv",
  },
  {
    slug: "accredited-programs",
    title: "Register akreditovaných vzdelávacích programov",
    url: "https://isvd.iedu.sk/ViewAccreditedEducationalProgramsRegistry",
    file: "register-akreditovanych-vzdelavacich-programov.csv",
  },
  {
    slug: "non-accredited-programs",
    title: "Register neakreditovaných vzdelávacích programov",
    url: "https://isvd.iedu.sk/ViewNonAccreditedProgramsRegistry",
    file: "register-neakreditovanych-vzdelavacich-programov.csv",
  },
  {
    slug: "authorised-institutions",
    title: "Register autorizovaných inštitúcií",
    url: "https://isvd.iedu.sk/ViewAuthorizedInstitutionsRegistry",
    file: "register-autorizovanych-institucii.csv",
  },
  {
    slug: "cross-sector-training-centers",
    title: "Register nadpodnikových vzdelávacích centier",
    url: "https://isvd.iedu.sk/ViewCrossSectorTrainingCentersRegistry",
    file: "register-nadpodnikovych-vzdelavacich-centier.csv",
  },
  {
    slug: "authorised-persons",
    title: "Register autorizovaných osôb",
    url: "https://isvd.iedu.sk/authorisedPersonsRegistry",
    file: "register-autorizovanych-osob.csv",
  },
  {
    slug: "national-guarantors",
    title: "Register národných garantov",
    url: "https://isvd.iedu.sk/ViewNationalGuarantorsRegistry",
    file: "register-narodnych-garantov.csv",
  },
  {
    slug: "microcertificate-institutions",
    title: "Register inštitúcií poskytujúcich mikroosvedčenia",
    url: "https://isvd.iedu.sk/ViewMicrocertificateInstitutionsRegistry",
    file: "register-mikroosvedceni.csv",
  },
  {
    slug: "career-counselors",
    title: "Register poskytovateľov kariérového poradenstva pre dospelých",
    url: "https://isvd.iedu.sk/CarierCounselorsRegistry",
    file: "register-karieroveho-poradenstva.csv",
  },
];

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeDiacritics(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugify(value) {
  return removeDiacritics(cleanText(value))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isGenericNavLabel(text) {
  return /^(navštíviť web|visit|zobraziť|detail|otvoriť|show|view)$/i.test(text.trim());
}

function isLinkTextSameAsHref(linkText, href) {
  try {
    const norm = new URL(href).href.replace(/\/$/, "");
    const t = linkText.replace(/\/$/, "");
    return t === norm || t === href.replace(/\/$/, "");
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const args = {
    help: false,
    list: false,
    all: false,
    registries: [],
    outputDir: path.resolve(process.cwd(), "output"),
    visible: false,
    delayMs: 250,
    timeoutMs: 60000,
    maxPagesPerRegistry: 1000,
    debug: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--help":
      case "-h":
        args.help = true;
        break;

      case "--list":
      case "-l":
        args.list = true;
        break;

      case "--all":
      case "-a":
        args.all = true;
        break;

      case "--registry":
      case "-r": {
        const value = argv[++i];
        if (!value) {
          throw new Error("Missing value for --registry");
        }
        args.registries.push(
          ...value
            .split(",")
            .map((s) => cleanText(s))
            .filter(Boolean)
        );
        break;
      }

      case "--output-dir":
      case "-o": {
        const value = argv[++i];
        if (!value) {
          throw new Error("Missing value for --output-dir");
        }
        args.outputDir = path.resolve(process.cwd(), value);
        break;
      }

      case "--visible":
        args.visible = true;
        break;

      case "--delay-ms": {
        const value = Number(argv[++i]);
        if (!Number.isFinite(value) || value < 0) {
          throw new Error("Invalid value for --delay-ms");
        }
        args.delayMs = value;
        break;
      }

      case "--timeout-ms": {
        const value = Number(argv[++i]);
        if (!Number.isFinite(value) || value <= 0) {
          throw new Error("Invalid value for --timeout-ms");
        }
        args.timeoutMs = value;
        break;
      }

      case "--max-pages": {
        const value = Number(argv[++i]);
        if (!Number.isFinite(value) || value <= 0) {
          throw new Error("Invalid value for --max-pages");
        }
        args.maxPagesPerRegistry = value;
        break;
      }

      case "--debug":
        args.debug = true;
        break;

      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
ISVD registers downloader

USAGE
  node isvd-registers.js --help
  node isvd-registers.js --list
  node isvd-registers.js --all
  node isvd-registers.js --registry <slug>
  node isvd-registers.js --registry <slug1,slug2,...>
  node isvd-registers.js --all --output-dir ./data

OPTIONS
  -h, --help            Show this help
  -l, --list            Show available registries
  -a, --all             Download all registries
  -r, --registry        Download one or more registries by slug or title fragment
  -o, --output-dir      Output directory (default: ./output)
      --visible         Run browser in visible mode
      --delay-ms N      Delay between UI actions in ms (default: 250)
      --timeout-ms N    Navigation timeout in ms (default: 60000)
      --max-pages N     Max pages per registry safety cap (default: 1000)
      --debug           Verbose debug logging

AVAILABLE REGISTRIES
${REGISTRIES.map((r) => `  - ${r.slug}  ->  ${r.title}`).join("\n")}
`);
}

function printRegistryList() {
  console.log("Available registries:\n");
  for (const r of REGISTRIES) {
    console.log(`${r.slug}`);
    console.log(`  Title: ${r.title}`);
    console.log(`  URL:   ${r.url}`);
    console.log(`  File:  ${r.file}`);
    console.log("");
  }
}

function resolveRegistries(args) {
  if (args.all) {
    return REGISTRIES;
  }

  if (!args.registries.length) {
    return [];
  }

  const result = [];

  for (const selector of args.registries) {
    const q = selector.toLowerCase();

    const matches = REGISTRIES.filter((r) => {
      const haystack = [
        r.slug.toLowerCase(),
        r.title.toLowerCase(),
        slugify(r.title),
        r.file.toLowerCase(),
        r.url.toLowerCase(),
      ];
      return haystack.some((x) => x.includes(q));
    });

    if (!matches.length) {
      throw new Error(`Registry not found for selector: ${selector}`);
    }

    for (const m of matches) {
      if (!result.find((x) => x.slug === m.slug)) {
        result.push(m);
      }
    }
  }

  return result;
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function sleep(ms) {
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function logDebug(args, ...parts) {
  if (args.debug) {
    console.log("[debug]", ...parts);
  }
}

async function dismissCommonUi(page, args) {
  const selectors = [
    "button:has-text('Súhlasím')",
    "button:has-text('Rozumiem')",
    "button:has-text('Accept')",
    "button:has-text('OK')",
    "button:has-text('Ok')",
    "a:has-text('Súhlasím')",
  ];

  for (const selector of selectors) {
    try {
      const loc = page.locator(selector).first();
      if (await loc.count()) {
        if (await loc.isVisible()) {
          logDebug(args, "Clicking common UI element:", selector);
          await loc.click({ timeout: 1500 }).catch(() => {});
          await page.waitForTimeout(500);
          break;
        }
      }
    } catch (_) {}
  }
}

async function readPageTitle(page) {
  const candidates = [
    "main h1",
    "main h2",
    "main h3",
    "h1",
    "h2",
    "h3",
    "h4",
  ];

  for (const selector of candidates) {
    try {
      const loc = page.locator(selector).first();
      if (await loc.count()) {
        const text = cleanText(await loc.textContent());
        if (text) {
          return text;
        }
      }
    } catch (_) {}
  }

  return cleanText(await page.title());
}

function makeUniqueHeaders(headers) {
  const out = [];
  const counts = new Map();

  for (let i = 0; i < headers.length; i++) {
    let h = cleanText(headers[i]) || `column_${i + 1}`;
    const count = counts.get(h) || 0;
    counts.set(h, count + 1);

    if (count > 0) {
      h = `${h}_${count + 1}`;
    }

    out.push(h);
  }

  return out;
}

async function getBestTable(page, args) {
  const tables = page.locator("table");
  const count = await tables.count().catch(() => 0);

  let best = null;
  let bestScore = -1;

  for (let i = 0; i < count; i++) {
    const table = tables.nth(i);

    try {
      if (!(await table.isVisible())) {
        continue;
      }

      const rowCount = await table.locator("tbody tr").count().catch(() => 0);
      const tdCount = await table.locator("td").count().catch(() => 0);
      const thCount = await table.locator("th").count().catch(() => 0);

      const score = rowCount * 1000 + tdCount * 10 + thCount;
      if (score > bestScore) {
        best = table;
        bestScore = score;
      }
    } catch (_) {}
  }

  logDebug(args, "Best table score:", bestScore);
  return best;
}

async function expandAllShowMore(page, args, options = {}) {
  const maxRounds = Number(options.maxRounds || 20);
  const waitAfterClickMs = Number(options.waitAfterClickMs || 200);
  const waitAfterRoundMs = Number(options.waitAfterRoundMs || 600);

  let totalClicks = 0;

  for (let round = 1; round <= maxRounds; round++) {
    let clickedInRound = 0;

    const candidates = [
      page.getByText(/Zobraziť viac|Zobrazit viac/i),
      page.locator("a,button,span,div").filter({
        hasText: /Zobraziť viac|Zobrazit viac/i,
      }),
      page.locator("text=Zobraziť viac"),
      page.locator("text=Zobrazit viac"),
    ];

    const elements = [];
    const seen = new Set();

    for (const loc of candidates) {
      const count = await loc.count().catch(() => 0);

      for (let i = 0; i < count; i++) {
        const item = loc.nth(i);

        try {
          if (!(await item.isVisible())) {
            continue;
          }

          const text = cleanText(await item.textContent().catch(() => ""));
          const box = await item.boundingBox().catch(() => null);
          const key = `${text}|${box ? `${Math.round(box.x)}:${Math.round(box.y)}:${Math.round(box.width)}:${Math.round(box.height)}` : "nobox"}`;

          if (!seen.has(key)) {
            seen.add(key);
            elements.push(item);
          }
        } catch (_) {}
      }
    }

    if (!elements.length) {
      break;
    }

    logDebug(args, `expandAllShowMore round=${round}, candidates=${elements.length}`);

    for (const el of elements) {
      try {
        if (!(await el.isVisible())) {
          continue;
        }

        await el.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(50);

        try {
          await el.click({ timeout: 1500 });
        } catch {
          await el.evaluate((node) => node.click()).catch(() => {});
        }

        clickedInRound++;
        totalClicks++;
        await page.waitForTimeout(waitAfterClickMs);
      } catch (_) {}
    }

    if (!clickedInRound) {
      break;
    }

    await page.waitForTimeout(waitAfterRoundMs);
  }

  logDebug(args, "Total 'Zobraziť viac' clicks:", totalClicks);
  return totalClicks;
}

async function extractRowsFromCurrentPage(page, args) {
  const table = await getBestTable(page, args);

  if (!table) {
    return { foundTable: false, headers: [], rows: [] };
  }

  let headers = await table.locator("thead th").allTextContents().catch(() => []);
  headers = headers.map(cleanText).filter(Boolean);

  if (!headers.length) {
    headers = await table.locator("tr").first().locator("th").allTextContents().catch(() => []);
    headers = headers.map(cleanText).filter(Boolean);
  }

  let rowLocator = table.locator("tbody tr");
  let rowCount = await rowLocator.count().catch(() => 0);

  if (!rowCount) {
    rowLocator = table.locator("tr");
    rowCount = await rowLocator.count().catch(() => 0);
  }

  const rows = [];
  const linkHeaders = new Set();
  const uniqueHeaders = headers.length ? makeUniqueHeaders(headers) : null;

  for (let i = 0; i < rowCount; i++) {
    const tr = rowLocator.nth(i);

    const tdCount = await tr.locator("td").count().catch(() => 0);
    if (!tdCount) {
      continue;
    }

    const cellData = await tr.locator("td").evaluateAll((tds) => {
      // Získaj Vue router raz pre všetky bunky (SPA linky nemajú params v href)
      let router = null;
      try {
        router = document.querySelector("[data-v-app]")?.__vue_app__?.config?.globalProperties?.$router;
      } catch (_) {}

      const resolveVueLink = (a) => {
        try {
          const to = a.__vueParentComponent?.props?.to;
          if (!to || !router) return null;
          const resolved = router.resolve(to);
          if (!resolved?.href) return null;
          return new URL(resolved.href, window.location.origin).href;
        } catch (_) { return null; }
      };

      return tds.map((td) => ({
        // Fix: odstrániť "Zobraziť viac/menej" z textu bunky (zostatok po expandovaní)
        text: (td.innerText || td.textContent || "")
          .replace(/\u00A0/g, " ")
          .replace(/\s*Zobraziť (viac|menej)\s*/gi, " ")
          .replace(/\s+/g, " ")
          .trim(),
        links: Array.from(td.querySelectorAll("a"))
          .map((a) => ({
            text: (a.textContent || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim(),
            // Fix: pre SPA linky (href = generická /Registers) použiť router.resolve
            href: resolveVueLink(a) || a.href || "",
          }))
          .filter((l) => l.href),
      }));
    }).catch(() => []);

    const row = {};
    const finalHeaders =
      cellData.length ? (uniqueHeaders || cellData.map((_, idx) => `column_${idx + 1}`)) : [];

    for (let c = 0; c < cellData.length; c++) {
      const { text, links } = cellData[c];
      const header = finalHeaders[c] || `column_${c + 1}`;

      if (links.length === 0) {
        row[header] = cleanText(text);
        continue;
      }

      if (links.length === 1) {
        const { text: lt, href } = links[0];
        if (isGenericNavLabel(lt)) {
          // generický popis (Navštíviť web) → použiť href priamo ako hodnotu bunky
          row[header] = href;
        } else if (isLinkTextSameAsHref(lt, href)) {
          // text linku je samotná URL → bunka už má správnu hodnotu, extra stĺpec nepotrebný
          row[header] = cleanText(text);
        } else {
          // zmysluplný link text → bunka = text, URL stĺpec pomenovaný podľa hlavičky
          row[header] = cleanText(text);
          const urlCol = `${header} URL`;
          row[urlCol] = href;
          linkHeaders.add(urlCol);
        }
        continue;
      }

      // Viac linkov → bunka = text, stĺpce "[hlavička] - [text linku] URL"
      row[header] = cleanText(text);
      for (const { text: lt, href } of links) {
        const urlCol = lt ? `${header} - ${lt} URL` : `${header} URL`;
        row[urlCol] = href;
        linkHeaders.add(urlCol);
      }
    }

    const cellValues = Object.values(row).map((v) => cleanText(v)).filter((v) => v !== "");
    if (!cellValues.length) continue;
    // Preskočiť placeholder riadky prázdnych registrov ("Žiadne vzdelávacie centrá", ...)
    if (cellValues.length === 1 && /^žiadne /i.test(cellValues[0])) continue;
    rows.push(row);
  }

  const allHeaders = [
    ...(uniqueHeaders || []),
    ...Array.from(linkHeaders),
  ];

  return {
    foundTable: true,
    headers: makeUniqueHeaders(allHeaders),
    rows,
  };
}

function fingerprintRow(row) {
  const keys = Object.keys(row).sort();
  const normalized = {};
  for (const k of keys) {
    normalized[k] = row[k];
  }
  return JSON.stringify(normalized);
}

async function tryClickNextByArrow(page, args) {
  const selectors = [
    "a[rel='next']",
    "a:has-text('→')",
    "li a:has-text('→')",
    "button:has-text('→')",
    "a[aria-label*='Next']",
    "button[aria-label*='Next']",
  ];

  for (const selector of selectors) {
    try {
      const loc = page.locator(selector).first();
      if (!(await loc.count())) {
        continue;
      }
      if (!(await loc.isVisible())) {
        continue;
      }

      const disabled = await loc.evaluate((el) => {
        const cls = String(el.className || "").toLowerCase();
        const aria = String(el.getAttribute("aria-disabled") || "").toLowerCase();
        return el.hasAttribute("disabled") || aria === "true" || cls.includes("disabled");
      }).catch(() => false);

      if (disabled) {
        continue;
      }

      logDebug(args, "Trying next page via selector:", selector);

      const before = await page.locator("body").innerText().catch(() => "");
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await Promise.allSettled([
        page.waitForLoadState("networkidle", { timeout: 10000 }),
        loc.click({ timeout: 3000 }),
      ]);
      await page.waitForTimeout(1000);
      const after = await page.locator("body").innerText().catch(() => "");

      if (before !== after) {
        return true;
      }
    } catch (_) {}
  }

  return false;
}

async function tryClickNextByPageNumber(page, currentPageNumber, args) {
  const nextPage = currentPageNumber + 1;
  const patterns = [
    `a:has-text('${nextPage}')`,
    `button:has-text('${nextPage}')`,
  ];

  for (const selector of patterns) {
    try {
      const all = page.locator(selector);
      const count = await all.count().catch(() => 0);

      for (let i = 0; i < count; i++) {
        const loc = all.nth(i);

        if (!(await loc.isVisible().catch(() => false))) {
          continue;
        }

        const text = cleanText(await loc.textContent().catch(() => ""));
        if (text !== String(nextPage)) {
          continue;
        }

        logDebug(args, "Trying next page by page number:", nextPage);

        const before = await page.locator("body").innerText().catch(() => "");
        await loc.scrollIntoViewIfNeeded().catch(() => {});
        await Promise.allSettled([
          page.waitForLoadState("networkidle", { timeout: 10000 }),
          loc.click({ timeout: 3000 }),
        ]);
        await page.waitForTimeout(1000);
        const after = await page.locator("body").innerText().catch(() => "");

        if (before !== after) {
          return true;
        }
      }
    } catch (_) {}
  }

  return false;
}

async function goToNextPage(page, currentPageNumber, args) {
  const movedByArrow = await tryClickNextByArrow(page, args);
  if (movedByArrow) {
    return true;
  }

  const movedByNumber = await tryClickNextByPageNumber(page, currentPageNumber, args);
  if (movedByNumber) {
    return true;
  }

  return false;
}

async function scrapeRegistry(page, registry, args) {
  console.log(`\n=== ${registry.title} ===`);
  console.log(`URL: ${registry.url}`);

  await page.goto(registry.url, {
    waitUntil: "domcontentloaded",
    timeout: args.timeoutMs,
  });

  await page.waitForLoadState("networkidle").catch(() => {});
  await dismissCommonUi(page, args);
  await sleep(args.delayMs);

  const title = await readPageTitle(page);
  const allRows = [];
  const seenRows = new Set();
  const seenPageSignatures = new Set();
  let mergedHeaders = [];
  let pageNumber = 1;

  while (pageNumber <= args.maxPagesPerRegistry) {
    logDebug(args, `Processing page ${pageNumber} of registry ${registry.slug}`);

    await expandAllShowMore(page, args, {
      maxRounds: 20,
      waitAfterClickMs: Math.max(150, args.delayMs),
      waitAfterRoundMs: Math.max(500, args.delayMs),
    });

    const bodySignature = cleanText(
      await page.locator("body").innerText().catch(() => "")
    ).slice(0, 4000);

    if (seenPageSignatures.has(bodySignature)) {
      console.log(`Detected repeated content on page ${pageNumber}, stopping.`);
      break;
    }
    seenPageSignatures.add(bodySignature);

    const extracted = await extractRowsFromCurrentPage(page, args);

    if (!extracted.foundTable) {
      console.log("No table found.");
      break;
    }

    for (const h of extracted.headers) {
      if (!mergedHeaders.includes(h)) {
        mergedHeaders.push(h);
      }
    }

    let added = 0;
    for (const row of extracted.rows) {
      const fp = fingerprintRow(row);
      if (!seenRows.has(fp)) {
        seenRows.add(fp);
        allRows.push(row);
        added++;
      }
    }

    console.log(`Page ${pageNumber}: extracted ${extracted.rows.length} rows, added ${added} new.`);

    const moved = await goToNextPage(page, pageNumber, args);
    if (!moved) {
      break;
    }

    pageNumber++;
    await sleep(args.delayMs);
  }

  if (pageNumber > args.maxPagesPerRegistry) {
    console.warn(`Reached safety limit of ${args.maxPagesPerRegistry} pages for ${registry.slug}.`);
  }

  if (!mergedHeaders.length && allRows.length) {
    mergedHeaders = Array.from(new Set(allRows.flatMap((r) => Object.keys(r))));
  }

  const normalizedRows = allRows.map((row) => {
    const out = {};
    for (const h of mergedHeaders) {
      out[h] = row[h] ?? "";
    }
    return out;
  });

  return {
    registry,
    title,
    headers: mergedHeaders,
    rows: normalizedRows,
  };
}

async function writeCsv(outputDir, result) {
  await ensureDir(outputDir);

  const filePath = path.join(outputDir, result.registry.file);

  const csv = stringify(result.rows, {
    header: true,
    columns: result.headers,
    quoted: true,
  });

  await fs.promises.writeFile(filePath, csv, "utf8");
  return filePath;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Argument error: ${err.message}\n`);
    printHelp();
    process.exit(1);
  }

  if (args.help) {
    printHelp();
    return;
  }

  if (args.list) {
    printRegistryList();
    return;
  }

  if (!args.all && !args.registries.length) {
    printHelp();
    process.exit(1);
  }

  const selected = resolveRegistries(args);
  await ensureDir(args.outputDir);

  const browser = await chromium.launch({
    headless: !args.visible,
  });

  const context = await browser.newContext({
    locale: "sk-SK",
    viewport: { width: 1800, height: 1400 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    for (const registry of selected) {
      const result = await scrapeRegistry(page, registry, args);
      const filePath = await writeCsv(args.outputDir, result);

      console.log(`Saved: ${filePath}`);
      console.log(`Rows:  ${result.rows.length}`);
    }

    console.log("\nDone.");
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("\nFatal error:");
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});