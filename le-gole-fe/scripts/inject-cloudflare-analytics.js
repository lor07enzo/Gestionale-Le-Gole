// Inserisce lo snippet di Cloudflare Web Analytics in dist/index.html dopo l'export — stesso
// meccanismo già usato da fix-html-lang.js: `app/+html.tsx` (la via "ufficiale" di Expo Router per
// personalizzare il documento HTML radice) viene ignorato in modalità SPA (web.output di default,
// sezione 14 di CLAUDE.md), quindi ogni personalizzazione dell'HTML esportato passa da un
// post-processing di dist/index.html dopo `expo export -p web`, non da codice React.
// Token pubblico (visibile comunque nel sorgente della pagina distribuita a chiunque la visiti):
// nessun bisogno di leggerlo da una variabile d'ambiente/segreto, hardcoded come lo snippet stesso.
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const CLOUDFLARE_BEACON = `<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "daedb36b9d7a4abaa40c71bf70a8ec21"}'></script>`;

const before = html;
// Inserito prima di `</head>` (non dopo `<head>`, come fa invece fix-html-lang.js per il meta
// notranslate) — indipendente dall'ordine in cui i due script girano nella pipeline di deploy,
// dato che `</head>` resta invariato a prescindere da cosa è già stato inserito subito dopo
// l'apertura del tag.
html = html.replace('</head>', `    ${CLOUDFLARE_BEACON}\n  </head>`);

if (html === before) {
  throw new Error(
    'inject-cloudflare-analytics: nessuna sostituzione applicata — la struttura di dist/index.html generata da expo export è cambiata, aggiornare questo script.'
  );
}

fs.writeFileSync(indexPath, html);
console.log('dist/index.html: snippet Cloudflare Web Analytics inserito.');
