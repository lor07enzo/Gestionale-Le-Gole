// expo export -p web genera sempre <html lang="en"> a prescindere dalla lingua reale dell'app
// (Italiano) quando web.output non è "static" — e passare a "static" per usare la
// personalizzazione ufficiale app/+html.tsx introduce un regresso: il <title> della scheda
// sparisce (richiede react-helmet/expo-router/head per-rotta, non ereditato più da app.json come
// nella modalità SPA di default). Più semplice correggere l'HTML esportato dopo il fatto.
//
// Un lang errato è quanto basta perché Google Traduttore (e strumenti simili) rilevino la pagina
// come inglese e traducano/storpino singole parole italiane come se fossero inglesi — riscontrato
// dall'utente su mobile. Corretto lang="it" + <meta name="google" content="notranslate">
// (raccomandazione ufficiale Google per escludere una pagina dalla traduzione automatica) come
// doppia protezione, non solo una delle due.
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const before = html;
html = html.replace('<html lang="en">', '<html lang="it">');
html = html.replace('<head>', '<head>\n    <meta name="google" content="notranslate">');

if (html === before) {
  throw new Error(
    'fix-html-lang: nessuna sostituzione applicata — la struttura di dist/index.html generata da expo export è cambiata, aggiornare questo script.'
  );
}

fs.writeFileSync(indexPath, html);
console.log('dist/index.html: lang="it" + meta notranslate applicati.');
