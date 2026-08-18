// expo export -p web genera sempre <html lang="en">: corretto dopo il fatto, altrimenti Google
// Traduttore rileva la pagina come inglese e storpia il testo italiano.
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
