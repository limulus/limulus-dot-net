# limulus-dot-net

Source code for [limulus.net], [Eric]’s personal website.

[limulus.net]: https://limulus.net/
[eric]: https://limulus.net/eric/

## Tech

I intend to write more about how I’ve slowly been building out this site, but here’s a quick
overview of the tech stack:

### Site Generation

- [Lemmon]: Static site generator and typed template language (`lem`)
- [esbuild]: JavaScript bundler
- [sharp]: Image processing
- [AWS CDK]: Infrastructure as code (TypeScript)

[lemmon]: https://github.com/limulus/lemmon
[esbuild]: https://esbuild.github.io/
[sharp]: https://sharp.pixelplumbing.com/
[aws cdk]: https://aws.amazon.com/cdk/

### Hosting

- [S3]: Storage for HTML, CSS and JavaScript
- [CloudFront]: CDN and edge compute
- [bunny.net]: CDN and storage for images and videos (referral link)

[s3]: https://aws.amazon.com/s3/
[cloudfront]: https://aws.amazon.com/cloudfront/
[bunny.net]: https://bunny.net?ref=y8bk49x3t8

## User Guide

This section is largely for my own reference, but it may be useful to you if you’re trying
to understand this codebase.

### Running Locally

The build runs [Lemmon] from a checkout of its repository beside this one, at
`../lemmon`, with `npm install` and `npm run rust:wasm` run there. Then:

```sh
npm install
npm run dev
```

`npm run dev` serves the site at http://127.0.0.1:8080/, rebuilding it and reloading the
open pages on every change; `npm run build` writes it to `dist/www`. Both, and
`npm run verify`, need a Mapbox public token in `MAPBOX_PUBLIC_TOKEN`, from the
environment or a `.env` file here.

### Development

The `main` branch is automatically deployed to `limulus.net`. Non-content changes that
require testing should be done on a branch. Branches will be deployed to
`${branch}.limulus.net`.

### Keeping Work-In-Progress Private

