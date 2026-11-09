# Limulus Dot Net Development Guide

## Build & Development Commands

- Serve the site while editing: `npm run dev` (http://127.0.0.1:8080/)
- Build the site into `dist/www`: `npm run build`
- Check the site without writing it: `npm run wwwc` (`lem check`)
- Regenerate the stylesheet copies after editing `www/_includes/css/*.css`: `npm run css`
- Fix linting issues: `npm run lint -- --fix`
- Compile/Lint/Check/Test: `npm run verify` (what the pre-push hook runs)

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

- `/www`: Site content and Lemmon templates; `www/site.lem` declares their types and data
- `/www/_includes`: Lemmon layouts and components, and the global stylesheets (`css/`)
- `/www/_data`: The data files `site.lem` binds: site info, authors, revisions, photos
- `/www/_lemmon`: Generated `.lem` copies of the stylesheets (`npm run css`)
- `/www/lib`: TypeScript source for client-side features
- `/lemmon`: The site's own plugins for `lem`
- `/bin`: Scripts: revisions, photos, the stylesheet copies
- `/infra`: AWS CDK infrastructure code
- `/infra/lib`: CDK stack definitions
- `/infra/functions`: CloudFront Functions (JS)
- `/infra/test`: Infrastructure tests

## Setup

- Lemmon (`lem`) is the `@limulus/lemmon-shell` devDependency, installed from npm with the
  `@limulus/lemmon-core` release it pins. To build with an unreleased Lemmon, run
  `npm install --no-save <lemmon>/packages/shell` here against a lemmon checkout with
  `npm install`, `npm run rust:wasm` and `npm run build` run there: `lem` then runs that
  checkout's build, so rebuild it after each edit, and the pages' generator meta reads
  `Lemmon 0.0.0`. `package.json` and the lockfile stay as they were, and `npm ci` puts the
  release back. The lemmon repo's `agents/skills/lemmon/SKILL.md` is the reference for
  writing `.lem`
- `npm run build`, `npm run dev`, `npm run wwwc` and so `npm run verify` need
  `MAPBOX_PUBLIC_TOKEN`, which the client scripts' bundles embed: `lemmon.config.ts` reads
  it from the environment, after loading the `.env` beside it wherever `lem` starts.
  Without it they fail naming it. CD passes the repository secret to its build
- npm 12 runs no dependency's install script that `allowScripts` in `package.json` does not
  approve, and every one is denied there: esbuild, sharp, exifreader and fsevents work
  from the binaries and files their packages ship. A new dependency with an install script
  shows in `npm install`'s `install-scripts` warning; deny it once it is shown to work
  without (`npm install-scripts deny <name>`), or approve it with the reason. CD's npm 11
  ignores the field
- Build from a real `node_modules`: a symlinked one changes the source maps' module paths
  and with them the client scripts' hashed names

## Building the site

`lem` builds `dist/www` from `www/` as `lemmon.config.ts` says: the input and output, the
`origin`, the `served` paths, the passthrough globs (`assets/**/*`, and images and the like
anywhere), the plugins, and the dev server's headers.

- `npm run build` empties `dist/www` (`clean` removes only `dist/www`, `dist/infra`,
  `coverage`, and `*.tsbuildinfo`) and runs `lem build`, which compiles every template,
  loads the data and the documents, renders every page into memory, resolves its marks
  through the plugins, and only then writes the pages, the bundles, and the passthrough
  files; `lem build` alone removes nothing, so a deleted post's page stays until a
  `clean`. `lem check` runs the same and writes nothing, printing each diagnostic with the
  source it covers. CD (`.github/workflows/cd.yaml`) runs `npm run update-revisions`, then
  `npm run build`, and uploads `dist/www`
- `npm run dev` is the authoring loop: after `clean`, `lem dev` builds `dist/www`, serves
  it at http://127.0.0.1:8080/ with the COOP/COEP headers `lemmon.config.ts` lists, and on
  each change under `www/` rebuilds everything and reloads the open pages; a build with an
  error keeps the last one served. A `chokidar` watch reruns `npm run css` when
  `www/_includes/css/*.css` changes. A change to `lemmon.config.ts` needs a restart, as
  does one to `www/_data/site.json`'s `url`, which the config reads once as its `origin`.
  Like `lem build`, it removes nothing from `dist/www`, so a page deleted meanwhile stays
  served until the next restart
- `www/site.lem` declares the records — `Post` and `VideoPost`, `SitePage` with
  `PhotoPage` and `TilTopicPage`, `XmlFile` and `Feed`, `Photo`, `Author`, `Revisions` —
  and the data every template reads as `site`: `info` (`_data/site.json`), `photos`,
  `authors`, `revisions`, `penumbra`, the `articles` glob, `pages` (every `index.lem`), and
  the lists computed from them (`newest`, `linkPosts`, `penumbraPosts`, `tilPosts`,
  `tilTopics`, `gallery`). A record has exactly its declared fields, so a front matter key
  or data field site.lem does not declare is a load error at the file
- Every `.md` under `www/feed`, `www/links`, `www/penumbra` and `www/tils` is an article, a
  `Post` (`type: VideoPost` makes it a video watch page). Its defaults give a link post its
  title (`Link: ` and its `linkTitle`), a TIL its topic (its directory under `tils/`), and
  every post its reading time, counted from the prose a reader sees. Markdown is comrak's; a
  lem call on a line of its own places a component —
  `articlePhoto(site.photos["alias"], .right)` (or `.left`, `.hero`),
  `demoWithFallback("element-name")` for a penumbra demo — and a WebC or Liquid tag in a
  post prints as text
- The index pages and 404 are page templates (`www/index.lem`, `www/404.lem`, each
  section's `index.lem`), typed `SitePage`; `site.pages` holds every `index.lem`, which is
  how `/` reads the sections' teasers. The photo and TIL topic pages are generators
  (lemmon's D43): `www/photos/photo.lem` makes one `PhotoPage` per photo of `site.gallery`,
  at `/photos/<its alias>/`, its `prev` and `next` the newer and older photo, and
  `www/tils/topics.lem` one `TilTopicPage` per topic of `site.tilTopics`, at
  `/tils/<topic>/`; each type's defaults give the url and title, through `photoUrl` and
  `tilTopicUrl` in `site.lem`, which the sitemap calls too. No glob may match a generator,
  which `**/index.lem` does not
- Before anything is written, every link the build writes is checked (lemmon's D47): each
  `href`, `src` and the like in the pages, each `url()` in the stylesheets, and the links,
  guids and `loc`s in the feeds and the sitemap, against the files the build writes, by
  exact name, a fragment into a page against that page's ids. A broken one is an error, so
  `lem build` writes nothing. What CloudFront answers with no file is not modelled:
  `served` in `lemmon.config.ts` lists `/@eric`, which
  `infra/functions/cloudfront-request.js` redirects to Mastodon, and a link that only its
  dot-less rewrite serves, `/tils` for `/tils/`, is an error, so link a page by its url,
  slash and all. A footnote's id is comrak's, `#fn-<label>`
- The feeds and the sitemap are page templates typed `XmlFile`, whose layout `xmlFile`
  (`www/_includes/layouts/xml-file.lem`) writes the XML declaration with the file's
  `encoding` and, where front matter names a `stylesheet`, the `/feed.xsl` instruction, so
  `<?xml` is always the first byte. `www/feed.xml.lem` is the RSS feed of `site.newest`;
  `www/penumbra/feed.xml.lem` and `www/tils/feed.xml.lem` call `atomFeed` with
  `site.penumbraPosts` and `site.tilPosts`. Each is a `Feed`, its title, subtitle, base and
  author in front matter. An Atom feed's base is its `<id>`, without a final slash
  (`https://limulus.net/penumbra`), and its alternate link is the base and a slash, the
  page's own url; feed readers key on the ids and guids, so leave the bases as they are. An
  Atom feed with no entries is `updated` at `build.time`. An item's content is
  `<lem.build.bodies[post.url.text()]>`: lemmon's body pass (D46) renders each post's body
  alone before any page, highlights it, and makes its links absolute against the config's
  `origin`, which `lemmon.config.ts` reads from `www/_data/site.json`, the same url
  `site.info` gives the items' links. The feeds and the sitemap print every date in UTC,
  through `.utc()`, where a page prints it in the offset it was written in.
  `www/sitemap.xml.lem` lists `site.pages`, every article (its lastmod the last revision's
  date where it has more than one, else its own, and a `video:video` for a `VideoPost`),
  every photo page and every TIL topic page, and no feed; `/feed/`, `/penumbra/` and
  `/penumbra/journal/` take their newest article's date as lastmod, and another page with no
  date of its own has none. It names its sources by hand, so a new generator or a page
  template that is no `index.lem` needs adding there, since nothing reports one missing
- The client scripts are bundled by the shell's `esbuild()`: every `index.ts` and
  `worker.ts` under `www/` becomes `index.<hash>.js` or `worker.<hash>.js` beside its
  source's path, with a source map, and the `.wasm` a bundle imports goes under
  `/assets/immutable/11ty/esbuild/`, the path the bundles have always used (renaming it
  would rename the `.wasm` and every bundle and map that names it). The bundles depend on
  the esbuild (0.24.0) and esbuild-plugin-wasm (1.1.0) the shell pins. A template names a
  script by its unhashed URL, `asset("/lib/x/index.js")`, which compiles to the hashed
  one; a script names another with eight `X`s for the hash
  (`/lib/blur-hash/worker.XXXXXXXX.js`); a post's `scripts:` is an `asset`, its root path
  (`/penumbra/journal/<slug>/lib/index.js`). The layouts load `/lib/common` in
  `base.lem`'s `head`, `/lib/video-on-demand` in `article-vod.lem`, and the RUM loader and
  a page's `scripts` at the end of `page.lem`'s `body`
- Each page's CSS bundle, under `/assets/immutable/bundle/`, holds the `lem-style` blocks
  of the components and layouts it ran, in the order they ran, then the global
  stylesheets. A block keeps that order by where it stands: a component's at the end of
  its body, after every call it makes, and a layout's between its `lem-let` capture and
  its call to the next layout; `www/tils/index.lem` captures its article list before the
  topics' chips above it, so the cards' styles come first. Under its `.fnName { … }`
  wrapper every selector starts with `&` (a spec checks every `.lem` under `www/`); the
  photo page's wrapper is `.photoPage`, the class on its `article`. The globals come from
  `www/_lemmon/site-styles.lem`, which is generated: `npm run css` writes it from
  `www/_includes/css/*.css` as `siteStyles()`, one `lem-style` per stylesheet, which
  `base.lem` calls, and `www/_lemmon/mapbox-gl.lem` from mapbox-gl's stylesheet as
  `mapboxGlStyles()`, which `map-box.lem` calls before its own block. Edit the CSS, not
  the `.lem`, and rerun it; `npm test` fails if either has drifted
- `www/_data/photos.json`, which `site.lem` binds as `photos`, keys each photo's record by
  its alias, the name a post's `hero:`, `image:` or `site.photos["…"]` gives it. After its
  own fields each record carries the numbers the photo page prints from its EXIF strings
  (`focalLengthMm`, `fNumberValue`, `compositeExposureSeconds`), since Lemmon parses no
  number out of a string. `npm run photos` (`bin/process-photos.js`, which uploads to
  `pho.limulus.net` by FTP) writes each photo it processes into it with `withPhoto`
  (`bin/photos/photo-db.ts`), the numbers by `bin/photos/exif-numbers.ts`'s
  `parseFloat` expressions; `npm test` fails if a record is not what writing it again
  would write
- `npm run update-revisions` (`bin/update-revisions.ts`, which CD runs before the build)
  needs neither a build nor a secret, and writes `www/_data/revisions.json` only when it
  records a revision: an article whose title, subhead or content no longer hashes as its
  last revision did. `bin/revisions/articles.ts` lists the articles by site.lem's
  `articles` glob and titles each by its `Post.title` default, both written a second
  time; `npm test` fails if either copy moves without the other, or if a recorded hash
  no longer reproduces from the article as its commit holds it.
  `bin/revisions/lemmon-calls.ts` turns a lem call on its own line back into the lines it
  replaced for the hash — an `articlePhoto` into its WebC, a `demoWithFallback` into the
  penumbra demo's `<div>` around the `dynamic-content-fallback` Liquid include — so the
  posts that made that change record no revision for it; the hash reads any other lem line
  as written
- `lemmon/` holds the site's own plugins, written against `@limulus/lemmon-shell`'s
  exports, with their specs. `svgSprite()` (`lemmon/svg-sprite.ts`) fills `page.lem`'s
  `mark("sprite")` with the inline sprite of `www/assets/svg/common`, so a new icon there
  is in the next build's sprite, and a file svg-sprite cannot read stops the build; a
  second entry fills the photo page's `mark("photoSprite")`, atop its `main`, from
  `www/assets/svg/photos`. The logo's symbol keeps its `<style>`, whose rules svg-sprite
  writes under the ids it gives the logo's groups in the same compile (the plugin's header
  says what renames them). `linkPosts()` (`lemmon/link-posts.ts`) appends to a link post's
  body the `[link]` definition of its `linkUrl`, and with a `viaUrl` the `[via]` one and
  the "Via" paragraph
