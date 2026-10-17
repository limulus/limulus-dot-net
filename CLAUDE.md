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
  `.lem` layouts and components beside the WebC ones in `www/_includes/`. Its pages use
  absolute paths, so view them over HTTP: `python3 -m http.server -d dist/lemmon 8080`
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
- `npm run parity` builds both sides and compares every feed post as rendered HTML through
  the forgiveness classes in `bin/parity/classes.ts`, each held to its count in
  `bin/parity/expected.ts`; `-- --no-build` compares the dists already there. It runs
  under `node --conditions=source` so the shell loads from the lemmon checkout's source
- Deliberately missing this slice, each with the item in the lemmon repo's `BACKLOG.md`
  that brings it: the hashed `/lib` scripts (∆d1N), code highlighting (∆Nxd), footnote
  markup and computed defaults (∆ITg), links, TILs and the other collections (∆tAw), the
  svg-sprite plugin (∆IvY; the sprite is inlined, its CSS a `lem-style` in `page.lem`),
  and the photos data hook (∆c4j)