This repo has [public](https://github.com/limulus/limulus-dot-net) and
[private](https://github.com/limulus/limulus-dot-net-private) forks to effectively allow for
private work-in-progress branches. To set this up, first clone the public repo then
configure two remotes:

```sh
git remote add public https://github.com/limulus/limulus-dot-net.git
git remote add private https://github.com/limulus/limulus-dot-net-private.git
```

To create a private branch, set its upstream to `private` when you first push it:

```sh
git checkout -b my-feature
git push -u private my-feature
```

> [!TIP]
> Branches on the private repo do not trigger CI and are not deployed to subdomains.

When you’re done and ready to publish the changes in a branch, just merge it to `main`.

### Infrastructure

The site infrastructure is managed using AWS CDK (TypeScript). The infrastructure code
is located in the `/infra` directory and includes:

- **CloudFront Distribution**: CDN with custom domain, caching policies, and function associations
- **S3 Buckets**: Static site storage and CloudFront access logs
- **CloudFront Functions**: URL rewriting and redirects (TypeScript)
- **Route 53 Records**: DNS configuration for custom domains
- **Origin Access Control**: Secure S3 access via CloudFront
- **SQS Queue**: CloudFront log processing

**Deployment**: Infrastructure is automatically deployed via GitHub Actions when changes are
pushed to any branch. This is the primary and recommended way to deploy long-lived stacks.

For local development and testing:

```sh
# Synthesize CloudFormation template
npm run cdkc

# View infrastructure diff (requires AWS credentials)
npx cdk diff

# Test CloudFront function running in CloudFront
npm run test:integration
```

### Writing Content

Posts are Markdown files under `www/feed`, `www/links`, `www/penumbra` and `www/tils`, and
every one is an article: it gets its own page, a card on `/feed/`, and an entry in
`/feed.xml`. A TIL's topic is its directory under `www/tils/`. The `/post`, `/link` and
`/til` commands in `.claude/commands/` create each kind.

[Lemmon] renders a post's Markdown with comrak. A Lemmon call on a line of its own places
a component:

- `<lem.articlePhoto(site.photos["alias"], .right)>`: a photo from the [photos database],
  floated `.left` or `.right`, or full width with `.hero`
- `<lem.demoWithFallback("element-name")>`: a Penumbra demo's custom element, with a
  message for readers without JavaScript

Any other `<lem.` or `<lem-` text belongs in a code span or fence, and a Liquid or WebC tag
prints as written.

#### Front Matter

A post's front matter is its record, typed `Post` by `www/site.lem`: a key `Post` does not
declare stops the build, as does a missing `date` or `author`.

- `title`: The title of the article. A link post's defaults to `Link: ` and its
  `linkTitle`.
- `subhead`: A subhead that appears below the title, used as the page meta description
  when present
- `teaser`: A short description used on article cards and as the page meta description
  when there is no `subhead`
- `date`: The date and time of first publication with its offset, such as
  `2026-04-04 10:30:00 -07:00`; a page prints it in that offset, and the feeds and the
  sitemap in UTC
- `author`: The author's key in the [authors database]
- `hero`: The alias of the photo in the [photos database] to use as the hero image
- `image`: The alias of a photo used only for the preview images on article cards and Open
  Graph tags (`imageAlt` is accepted and read by nothing)
- `tags`: A list. `link` lists a post on `/links/`, and `penumbra` on the Penumbra pages and
  their feed; the other tags in use (`article`, `video`) are labels nothing reads.
- `layout`: The layout function that renders the post: `article`, a post's default, or
  `video`, a video post's
- `type`: `VideoPost` for a video watch page, which also needs `vod`:
  - `id`: The identifier of the video on `vod.limulus.net`
  - `alt`: Alternate text for the poster image
  - `duration`: The duration in seconds of the video
- `scripts`: A script bundle the page loads, by its root path without a hash (see
  [Scripts](#scripts))
- `linkUrl`: The URL of the linked content for link posts. When present, a `[link]` markdown
  reference link is automatically available in the post body.
- `linkTitle`: The title of the linked content, which a link post's title is made from
- `viaUrl`: The URL of the source where the link was discovered. When present, a `[via]`
  markdown reference link is automatically available and a "Via" attribution is appended to
  the post.

[authors database]: www/_data/authors.json

### Media Management

#### Photos

Photos are hosted on `pho.limulus.net`. They are not stored in this repository. Before
publishing an article with a photo, prepare the photo by following these steps:

1. Ensure the photo is in your Apple Photos library. Give the photo a title and caption. The
   caption will be used as the alt text for the photo. Also set the following tags:

   - `limulus.net`: Tracks if the photo is used on limulus.net.
   - `limulus.net/photos`: Indicates photo should have a photo page.
   - `license:cc-by`: CC-BY license.

2. Export the photo from Apple Photos. Use the following settings:

   - File format: PNG
   - Color Profile: Display P3
   - Size: Full Size
   - Include Title, Keywords, and Caption
   - Include Location Information (optional)

3. Run this repo in a Codespace, and upload the photo to the `photos` directory.

4. Run the photo processing script: `npm run photos`. This script will:

   - Read the photos from the `photos` directory.
   - Generate hashes to use as an identifier for each photo.
   - Extract metadata using `sharp`.
   - Generate multiple renditions of each photo using `sharp`.
   - Upload the photos to `pho.limulus.net`.
   - Create a JSON file with the metadata for each photo and uploads it as `index.json`.
   - Update the repository’s [photos database] with the new entries.

5. Name each photo by its alias, the key of its record in the photos database (the
   script prints each photo's id and alias). On a line of its own in a post's body,
   `<lem.articlePhoto(site.photos["alias"], .right)>` places it (`.left`, `.right` or
   `.hero`); `hero:` and `image:` in front matter take the alias.

[photos database]: www/_data/photos.json

It is up to you to commit the changes to the photos database. If you don’t, the uploaded
photos will effectively be orphaned.

#### Videos

Videos are hosted on `vod.limulus.net`. Use the `hls-prep.js` script from [media-tools] to
prepare a video for upload.

[media-tools]: https://github.com/limulus/media-tools/

#### Scripts

Every `index.ts` and `worker.ts` under `www` is bundled by `esbuild` into an ES module
beside its source's path, named with a hash: `index.<hash>.js` and `worker.<hash>.js`.

A template names a bundle by its path without the hash, through `asset()`:
`<lem.asset("/lib/common/index.js")>` compiles to the hashed URL. A script that imports or
starts another names it with 8 `X`s in place of the hash, as in
`import '/lib/pixel-clock/index.XXXXXXXX.js'` or
`new Worker(new URL('./worker.XXXXXXXX.js', import.meta.url))`.

A post loads a script of its own with the `scripts` front matter property: one root path,
without the hash, such as `/penumbra/journal/rust/lib/index.js`.
