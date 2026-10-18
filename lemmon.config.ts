import { bundler, type Config } from '@limulus/lemmon-shell'

export default {
  input: 'www',
  output: 'dist/lemmon',
  passthrough: ['assets/**/*', '**/*.{png,svg,jpg,jpeg,xsd,xsl,txt,pdf}'],
  plugins: [bundler()],
  // What eleventy.config.ts's server middleware and the CloudFront response headers
  // policies send, so the pages are cross-origin isolated in `lem dev` as they are live.
  dev: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
} satisfies Config
