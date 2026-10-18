# Limulus Dot Net Development Guide

## Build & Development Commands

- Fix linting issues: `npm run lint -- --fix`
- Compile/Lint/Test: `npm run verify`

## Testing Commands

- Run unit tests: `npm run test`
- Run AWS integration tests (runs code in AWS): `npm run test:integration`
- Run all tests: `npm run test:all`

## Infrastructure Commands

- Synthesize CDK template: `npm run cdkc`
- Diff infrastructure: `npx cdk diff`
- Test CloudFront function in CloudFront: `npm run test:integration`

## Code Style Guidelines

- TypeScript with strict typing
- Line width: 92 characters
- No semicolons
- Single quotes for strings
- ES5 trailing commas
- Prefer `??` over `||` when coalescing values

## Git Workflow

- Two remotes: `public` (public repo) and `private` (private repo)

## Project Structure

- `/www`: Site content and templates (11ty)
- `/www/_includes`: WebC components and layouts
- `/www/lib`: TypeScript source for client-side features
- `/11ty`: Custom Eleventy plugins
- `/infra`: AWS CDK infrastructure code
- `/infra/lib`: CDK stack definitions
- `/infra/functions`: CloudFront Functions (JS)
- `/infra/test`: Infrastructure tests
- `/types`: TypeScript type definitions

## Lemmon port (branch `lemmon-port`)

This branch ports the site to Lemmon beside Eleventy; both builds read the same `www/`.

- Prerequisite: the lemmon repo checked out at `../lemmon`, with `npm install` and
  `npm run rust:wasm` run there. Without it `npm ci` here still succeeds, leaving a
  dangling link, and the failure shows only at `npx lem`
- `npx lem build` writes `dist/lemmon` from `lemmon.config.ts`, `www/site.lem`, and the
  `.lem` layouts and components beside the WebC ones in `www/_includes/`. The index pages
  and 404 are page templates beside their `.webc` (`www/index.lem`, `www/404.lem`, each
  section's `index.lem`), typed `SitePage`; `site.pages` holds every `index.lem`, which is
  how `/` reads the sections' teasers. `npx lem check` runs the same and writes nothing,
  printing each diagnostic with the source it covers
- The client scripts are bundled by the shell's `esbuild()`, which `lemmon.config.ts` lists
  with 11ty/esbuild.ts's asset path and its `MAPBOX_PUBLIC_TOKEN`; the config loads the
  `.env` beside it, wherever `lem` starts, and a build without the token fails naming it.
  Its bundles are byte for byte Eleventy's, since `esbuild` and `esbuild-plugin-wasm` are
  pinned here exactly at the shell's versions (0.24.0, 1.1.0): move one only with the
  shell's. Unlike Eleventy, it writes no unhashed `index.js` stub beside a bundle. The
  layouts load each script where the WebC did — `/lib/common` in `base.lem`'s `head`,
  `/lib/video-on-demand` in `article-vod.lem`, the RUM loader and a page's `scripts` at the
  end of `page.lem`'s `body` — by `asset("/lib/x/index.js")`, the unhashed URL, which
  compiles to the hashed one. A post's `scripts:` is an `asset`, so the penumbra posts name
  theirs from `/` (`/penumbra/journal/<slug>/lib/index.js`), which Eleventy resolves to the
  same hashed URL
- `npm run lemmon:dev` is the authoring loop: `lem dev` builds `dist/lemmon`, serves it at
  http://127.0.0.1:8080/ with the COOP/COEP headers `lemmon.config.ts` lists, and on each
  change under `www/` rebuilds everything and reloads the open pages, while a `chokidar`
  watch reruns `npm run lemmon:css` when `www/_includes/css/*.css` changes. A change to
  `lemmon.config.ts` needs a restart, and like `lem build` it removes nothing from
  `dist/lemmon`, so a deleted post's page stays served until the next `npm run parity`
- `npm run build` still writes the Eleventy reference to `dist/www`. Its `clean` removes
  only `dist/www`, `dist/infra`, `coverage`, and `*.tsbuildinfo`, so the two builds run in
  either order; `lem build` itself removes nothing from `dist/lemmon`, so a stale page
  stays until `npm run parity` (which empties it before building) or a deletion by hand
- `npm run lemmon:photos` regenerates `www/_lemmon/photos.json` (photos keyed by alias)
  from `www/_data/photos.json`; `npm test` fails if the two have drifted
- Each page's CSS bundle holds the `lem-style` blocks of the components and layouts it
  ran, in Eleventy's order, then the global stylesheets. A block keeps that order by
  where it stands: a component's at the end of its body, after every call it makes, and
  a layout's between its `lem-let` capture and its call to the next layout. WebC bundles
  a component after those it depends on, wherever the page first uses it, so
  `www/tils/index.lem` captures its article list before the topics' chips above it,
  whose `dataChip` would otherwise collect ahead of the cards' `pho-picture` (its icons
  then number after the cards', which parity's `svg-desc-counter` allows). Under its
  `.fnName { … }` wrapper every selector starts with `&` (a spec checks it). The globals
  come from `www/_lemmon/site-styles.lem`, which is generated: `npm run lemmon:css`
  writes it from `www/_includes/css/*.css` as `siteStyles()`, one `lem-style` per
  stylesheet, which `base.lem` calls. Edit the CSS, not the `.lem`, and rerun it;
  `npm test` fails if the two have drifted
