#!/usr/bin/env node
// Gera assets/og/*.png (1200x627) a partir de assets/og/src/*.svg.
// Os PNGs sao o og:image das landings; os SVGs sao a fonte da verdade.
// Ao editar um SVG, rode `node scripts/render-og.cjs` e commite os dois formatos.
// Requer @resvg/resvg-js (instale com: npm install --no-save @resvg/resvg-js).
// Mesmo renderer do vscode-utplsql (scripts/gen-social-preview.cjs).
'use strict';

const fs = require('node:fs');
const path = require('node:path');

let Resvg;
try {
  ({ Resvg } = require('@resvg/resvg-js'));
} catch {
  console.error('Falta @resvg/resvg-js. Rode: npm install --no-save @resvg/resvg-js');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'assets', 'og', 'src');
const outDir = path.join(root, 'assets', 'og');

let count = 0;
for (const entry of fs.readdirSync(srcDir)) {
  if (!entry.endsWith('.svg')) continue;
  const name = entry.slice(0, -'.svg'.length);
  const svg = fs.readFileSync(path.join(srcDir, entry));
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { loadSystemFonts: true },
  });
  const png = resvg.render().asPng();
  fs.writeFileSync(path.join(outDir, `${name}.png`), png);
  console.log(`${name}.png:`, png.length, 'bytes');
  count++;
}

console.log(`${count} card(s) gerado(s) em assets/og/`);
