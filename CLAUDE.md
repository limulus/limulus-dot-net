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

- `/www`: Site content and Lemmon templates, `site.lem` declaring their types and data
- `/www/_includes`: Lemmon layouts and components, and the global stylesheets (`css/`)
- `/www/lib`: TypeScript source for client-side features
- `/lemmon`: The site's own plugins for `lem`
- `/bin`: Scripts: revisions, photos, the stylesheet copies
- `/infra`: AWS CDK infrastructure code
- `/infra/lib`: CDK stack definitions
- `/infra/functions`: CloudFront Functions (JS)
- `/infra/test`: Infrastructure tests

## Building the site

Lemmon's `lem` builds the site from `www/`. Eleventy built it until the cutover (lemmon
∆oAl); where the output below is shaped like Eleventy's, that is why.

- Prerequisite: the lemmon repo checked out at `../lemmon`, with `npm install` and
  `npm run rust:wasm` run there. Without it `npm ci` here still succeeds, leaving a
  dangling link, and the failure shows only at `npx lem`
- `npm run build` empties `dist/www` (its `clean` removes only `dist/www`, `dist/infra`,
  `coverage`, and `*.tsbuildinfo`) and runs `lem build`, which writes it from
  `lemmon.config.ts`, `www/site.lem`, and the `.lem` layouts and components in
  `www/_includes/`; `lem build` alone removes nothing, so a deleted post's page stays until
  a `clean`. The index pages and 404 are page templates (`www/index.lem`, `www/404.lem`,
  each section's `index.lem`), typed `SitePage`; `site.pages` holds every `index.lem`, which
  is how `/` reads the sections' teasers. The photo and TIL topic pages are generators
  (lemmon's D43): `www/photos/photo.lem` makes one `PhotoPage` per photo of `site.gallery`,
  at `/photos/<its stored alias>/`, its `prev` and `next` the newer and older photo, and
  `www/tils/topics.lem` one `TilTopicPage` per topic of `site.tilTopics`, at
  `/tils/<topic>/`; each type's defaults give the url and title, through `photoUrl` and
  `tilTopicUrl` in `site.lem`, which the sitemap calls too. No glob may match a generator,
  which `**/index.lem` does not. `lem check` (`npm run wwwc`, a leg of `npm run verify`)
  runs the same and writes nothing, printing each diagnostic with the source it covers
- Before anything is written, both check every link the build writes (lemmon's D47): each
  `href`, `src` and the like in the pages, each `url()` in the stylesheets, and the links,
  guids and `loc`s in the feeds and the sitemap, against the files the build writes, by
  exact name, a fragment into a page against that page's ids. A broken one is an error, so
  `lem build` writes nothing and `lem dev` keeps serving its last build. What CloudFront
  answers with no file is not modelled: `served` in `lemmon.config.ts` lists `/@eric`,
  which `infra/functions/cloudfront-request.js` redirects to Mastodon, and a link that
  only its dot-less rewrite serves, `/tils` for `/tils/`, is an error, so link a page by
  its url, slash and all. Two links Eleventy wrote were fixed for it: the Atom feeds'
  alternate links name `https://limulus.net/penumbra/` and `…/tils/` (below), and
  make-ai-boring-again links its footnote `#fn-out-of-scope`, the id comrak gives
  `[^out-of-scope]`, where it linked markdown-it's `#fn2`; the post's next
  `update-revisions` records a revision of it
- The feeds and the sitemap are page templates typed `XmlFile` (`site.lem`), whose layout
  `xmlFile` (`www/_includes/layouts/xml-file.lem`) writes the XML declaration with the
  file's `encoding` — `utf-8`, the sitemap's `UTF-8`, as Eleventy wrote each — and the
  `/feed.xsl` stylesheet instruction where front matter names a `stylesheet`, so `<?xml` is
  always the first byte. `www/feed.xml.lem` is the RSS feed of `site.newest`;
  `www/penumbra/feed.xml.lem` and `www/tils/feed.xml.lem` call `atomFeed` with
  `site.penumbraPosts` and `site.tilPosts`; each is a `Feed`, its title, subtitle, base and
  author in front matter, as Eleventy's `addFeed` calls gave them, the base as Eleventy
  printed it (`https://limulus.net/` for the RSS feed, whose `addFeed` gave no slash).
  `atomFeed` writes the base as the feed's `<id>`, as Eleventy did, and the base and a slash
  as its alternate link, the page's own url, where Eleventy linked the base, which names no
  file. An Atom feed with no entries is `updated` at `build.time`, as Eleventy's was at its
  build's. An item's content is `<lem.build.bodies[post.url.text()]>`: lemmon's body pass
  (D46) renders each post's body alone before any page, highlights it, and makes its links
  absolute against the config's `origin`, which `lemmon.config.ts` reads from
  `www/_data/site.json`, the same url `site.info` gives the items' links. Dates print in
  their written offset, where Eleventy spelled every `pubDate` and `updated` in UTC or the
  build machine's zone. `www/sitemap.xml.lem` lists `site.pages`, every article (its lastmod
  the last revision's date where it has more than one, else its own, and a `video:video` for
  a `VideoPost`), every photo page and every TIL topic page, with Eric's three changes from
  Eleventy's `sitemap.njk` (2026-10-18): it lists `/tils/nodejs/`, which Eleventy's
  pagination left out; it lists no feed; and an undated page has no lastmod, where Eleventy
  gave the template file's creation time — as have `/feed/`, `/penumbra/` and
  `/penumbra/journal/` while their collection is empty, since a lastmod is optional. It
  names its sources by hand, so a new generator or a page template that is no `index.lem`
  needs adding there, since nothing reports one missing
- The client scripts are bundled by the shell's `esbuild()`, which `lemmon.config.ts` lists
  with the asset path Eleventy's esbuild plugin used and its `MAPBOX_PUBLIC_TOKEN`; the
  config loads the `.env` beside it, wherever `lem` starts, and a build or check without the
  token fails naming it, as Eleventy's did. Its bundles are byte for byte what Eleventy's
  plugin wrote, from the esbuild (0.24.0) and esbuild-plugin-wasm (1.1.0) the shell pins,
  but no unhashed `index.js` stub beside a bundle. The layouts load each script where the
  WebC did — `/lib/common` in `base.lem`'s `head`, `/lib/video-on-demand` in
  `article-vod.lem`, the RUM loader and a page's `scripts` at the end of `page.lem`'s `body`
  — by `asset("/lib/x/index.js")`, the unhashed URL, which compiles to the hashed one. A
  post's `scripts:` is an `asset`, so the penumbra posts name theirs from `/`
  (`/penumbra/journal/<slug>/lib/index.js`), which Eleventy resolved to the same hashed URL
- `npm run dev` is the authoring loop: after `clean`, `lem dev` builds `dist/www`, serves
  it at http://127.0.0.1:8080/ with the COOP/COEP headers `lemmon.config.ts` lists, and on
  each change under `www/` rebuilds everything and reloads the open pages, while a
  `chokidar` watch reruns `npm run css` when `www/_includes/css/*.css` changes. A change to
  `lemmon.config.ts` needs a restart, as does one to `www/_data/site.json`'s `url`, which
  the config reads once as its `origin`; and like `lem build` it removes nothing from
  `dist/www`, so a page deleted meanwhile stays served until the next restart
- `npm run lemmon:photos` regenerates `www/_lemmon/photos.json` (photos keyed by alias)
  from `www/_data/photos.json`, adding to each photo the numbers `photo-meta.webc` parsed
  out of its EXIF strings with `parseFloat` (`focalLengthMm`, `fNumberValue`,
  `compositeExposureSeconds`), by the same expressions; `npm test` fails if the two have
  drifted
- Each page's CSS bundle holds the `lem-style` blocks of the components and layouts it
  ran, in Eleventy's order, then the global stylesheets. A block keeps that order by
  where it stands: a component's at the end of its body, after every call it makes, and
  a layout's between its `lem-let` capture and its call to the next layout. WebC bundled
  a component after those it depends on, wherever the page first used it, so
  `www/tils/index.lem` captures its article list before the topics' chips above it,
  whose `dataChip` would otherwise collect ahead of the cards' `pho-picture` (its icons
  then number after the cards'). Under its
  `.fnName { … }` wrapper every selector starts with `&` (a spec checks every `.lem`
  under `www/`); the photo page's wrapper is `.photoPage`, the class on its `article`,
  which stands for the hash WebC gave every element that page writes. The globals
  come from `www/_lemmon/site-styles.lem`, which is generated: `npm run css`
  writes it from `www/_includes/css/*.css` as `siteStyles()`, one `lem-style` per
  stylesheet, which `base.lem` calls, and `www/_lemmon/mapbox-gl.lem` from mapbox-gl's
  stylesheet as `mapboxGlStyles()`, which `map-box.lem` calls before its own block, where
  WebC bundled the stylesheet `map-box.webc` linked. Edit the CSS, not the `.lem`, and
  rerun it; `npm test` fails if either has drifted
- `npm run update-revisions` (`bin/update-revisions.ts`, which CD runs before the build)
  needs neither a build nor a secret, and writes `www/_data/revisions.json` only when it
  records a revision. `bin/revisions/articles.ts` lists the articles by site.lem's
  `articles` glob and titles each by its `Post.title` default, both written a second
  time; `npm test` fails if either copy moves without the other, or if a recorded hash
  no longer reproduces from the article as its commit holds it
- `bin/revisions/lemmon-calls.ts` turns a lem call on its own line in a post back into the
  lines it replaced — an `articlePhoto` into its WebC, a `demoWithFallback` into the
  penumbra demo's `<div>` around the `dynamic-content-fallback` Liquid include — for the
  revision hash, for good, so the port recorded no revision; the hash reads a lem line it
  cannot translate as written
- `lemmon/` holds the site's own plugins, written against `@limulus/lemmon-shell`'s
  exports, with their specs. `svgSprite()` (`lemmon/svg-sprite.ts`) fills `page.lem`'s
  `mark("sprite")` with the inline sprite of `www/assets/svg/common`, built by svg-sprite
  as eleventy-plugin-svg-sprite built it, so a new icon there is in the next build's
  sprite, and a file svg-sprite cannot read stops the build; a second entry fills the
  photo page's `mark("photoSprite")`, atop its `main`, from `www/assets/svg/photos`. It
  drops the `<style>` WebC hoisted out of the logo's symbol, whose rules `page.lem` carries
  under svg-sprite's namespaced ids; `npm test` fails if they drift (the plugin's header
  says what renames them). `linkPosts()` (`lemmon/link-posts.ts`) appends to a link post's
  body what Eleventy's `linkPostContent` preprocessor appended — the `[link]` definition,
  and with a `viaUrl` the `[via]` one and the "Via" paragraph
