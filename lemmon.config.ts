import { bundler, esbuild, highlighter, type Config } from '@limulus/lemmon-shell'
import { config as loadEnv } from 'dotenv'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { linkPosts } from './lemmon/link-posts.ts'
import { svgSprite } from './lemmon/svg-sprite.ts'

// The `.env` beside this file, wherever `lem` was started; eleventy.config.ts reads the
// working directory's.
loadEnv({ path: fileURLToPath(new URL('.env', import.meta.url)) })

// The site's url, which site.lem's `info` reads for the feeds' links and guids and the
// sitemap's locs, and Eleventy for its own: read here too, so that the links the body
// pass makes absolute in each feed entry name the same origin as the entry around them.
const site = JSON.parse(
  readFileSync(new URL('www/_data/site.json', import.meta.url), 'utf8')
) as { url: string }

export default {
  input: 'www',
  output: 'dist/lemmon',
  origin: site.url,
  passthrough: ['assets/**/*', '**/*.{png,svg,jpg,jpeg,xsd,xsl,txt,pdf}'],
  plugins: [
    bundler(),
    // 11ty/esbuild.ts's bundles, byte for byte: every `index.ts` and `worker.ts` under
    // www/ hashed beside its source, the `.wasm` under its asset path, and the Mapbox
    // token its define reads, from the environment or `.env` (loaded above).
    esbuild({
      assetNames: 'assets/immutable/11ty/esbuild/[name].[hash]',
      env: ['MAPBOX_PUBLIC_TOKEN'],
    }),
    // eleventy.config.ts's markdown-it `highlight`: highlight.js 11.9.0, `hljs` markup.
    highlighter(),
    // eleventy.config.ts's `svgspriteCommon`, which page.lem places, and its
    // `svgspritePhotos`, which www/photos/photo.lem places atop each photo page's `main`.
    svgSprite({
      sprite: fileURLToPath(new URL('www/assets/svg/common', import.meta.url)),
      photoSprite: fileURLToPath(new URL('www/assets/svg/photos', import.meta.url)),
    }),
    // eleventy.config.ts's `linkPostContent`: a link post's `[link]` and `[via]`.
    linkPosts(),
  ],
  // What eleventy.config.ts's server middleware and the CloudFront response headers
  // policies send, so the pages are cross-origin isolated in `lem dev` as they are live.
  dev: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
} satisfies Config
