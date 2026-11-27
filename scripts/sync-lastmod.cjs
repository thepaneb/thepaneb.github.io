#!/usr/bin/env node
/**
 * Sincroniza o <lastmod> de sitemap-hub.xml com a data (UTC) do último commit
 * de cada página. Evita o passo manual do README e mantém o check-site verde.
 *
 * - Arquivos com mudanças não commitadas são ignorados (a data ainda não existe).
 * - Em clone raso não há histórico útil: o script não altera nada.
 *
 * Uso: node scripts/sync-lastmod.cjs
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://thepaneb.github.io';
const SITEMAP = path.join(ROOT, 'sitemap-hub.xml');
const git = (args) => execFileSync('git', args, {
  cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'],
}).toString().trim();

let shallow = false;
try {
  shallow = git(['rev-parse', '--is-shallow-repository']) === 'true';
} catch {
  console.warn('sem git: nada a sincronizar');
  process.exit(0);
}
if (shallow) {
  console.warn('clone raso: sem histórico para calcular lastmod (nada alterado)');
  process.exit(0);
}

const dirty = new Set();
for (const line of git(['status', '--porcelain']).split('\n')) {
  const file = line.slice(3).trim();
  if (file) dirty.add(file.split(' -> ').pop());
}

function utcDate(fileRel) {
  try {
    const out = git(['log', '-1', '--format=%ct', '--', fileRel]);
    if (!/^\d+$/.test(out)) return null;
    return new Date(Number(out) * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

const xml = fs.readFileSync(SITEMAP, 'utf8');
let changed = 0;
let skipped = 0;

const next = xml.replace(/<url>([\s\S]*?)<\/url>/g, (block) => {
  const loc = block.match(/<loc>([^<]+)<\/loc>/);
  if (!loc) return block;
  const fileRel = loc[1] === `${BASE}/`
    ? 'index.html'
    : `${loc[1].slice(BASE.length).replace(/^\//, '')}index.html`;
  if (!fs.existsSync(path.join(ROOT, fileRel))) return block;
  if (dirty.has(fileRel)) {
    console.warn(`pulado (mudanças não commitadas): ${fileRel}`);
    skipped++;
    return block;
  }
  const date = utcDate(fileRel);
  if (!date) return block;
  const updated = block.replace(/<lastmod>[^<]+<\/lastmod>/, `<lastmod>${date}</lastmod>`);
  if (updated !== block) {
    console.log(`${loc[1]} -> ${date}`);
    changed++;
  }
  return updated;
});

if (changed > 0) {
  fs.writeFileSync(SITEMAP, next);
  console.log(`sitemap-hub.xml: ${changed} lastmod atualizado(s)`);
} else {
  console.log('sitemap-hub.xml: lastmod já sincronizado');
}
if (skipped > 0) console.log(`${skipped} página(s) pulada(s)`);
