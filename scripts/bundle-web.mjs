import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Fold the built renderer into one self-contained HTML file.
 *
 * The hosted target enforces a strict CSP that blocks every external host, so
 * nothing can be fetched at runtime -- no CDN, no separate stylesheet, no
 * split chunks. The page is also wrapped in its own document skeleton when
 * published, so this emits page *content* only: title, styles, mount point,
 * and the bundle. No doctype, html, head, or body tags.
 */

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist');
const assetsDir = path.join(distDir, 'assets');
const outFile = process.argv[2] ?? path.join(root, 'dist-web', 'property-flipper.html');

const assets = readdirSync(assetsDir);
const jsFiles = assets.filter((f) => f.endsWith('.js'));
const cssFiles = assets.filter((f) => f.endsWith('.css'));

if (jsFiles.length !== 1) {
  // Vite is configured without manual chunking, so more than one entry means
  // code splitting crept in and the inlining below would silently drop code.
  throw new Error(`Expected exactly one JS bundle, found ${jsFiles.length}: ${jsFiles.join(', ')}`);
}

const js = readFileSync(path.join(assetsDir, jsFiles[0]), 'utf8');
const css = cssFiles.map((f) => readFileSync(path.join(assetsDir, f), 'utf8')).join('\n');

// A literal </script> anywhere in the bundle would close the tag early.
const safeJs = js.replace(/<\/script/gi, '<\\/script');

const html = `<title>Property Flipper</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, html, 'utf8');

const kb = (n) => `${Math.round(n / 1024)} kB`;
console.log(`${outFile}`);
console.log(`  css ${kb(css.length)}  js ${kb(js.length)}  total ${kb(html.length)}`);
