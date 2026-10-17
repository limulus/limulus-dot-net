import { bundler, type Config } from '@limulus/lemmon-shell'

export default {
  input: 'www',
  output: 'dist/lemmon',
  passthrough: ['assets/**/*', '**/*.{png,svg,jpg,jpeg,xsd,xsl,txt,pdf}'],
  plugins: [bundler()],
} satisfies Config
