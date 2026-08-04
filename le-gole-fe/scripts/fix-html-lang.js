// expo export -p web genera sempre <html lang="en">, anche se l'app è in italiano — passare a
// web.output "static" per usare app/+html.tsx farebbe sparire il <title> della scheda (regresso),
// quindi si corregge l'HTML esportato dopo il fatto. Un lang errato basta a far tradurre/storpiare
// il sito da Google Traduttore: corretto con lang="it" + meta notranslate, come doppia protezione.
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
