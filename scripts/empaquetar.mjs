/* Convierte dist/ en un unico HTML autocontenido: entrega/FRACTURA.html */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const salida = 'entrega';
if (!existsSync(dist)) { console.error('Falta dist/. Ejecuta antes: npm run build'); process.exit(1); }
mkdirSync(salida, { recursive: true });

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const js  = readFileSync(join(dist, 'juego.js'), 'utf8');
const css = readFileSync(join(dist, 'juego.css'), 'utf8');

// Si el bundle contiene la secuencia </script> el navegador cortaria el
// bloque antes de tiempo: hay que escaparla.
const jsSeguro = js.replace(/<\/script/gi, '<\\/script');

// OJO: hay que pasar una FUNCION como reemplazo. Si se pasa un string,
// JavaScript interpreta $&, $' y $` dentro del bundle minificado como
// patrones de sustitucion y destroza el resultado.
html = html.replace(/<link[^>]+juego\.css[^>]*>/i, () => `<style>\n${css}\n</style>`);
// Vite pone el bundle en <head> como <script type="module">, que es
// DIFERIDO. Al inlinearlo sin type="module" pasa a ejecutarse de
// inmediato, antes de que exista el <body>, y todos los
// document.getElementById() devuelven null. Por eso lo sacamos de la
// cabecera y lo pegamos justo antes de </body>.
html = html.replace(/<script[^>]*src="[^"]*juego\.js"[^>]*><\/script>\s*/i, () => '');
html = html.replace(/<\/body>/i, () => `<script>\n${jsSeguro}\n</script>\n</body>`);

if (html.includes('juego.js') || html.includes('juego.css')) {
  console.error('No se pudo inlinear todo; revisa dist/index.html'); process.exit(1);
}

const mb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
// FRACTURA.html -> para subir a Classroom y abrir con doble clic
// index.html    -> mismo contenido, para GitHub Pages / itch.io
for (const nombre of ['FRACTURA.html', 'index.html']) {
  writeFileSync(join(salida, nombre), html);
  console.log(`${join(salida, nombre)}  —  ${mb} MB`);
}
