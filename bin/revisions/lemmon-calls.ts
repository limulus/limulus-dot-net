// A post writes each in-content photo, and each penumbra demo with its no-script
// fallback, as a lem call on a line of its own, where it once wrote the block the call
// replaced — WebC, or a demo element around a Liquid include. The revision hash reads
// that block, for good, so the port was not recorded as an edit.

const ARTICLE_PHOTO =
  /^([ \t]*)<lem\.articlePhoto\(site\.photos\["([^"]+)"\], \.(left|right|hero)\)>[ \t]*$/gm

const DEMO_WITH_FALLBACK =
  /^([ \t]*)<lem\.demoWithFallback\("([a-z][a-z0-9-]*)"\)>[ \t]*$/gm

/** `lines`, each indented by `indent`, as one block of text. */
const indented = (indent: string, lines: string[]): string =>
  lines.map((line) => indent + line).join('\n')

/**
 * `markdown` with each lem call that has an Eleventy form written as that form, indented
 * as the call was: an `articlePhoto` as the WebC `article-photo` it replaced, and a
 * `demoWithFallback` as the `<div>` holding the demo's element around the
 * `dynamic-content-fallback` include. Every other line stays as written, a lem line with
 * no Eleventy form included: this is the revision hash's reading of a post, and a post
 * free to use any lem call must not fail the deploy that records its revisions.
 */
export function eleventyFormsOfLemmonCalls(markdown: string): string {
  return markdown
    .replace(ARTICLE_PHOTO, (_call, indent: string, id: string, placement: string) =>
      indented(indent, [
        `{% renderTemplate 'webc' %}`,
        `<article-photo id="${id}" placement="${placement}"></article-photo>`,
        `{% endrenderTemplate %}`,
      ])
    )
    .replace(DEMO_WITH_FALLBACK, (_call, indent: string, element: string) =>
      indented(indent, [
        `<div>`,
        `  <${element}>`,
        `    {% include 'dynamic-content-fallback' %}`,
        `  </${element}>`,
        `</div>`,
      ])
    )
}
