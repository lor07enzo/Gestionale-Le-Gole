#!/usr/bin/env node
// Smoke test eseguito dopo `expo export -p web`, prima di pubblicare: serve `dist/` e apre le
// pagine chiave con un browser reale, verificando che nessuna sollevi un errore JS non gestito.
// Contano solo i `pageerror`: le chiamate API falliscono per CORS servendo da localhost (rumore
// atteso, non il crash da rilevare).
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PORT = process.env.VERIFY_WEB_BUILD_PORT || 5057;
const BASE_URL = `http://localhost:${PORT}`;
// Campione delle pagine più significative, non l'intero sitemap.
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

  // Risolve il campo "bin" del pacchetto invece di node_modules/.bin/serve.cmd (su Windows
  // richiederebbe `shell: true`, più fragile).
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
          // 'load' (non 'networkidle'): il fallimento CORS delle chiamate API può impiegare
          // secondi a risolversi e far scadere il timeout per un motivo estraneo al crash che
          // interessa, che avviene comunque prima del `load` e resta catturato da `pageerror`.
          await page.goto(BASE_URL + pagePath, {
            waitUntil: 'load',
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
