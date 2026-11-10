#!/usr/bin/env node
/**
 * Structural checks for the portfolio hub in thepaneb.github.io.
 *
 * No dependencies: the site is plain HTML + CSS, deployed by GitHub Pages
 * (legacy branch build from main). Run with `node scripts/check-site.cjs`.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://thepaneb.github.io';
const INDEXNOW_KEY = 'ba3b4edc519041308f1dc227c70163f1';
const SKIP_DIRS = new Set(['.git', '.github', 'assets', 'scripts', 'node_modules']);
const EXTERNAL_PATHS = new Set(['/vscode-utplsql/']);
const today = new Date().toISOString().slice(0, 10);

const errors = [];
const fail = (message) => errors.push(message);
const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(ROOT, file));

function walkHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name.endsWith('.html') && !/^google[0-9a-f]+\.html$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function metaContent(html, attr, value) {
  const patterns = [
    new RegExp(`<meta\\s+[^>]*${attr}="${value}"[^>]*content="([^"]+)"`, 'i'),
    new RegExp(`<meta\\s+[^>]*content="([^"]+)"[^>]*${attr}="${value}"`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function localLinks(html) {
  const links = [];
  for (const match of html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
    const raw = match[1].trim();
    if (/^(https?:|mailto:|tel:|#|data:|\/\/)/i.test(raw)) continue;
    const clean = raw.split('#')[0].split('?')[0];
    if (clean) links.push(clean);
  }
  return links;
}

function resolves(file) {
  if (!fs.existsSync(file)) return false;
  if (fs.statSync(file).isFile()) return true;
  return fs.existsSync(path.join(file, 'index.html'));
}

function resolveLink(page, link) {
  if (link.startsWith('/')) {
    if (EXTERNAL_PATHS.has(link)) return true;
    return resolves(path.join(ROOT, link));
  }
  return resolves(path.resolve(path.dirname(page), link));
}

function canonicalFor(file) {
  const fileRel = rel(file);
  if (fileRel === '404.html') return null;
  if (fileRel === 'index.html') return `${BASE}/`;
  if (fileRel.endsWith('/index.html')) {
    return `${BASE}/${fileRel.slice(0, -'index.html'.length)}`;
  }
  return `${BASE}/${fileRel}`;
}

function checkXmlDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${label}: lastmod inválido (${value})`);
    return;
  }
  if (value > today) fail(`${label}: lastmod no futuro (${value} > ${today})`);
}

// ── required files ────────────────────────────────────────────────────

for (const file of [
  '.nojekyll',
  'robots.txt',
  'sitemap.xml',
  'sitemap-hub.xml',
  'assets/styles.css',
  'assets/favicon.svg',
  `${INDEXNOW_KEY}.txt`,
]) {
  if (!exists(file)) fail(`arquivo obrigatório ausente: ${file}`);
}

const keyFile = `${INDEXNOW_KEY}.txt`;
if (exists(keyFile) && read(keyFile).trim() !== INDEXNOW_KEY) {
  fail(`${keyFile}: conteúdo da chave IndexNow inválido`);
}

// Google Search Console HTML verification files live at the host root and are
// not pages; they are excluded from the sitemap and from the page checks.
for (const file of fs.readdirSync(ROOT).filter((name) => /^google[0-9a-f]+\.html$/i.test(name))) {
  const text = read(file).trim();
  const expected = `google-site-verification: ${file}`;
  if (text !== expected) fail(`${file}: conteúdo de verificação do Google inválido`);
}

// ── pages ─────────────────────────────────────────────────────────────

const pages = walkHtml(ROOT);
const pageSet = new Set(pages.map((page) => canonicalFor(page)).filter(Boolean));
let canonicalCount = 0;

for (const page of pages) {
  const fileRel = rel(page);
  const html = fs.readFileSync(page, 'utf8');
  const is404 = fileRel === '404.html';
  const canonical = canonicalFor(page);

  if (/\{\{\s*[A-Z0-9_]+\s*\}\}/.test(html)) {
    fail(`${fileRel}: token {{...}} não resolvido`);
  }

  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!title || title[1].trim().length < 15) {
    fail(`${fileRel}: title ausente ou curto`);
  }

  if (!/<html\s+lang="en"/i.test(html)) fail(`${fileRel}: html lang != en`);
  if (!/<h1\b/i.test(html)) fail(`${fileRel}: sem h1`);

  if (is404) {
    if (!/name="robots"[^>]*content="noindex"/i.test(html) && !/content="noindex"[^>]*name="robots"/i.test(html)) {
      fail(`${fileRel}: 404 deve ter meta robots noindex`);
    }
    if (!html.includes('href="/"')) fail(`${fileRel}: 404 sem link para a home`);
  } else {
    canonicalCount++;
    if (/noindex/i.test(html)) fail(`${fileRel}: página indexável contém noindex`);

    if (!canonical) fail(`${fileRel}: canonical não calculado`);
    else if (!html.includes(`<link rel="canonical" href="${canonical}"`)) {
      fail(`${fileRel}: canonical ausente ou diferente de ${canonical}`);
    }

    const description = metaContent(html, 'name', 'description');
    if (!description || description.length < 40) {
      fail(`${fileRel}: meta description ausente ou curta`);
    }

    const requiredMeta = [
      ['property', 'og:type'],
      ['property', 'og:site_name'],
      ['property', 'og:title'],
      ['property', 'og:description'],
      ['property', 'og:url'],
      ['property', 'og:image'],
      ['property', 'og:image:width'],
      ['property', 'og:image:height'],
      ['property', 'og:image:alt'],
      ['name', 'twitter:card'],
      ['name', 'twitter:title'],
      ['name', 'twitter:description'],
      ['name', 'twitter:image'],
    ];
    for (const [attr, name] of requiredMeta) {
      if (!metaContent(html, attr, name)) fail(`${fileRel}: meta ${name} ausente`);
    }

    const ogUrl = metaContent(html, 'property', 'og:url');
    if (ogUrl && canonical && ogUrl !== canonical) {
      fail(`${fileRel}: og:url (${ogUrl}) != canonical (${canonical})`);
    }

    const ogImage = metaContent(html, 'property', 'og:image');
    if (ogImage) {
      if (!ogImage.startsWith(`${BASE}/`)) {
        fail(`${fileRel}: og:image não é absoluto no host (${ogImage})`);
      } else {
        const imagePath = ogImage.slice(BASE.length);
        if (!resolves(path.join(ROOT, imagePath))) {
          fail(`${fileRel}: og:image não existe (${imagePath})`);
        }
      }
    }

    const ld = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    if (ld.length === 0) fail(`${fileRel}: sem JSON-LD`);
    for (const script of ld) {
      try {
        const data = JSON.parse(script[1]);
        if (!data['@context'] || !data['@type']) {
          fail(`${fileRel}: JSON-LD sem @context/@type`);
        }
      } catch {
        fail(`${fileRel}: JSON-LD inválido`);
      }
    }
  }

  for (const link of localLinks(html)) {
    if (!resolveLink(page, link)) fail(`${fileRel}: link local quebrado "${link}"`);
  }
}

// ── robots.txt ────────────────────────────────────────────────────────

if (exists('robots.txt')) {
  const robots = read('robots.txt');
  if (!/^\s*Allow:\s*\/\s*$/im.test(robots)) fail('robots.txt: falta Allow: /');
  if (/^\s*Disallow:\s*\/\s*$/im.test(robots)) fail('robots.txt: Disallow: / bloqueia o site');
  if (!robots.includes(`Sitemap: ${BASE}/sitemap.xml`)) {
    fail('robots.txt: não aponta para o sitemap index');
  }
}

// ── sitemap index ─────────────────────────────────────────────────────

if (exists('sitemap.xml')) {
  const xml = read('sitemap.xml');
  if (!xml.includes('<sitemapindex')) fail('sitemap.xml: não é um sitemapindex');
  if (xml.includes('<urlset')) fail('sitemap.xml: não deve conter urlset');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  for (const required of [`${BASE}/sitemap-hub.xml`, `${BASE}/vscode-utplsql/sitemap.xml`]) {
    if (!locs.includes(required)) fail(`sitemap.xml: falta ${required}`);
  }
  for (const block of xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g)) {
    const loc = block[1].match(/<loc>([^<]+)<\/loc>/);
    if (!loc) fail('sitemap.xml: entrada sem loc');
    const lastmod = block[1].match(/<lastmod>([^<]+)<\/lastmod>/);
    if (lastmod) checkXmlDate(lastmod[1], 'sitemap.xml');
  }
}

// ── hub sitemap ───────────────────────────────────────────────────────

if (exists('sitemap-hub.xml')) {
  const xml = read('sitemap-hub.xml');
  if (!xml.includes('<urlset')) fail('sitemap-hub.xml: não é um urlset');
  if (xml.includes('<sitemapindex')) fail('sitemap-hub.xml: não deve conter sitemapindex');

  const locs = [];
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block[1].match(/<loc>([^<]+)<\/loc>/);
    if (!loc) {
      fail('sitemap-hub.xml: entrada sem loc');
      continue;
    }
    locs.push(loc[1]);
    if (!loc[1].startsWith(`${BASE}/`)) {
      fail(`sitemap-hub.xml: loc fora do host (${loc[1]})`);
    }
    const lastmod = block[1].match(/<lastmod>([^<]+)<\/lastmod>/);
    if (!lastmod) fail(`sitemap-hub.xml: ${loc[1]} sem lastmod`);
    else checkXmlDate(lastmod[1], `sitemap-hub.xml (${loc[1]})`);
    if (loc[1].includes('404') || loc[1].includes(INDEXNOW_KEY)) {
      fail(`sitemap-hub.xml: URL não indexável (${loc[1]})`);
    }
  }

  const unique = new Set(locs);
  if (unique.size !== locs.length) fail('sitemap-hub.xml: locs duplicados');
  for (const url of pageSet) if (!unique.has(url)) fail(`sitemap-hub.xml: falta ${url}`);
  for (const url of unique) if (!pageSet.has(url)) fail(`sitemap-hub.xml: URL sem página (${url})`);
}

// ── report ────────────────────────────────────────────────────────────

console.log('Site check — thepaneb.github.io');
console.log(`  ${pages.length} página(s) HTML · ${canonicalCount} indexável(is)`);

if (errors.length > 0) {
  for (const error of errors) console.error(`  FAIL: ${error}`);
  console.error(`\n${errors.length} problema(s).`);
  process.exit(1);
}

console.log('  ok: metadados, canonical, OG, JSON-LD e links locais');
console.log('  ok: robots.txt → sitemap.xml (índice)');
console.log('  ok: sitemap-hub.xml cobre exatamente as páginas indexáveis');
console.log('\nTodos os checks passaram.');
