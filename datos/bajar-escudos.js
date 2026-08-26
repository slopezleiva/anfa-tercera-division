/*
 * bajar-escudos.js — descarga los escudos oficiales de los 42 clubes.
 *
 *   node datos/bajar-escudos.js
 *
 * Lee datos/escudos-urls.json y deja un PNG por club en img/escudos/.
 * Los archivos quedan en su tamano original; el respaldo incrusta despues
 * versiones reducidas.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const ORIGEN = path.join(__dirname, 'escudos-urls.json');
const DESTINO = path.join(__dirname, '..', 'img', 'escudos');

// nombre de club -> nombre de archivo seguro
function slug(nombre) {
  return nombre.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function bajar(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return bajar(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const trozos = [];
      res.on('data', (c) => trozos.push(c));
      res.on('end', () => resolve(Buffer.concat(trozos)));
    }).on('error', reject);
  });
}

(async () => {
  const { escudos } = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'));
  fs.mkdirSync(DESTINO, { recursive: true });

  let ok = 0, bytes = 0;
  const fallos = [];

  for (const [club, url] of Object.entries(escudos)) {
    try {
      const buf = await bajar(url);
      if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') {
        fallos.push(`${club}: no es un PNG`);
        continue;
      }
      fs.writeFileSync(path.join(DESTINO, slug(club) + '.png'), buf);
      ok++; bytes += buf.length;
    } catch (e) {
      fallos.push(`${club}: ${e.message}`);
    }
  }

  console.log(`Descargados ${ok}/${Object.keys(escudos).length} escudos en ${path.relative(process.cwd(), DESTINO)}`);
  if (ok) {
    console.log(`Peso total: ${(bytes / 1024 / 1024).toFixed(2)} MB — promedio ${(bytes / ok / 1024).toFixed(0)} KB`);
  }
  if (fallos.length) {
    console.log(`\nFallaron ${fallos.length}:`);
    fallos.forEach((f) => console.log('  ' + f));
  }
})();
