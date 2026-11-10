# thepaneb.github.io

Portfolio hub for projects by **Gil Cleber Barboza**, published at
<https://thepaneb.github.io/> by GitHub Pages (legacy build from the `main`
branch, repository root).

The project site for **utPLSQL Test Runner** is deployed separately from the
[`vscode-utplsql`](https://github.com/thepaneb/vscode-utplsql) repository at
<https://thepaneb.github.io/vscode-utplsql/>. Do not create a
`vscode-utplsql/` directory here.

## Structure

```
index.html              hub
404.html                not found (noindex)
robots.txt              authoritative robots for the host
sitemap.xml             sitemap index
sitemap-hub.xml         hub + project landing URLs
.nojekyll               serve files as-is (no Jekyll)
isis-report-lib/        landing
isis-report/            landing
base-flask/             landing
base-robyn/             landing
assets/                 shared CSS, avatar, favicon and social cards
assets/og/src/          SVG sources for the 1200×627 cards
scripts/check-site.cjs  structural checks (no dependencies)
```

## Adding a project

1. Create `<slug>/index.html` at the repository root.
2. Copy the structure of an existing landing page: canonical, Open Graph,
   Twitter card, JSON-LD, breadcrumb and footer.
3. Add the card to `index.html` and the URL to `sitemap.xml` (as a new child
   sitemap, if the project has its own Pages site) or `sitemap-hub.xml`.
4. Add a 1200×627 card to `assets/og/<slug>.png` and its SVG source to
   `assets/og/src/`.
5. Run `node scripts/check-site.cjs`.

Slugs are kebab-case even when the repository uses underscores
(`isis_report` → `/isis-report/`, `base_flask` → `/base-flask/`).

## SEO rules

- `robots.txt` only works at the host root. The files under project subpaths
  (for example `/vscode-utplsql/robots.txt`) are ignored by Googlebot; the root
  file is the authoritative one.
- `sitemap.xml` is a **sitemap index**. It references `sitemap-hub.xml` for the
  pages in this repository and the project sitemap deployed by
  `vscode-utplsql`.
- Every indexable page must have a self-referencing canonical, a meta
  description, Open Graph/Twitter tags, JSON-LD and a local `og:image`.
- `404.html` must stay `noindex` and link back to `/`.
- Update `lastmod` when the page content changes; never set it to a future
  date.
- Submit `https://thepaneb.github.io/sitemap.xml` in Search Console/Bing
  Webmaster Tools under the **root** property, not the project subpath.

## Validate

```sh
node scripts/check-site.cjs
```

The script checks required files, titles/descriptions, canonical URLs, OG and
Twitter tags, JSON-LD, local links, `robots.txt`, the sitemap index and that
`sitemap-hub.xml` covers exactly the indexable pages.

## Deploy

Push to `main`. GitHub Pages builds the repository root (legacy branch build)
and publishes the static files. `.nojekyll` keeps the files untouched.

## Social cards

The PNGs in `assets/og/` are generated from the SVGs in `assets/og/src/` with
`@resvg/resvg-js` (the same renderer used by the utPLSQL LinkedIn cards). Keep
the SVG source next to the PNG so a card can be regenerated without guessing
the layout.
