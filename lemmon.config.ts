import { bundler, highlighter, type Config } from '@limulus/lemmon-shell'
import { fileURLToPath } from 'node:url'

import { linkPosts } from './lemmon/link-posts.ts'
import { svgSprite } from './lemmon/svg-sprite.ts'

export default {
  input: 'www',
  output: 'dist/lemmon',
  passthrough: ['assets/**/*', '**/*.{png,svg,jpg,jpeg,xsd,xsl,txt,pdf}'],
  plugins: [
    bundler(),
    // eleventy.config.ts's markdown-it `highlight`: highlight.js 11.9.0, `hljs` markup.
    highlighter(),
    // eleventy.config.ts's `svgspriteCommon`, which page.lem places; its
    // `svgspritePhotos` joins as a second entry with the photo pages (lemmon ∆hvm).
    svgSprite({
      sprite: fileURLToPath(new URL('www/assets/svg/common', import.meta.url)),
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
