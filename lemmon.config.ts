import { bundler, esbuild, highlighter, type Config } from '@limulus/lemmon-shell'
import { config as loadEnv } from 'dotenv'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { linkPosts } from './lemmon/link-posts.ts'
import { svgSprite } from './lemmon/svg-sprite.ts'

// The `.env` beside this file, wherever `lem` was started.
loadEnv({ path: fileURLToPath(new URL('.env', import.meta.url)) })

// The site's url, which site.lem's `info` reads for the feeds' links and guids and the
// sitemap's locs: read here too, so that the links the body pass makes absolute in each
// feed entry name the same origin as the entry around them.
const site = JSON.parse(
  readFileSync(new URL('www/_data/site.json', import.meta.url), 'utf8')
) as { url: string }

export default {
  input: 'www',
  output: 'dist/www',
  origin: site.url,
  // The CloudFront function's redirect to Mastodon (infra/functions/cloudfront-request.js).
  served: ['/@eric'],
  passthrough: ['assets/**/*', '**/*.{png,svg,jpg,jpeg,xsd,xsl,txt,pdf}'],
  plugins: [
    bundler(),
    // Every `index.ts` and `worker.ts` under www/ bundled and hashed beside its source,
    // the `.wasm` under its asset path, and the Mapbox token its define reads, from the
    // environment or `.env` (loaded above). The asset path keeps the `11ty` segment
    // Eleventy's esbuild plugin gave it: renaming it would rename the `.wasm`, and with
    // it the bundles and maps that name it, which a deploy would upload again for no
    // reader.
    esbuild({
      assetNames: 'assets/immutable/11ty/esbuild/[name].[hash]',
      env: ['MAPBOX_PUBLIC_TOKEN'],
    }),
    // The code blocks' `hljs` markup, from highlight.js 11.9.0.
    highlighter(),
    // The inline sprite of www/assets/svg/common, which page.lem places, and of
    // www/assets/svg/photos, which www/photos/photo.lem places atop each photo page's
    // `main`.
    svgSprite({
      sprite: fileURLToPath(new URL('www/assets/svg/common', import.meta.url)),
      photoSprite: fileURLToPath(new URL('www/assets/svg/photos', import.meta.url)),
    }),
    // A link post's `[link]` and `[via]` definitions, and its "Via" paragraph.
    linkPosts(),
  ],
  // What the CloudFront response headers policies send, so the pages are cross-origin
  // isolated in `lem dev` as they are live.
  dev: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
} satisfies Config
