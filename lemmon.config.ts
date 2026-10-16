// The shape is @limulus/lemmon-shell's `Config`; `lem build` validates it when it loads.
export default {
  input: 'www',
  output: 'dist/lemmon',
  passthrough: [
    'assets/**/*',
    '**/*.{png,svg,jpg,jpeg,xsd,xsl,txt,pdf}',
    '_includes/css/*.css',
  ],
}
