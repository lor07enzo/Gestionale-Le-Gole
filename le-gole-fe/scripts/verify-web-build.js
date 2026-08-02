#!/usr/bin/env node
// Smoke test eseguito dopo `expo export -p web`, prima di pubblicare (deploy-frontend.yml e
// `npm run deploy:web`): serve la cartella `dist/` appena esportata e apre le pagine chiave con
// un browser reale, verificando che nessuna sollevi un errore JS non gestito.
//
// Motivo (sezione 14 di CLAUDE.md): Metro non garantisce lo stesso ordine di impacchettamento dei
// moduli tra ambienti diversi (es. export locale su Windows vs export in CI su Linux) — quando
// quell'ordine è "sfortunato", il getter lazy di `FlatList` di React Native risolve a `undefined`
// e l'intera app va in crash con una pagina bianca. Il bug non è eliminato alla radice da questo
// script (resta un problema di non-determinismo di Metro), ma non può più raggiungere gli utenti
// senza che il deploy fallisca esplicitamente.
//
// Nota sui falsi positivi: contano solo i `pageerror` (eccezioni JS non gestite). Servendo `dist/`
// da localhost, le chiamate API verso il backend reale falliscono per CORS (CORS_ALLOWED_ORIGINS
// è ristretto a https://legole.expo.app e ai domini di preview, sezione 14) — sono normali
// fallimenti di rete loggati come errori di console, non eccezioni non gestite, e non vanno confusi
// con il crash che questo script deve rilevare.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PORT = process.env.VERIFY_WEB_BUILD_PORT || 5057;
const BASE_URL = `http://localhost:${PORT}`;
// Un campione delle pagine più significative dell'app, non l'intero sitemap: la home (nessuna
// chiamata API, il caso più "nudo"), l'Area Cliente e l'elenco piscine (self-service pubblico,
// sezione 7), il login staff (prima pagina dietro cui vive tutta la mappa piscina).
const PAGES_TO_CHECK = ['/', '/cliente', '/cliente/piscina', '/login'];
const NAVIGATION_TIMEOUT_MS = 20000;
const SETTLE_DELAY_MS = 1000;
const SERVER_READY_TIMEOUT_MS = 30000;

function waitForServerReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Il server statico non ha risposto entro ${timeoutMs}ms su ${url}.`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`Cartella "dist/" non trovata in ${PROJECT_ROOT}. Esegui prima "expo export -p web".`);
    process.exit(1);
  }

  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    console.error(
      'Il pacchetto "playwright" non è installato. Esegui "npm install" e poi "npx playwright install chromium".'
    );
    process.exit(1);
  }

  // `serve` (devDependency) servito come processo figlio, non tramite un'API programmatica: stessa
  // identica modalità "single-page" (fallback su index.html per ogni rotta client-side) già usata
  // nella verifica manuale, senza reimplementare la logica di rewrite di un server statico SPA.
  // Invocato tramite `node <entry.js>` (risolto dal campo "bin" del package, non da
  // node_modules/.bin/serve.cmd): su Windows uno script .cmd richiede `shell: true` per essere
  // eseguito da spawn, il che complica l'escaping degli argomenti — chiamare direttamente il file
  // JS con lo stesso eseguibile node in uso resta identico su Windows/Linux/macOS.
  const servePkgJsonPath = require.resolve('serve/package.json');
  const serveEntry = path.join(path.dirname(servePkgJsonPath), require(servePkgJsonPath).bin.serve);
  const server = spawn(process.execPath, [serveEntry, '-s', 'dist', '-l', String(PORT)], {
    cwd: PROJECT_ROOT,
    stdio: 'ignore',
  });

  let exitCode = 0;
  try {
    await waitForServerReady(BASE_URL, SERVER_READY_TIMEOUT_MS);

    const browser = await playwright.chromium.launch();
    try {
      for (const pagePath of PAGES_TO_CHECK) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (err) => errors.push(String(err)));
        try {
          await page.goto(BASE_URL + pagePath, {
            waitUntil: 'networkidle',
            timeout: NAVIGATION_TIMEOUT_MS,
          });
          await page.waitForTimeout(SETTLE_DELAY_MS);
        } catch (e) {
          errors.push(`navigazione fallita: ${e.message}`);
        }
        await page.close();

        if (errors.length > 0) {
          exitCode = 1;
          console.error(`[FAIL] ${pagePath}`);
          errors.forEach((e) => console.error(`  ${e}`));
        } else {
          console.log(`[OK] ${pagePath}`);
        }
      }
    } finally {
      await browser.close();
    }
  } catch (e) {
    exitCode = 1;
    console.error(e.message);
  } finally {
    server.kill();
  }

  if (exitCode !== 0) {
    console.error('\nBuild web non valida: interrotto prima del deploy.');
  } else {
    console.log('\nBuild web verificata, nessun errore JS nelle pagine controllate.');
  }
  process.exit(exitCode);
}

main();
