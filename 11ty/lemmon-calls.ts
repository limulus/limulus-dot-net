// While the Lemmon port and Eleventy build the same posts, a post writes each in-content
// photo, and each penumbra demo with its no-script fallback, as a lem call on a line of
// its own. Eleventy reads the block the call replaced — WebC, or a demo element around
// a Liquid include — and so does the revision hash, so the port is not recorded as an
// edit.

const ARTICLE_PHOTO =
  /^([ \t]*)<lem\.articlePhoto\(site\.photos\["([^"]+)"\], \.(left|right|hero)\)>[ \t]*$/gm

const DEMO_WITH_FALLBACK =
  /^([ \t]*)<lem\.demoWithFallback\("([a-z][a-z0-9-]*)"\)>[ \t]*$/gm

// Deliberately line-based rather than markdown-aware: a code fence holding a line that
// starts with `<lem` fails here too, which beats parsing fences while two builds read
// the posts.
const LEM_LINE = /^[ \t]*<lem[.-].*$/m

/** `lines`, each indented by `indent`, as one block of text. */
const indented = (indent: string, lines: string[]): string =>
  lines.map((line) => indent + line).join('\n')

/**
 * `markdown` with each lem call that has an Eleventy form written as that form, indented
 * as the call was: an `articlePhoto` as the WebC `article-photo` it replaced, and a
 * `demoWithFallback` as the `<div>` holding the demo's element around the
 * `dynamic-content-fallback` include.
 *
 * @throws when a lem line remains that has no Eleventy form, which Eleventy would
 *   otherwise render as text.
 */
export function eleventyFormsOfLemmonCalls(markdown: string): string {
  const translated = markdown
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
  const untranslated = LEM_LINE.exec(translated)
  if (untranslated) {
    throw new Error(`no Eleventy form for the lem line ${untranslated[0].trim()}`)
  }
  return translated
}
