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
  `.lem` layouts and components beside the WebC ones in `www/_includes/`. `npx lem check`
  runs the same and writes nothing, printing each diagnostic with the source it covers
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
  a layout's between its `lem-let` capture and its call to the next layout. Under its
  `.fnName { … }` wrapper every selector starts with `&` (a spec checks it). The globals
  come from `www/_lemmon/site-styles.lem`, which is generated: `npm run lemmon:css`
  writes it from `www/_includes/css/*.css` as `siteStyles()`, one `lem-style` per
  stylesheet, which `base.lem` calls. Edit the CSS, not the `.lem`, and rerun it;
  `npm test` fails if the two have drifted
- `11ty/lemmon-calls.ts` turns a lem call on its own line in a post back into the WebC it
  replaced, for Eleventy (the `lemmonCalls` preprocessor) and for the revision hash, so
  the port records no revision; a lem line it cannot translate fails both
- `lemmon/` holds the port's own plugins, written against `@limulus/lemmon-shell`'s
  exports, with their specs. `svgSprite()` (`lemmon/svg-sprite.ts`) fills `page.lem`'s
  `mark("sprite")` with the inline sprite of `www/assets/svg/common`, built by svg-sprite
  as eleventy-plugin-svg-sprite builds it, so a new icon there is in the next build's
  sprite, and a file svg-sprite cannot read stops the build. It drops the `<style>` WebC
  hoists out of the logo's symbol, whose rules `page.lem` carries under svg-sprite's
  namespaced ids; `npm test` fails if they drift (the plugin's header says what renames
  them)
- `npm run parity` builds both sides and compares the page of every article — each `.md`
  under `www/{feed,links,penumbra,tils}/`, which `www/site.lem`'s `articles` glob also
  matches — as rendered HTML through the forgiveness classes in `bin/parity/classes.ts`,
  each held to its count in `bin/parity/expected.ts`; `-- --no-build` compares the dists
  already there. It runs
  under `node --conditions=source` so the shell loads from the lemmon checkout's source
- `npm run parity:look`, run after `npm run parity`, checks that the articles also look
  the same. It builds nothing, and shoots no page parity's own comparison fails: it serves
  both dists, shoots each page in the installed Google Chrome (needed; `playwright-core`
  drives it headless, rasterizing in software, and downloads no browser) at 1280 px
  light, 390 px light and 1280 px dark, and fails on any pixel that differs, writing each
  pair and its diff to `dist/look/<url>/`. So that exact equality can be the bar, every
  request to another host gets one fixed PNG, `/lib/**` is refused on both sides, and
  each page is served with every visible difference parity forgives undone, by a
  neutralizer in `bin/parity/neutralizers.ts` named for its class: footnote-markup (ours
  takes theirs' footnote classes, `[n]` markers and `↩︎`), reading-time (ours' header
  chip takes theirs' minutes), md-photo-wrap (theirs drops the empty `p`s the parser
  leaves in a photo's `figure`). A difference no neutralizer covers fails the run
- `npm run parity:look -- --serve` serves `dist/www` on port 8081 and `dist/lemmon` on
  8082 as built, listing each page's two URLs, until Ctrl-C. Nothing is neutralized or
  refused there, so the differences parity forgives show, and Eleventy's pages run their
  `/lib` scripts (the video player, the share buttons, the blur-hash placeholders), which
  Lemmon's build has none of until ∆d1N
- Deliberately missing this slice, each with the item in the lemmon repo's `BACKLOG.md`
  that brings it: the hashed `/lib` scripts (∆d1N), code highlighting (∆Nxd), footnote
  markup, the link-post appender and the Liquid include (∆ITg), and the photos data hook
  (∆c4j)