- `11ty/lemmon-calls.ts` turns a lem call on its own line in a post back into the lines it
  replaced — an `articlePhoto` into its WebC, a `demoWithFallback` into the penumbra
  demo's `<div>` around the `dynamic-content-fallback` Liquid include — for Eleventy (the
  `lemmonCalls` preprocessor) and for the revision hash, so the port records no
  revision; a lem line it cannot translate fails both
- `lemmon/` holds the port's own plugins, written against `@limulus/lemmon-shell`'s
  exports, with their specs. `svgSprite()` (`lemmon/svg-sprite.ts`) fills `page.lem`'s
  `mark("sprite")` with the inline sprite of `www/assets/svg/common`, built by svg-sprite
  as eleventy-plugin-svg-sprite builds it, so a new icon there is in the next build's
  sprite, and a file svg-sprite cannot read stops the build. It drops the `<style>` WebC
  hoists out of the logo's symbol, whose rules `page.lem` carries under svg-sprite's
  namespaced ids; `npm test` fails if they drift (the plugin's header says what renames
  them). `linkPosts()` (`lemmon/link-posts.ts`) appends to a link post's body what
  eleventy.config.ts's `linkPostContent` appends — the `[link]` definition, and with a
  `viaUrl` the `[via]` one and the "Via" paragraph — which its spec checks by running
  that preprocessor beside it over every document
- `npm run parity` builds both sides and compares every page either wrote — each
  `index.html` under `dist/www` or `dist/lemmon`, so not the feeds or the sitemap; any
  other `.html` file in either fails the run — as rendered HTML through the forgiveness
  classes in `bin/parity/classes.ts`, each held to its count in `bin/parity/expected.ts`.
  The pages Lemmon does not write yet are listed there as `PENDING`, each with the lemmon
  item that brings it, and set aside; the run fails once Lemmon writes one, or Eleventy
  stops writing one. Every other page either dist holds is compared, and needs a row in
  `EXPECTED` (`generator` and `css-bundle` fire on every page, so a page without one
  fails), and a row for a page not compared — one neither build wrote, or a pending one
  — fails as stale. Then every file both wrote for an `index.ts` or `worker.ts` under
  `www/`, and under esbuild's asset path, byte for byte (`bin/parity/scripts.ts`), setting
  Eleventy's unhashed stubs aside by their content and counting them. `-- --no-build`
  compares the dists already there, where a page or a bundle `lem dev` left from an
  earlier edit fails as one only Lemmon wrote. It runs under `node --conditions=source`
  so the shell loads from the lemmon checkout's source
- `npm run parity:look`, run after `npm run parity`, checks that the pages it compares
  also look the same. It builds nothing, and shoots no page parity's own comparison fails:
  it serves both dists, shoots each page in the installed Google Chrome (needed;
  `playwright-core` drives it headless, rasterizing in software, and downloads no browser)
  at 1280 px light, 390 px light and 1280 px dark, and fails on any pixel that differs,
  writing each pair and its diff to `dist/look/<url>/`. So that exact equality can be the
  bar, every request to another host gets one fixed PNG; the scripts run on both sides,
  held until the page is parsed, and the photos held until every blur-hash placeholder is
  painted (limulus.net's placeholders otherwise race the parser and the photos,
  differently each run); what a script draws from a clock or a worker is masked, both
  sides alike — the pixel clock, the sphere shadows and their render times, the video
  player — by the list `MASKED` in `bin/parity-look.ts`, which fails a run where one
  masked nothing, and is checked instead by parity's byte comparison and by page errors,
  any of which fails a shot; and each page is served with every visible difference parity
  forgives undone, by a neutralizer in `bin/parity/neutralizers.ts` named for its class:
  footnote-markup (ours takes theirs' footnote classes, `[n]` markers and `↩︎`),
  reading-time (ours' header and card chips take theirs' minutes), md-photo-wrap (theirs
  drops the empty `p`s the parser leaves in a photo's `figure`). A difference no
  neutralizer covers fails the run
- `npm run parity:look -- --serve` serves `dist/www` on port 8081 and `dist/lemmon` on
  8082 as built, each running its own scripts, listing each page's two URLs, until
  Ctrl-C. Nothing is neutralized, held or masked there, so the differences parity
  forgives show
- Deliberately missing this slice, with the item in the lemmon repo's `BACKLOG.md` that
  brings it: the 19 photo pages and the 2 TIL topic pages (∆hvm), which parity lists as
  pending; and the three feeds and the sitemap (∆zu0, slice 6), which parity, comparing
  only `index.html` pages, does not look at. Not built at all: markdown-it-footnote's
  markup, since Lemmon writes comrak's footnotes, which parity's `footnote-markup`
  forgives until the cutover (∆oAl)
