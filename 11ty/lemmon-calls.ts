// While the Lemmon port and Eleventy build the same posts, a post writes each in-content
// photo as a lem call on a line of its own. Eleventy reads the WebC block the call
// replaced, and so does the revision hash, so the port is not recorded as an edit.

const ARTICLE_PHOTO =
  /^([ \t]*)<lem\.articlePhoto\(site\.photos\["([^"]+)"\], \.(left|right|hero)\)>[ \t]*$/gm

// Deliberately line-based rather than markdown-aware: a code fence holding a line that
// starts with `<lem` fails here too, which beats parsing fences while two builds read
// the posts.
const LEM_LINE = /^[ \t]*<lem[.-].*$/m

/**
 * `markdown` with each lem call that has a WebC form written as that form, indented as
 * the call was.
 *
 * @throws when a lem line remains that has no WebC form, which Eleventy would otherwise
 *   render as text.
 */
export function webcForLemmonCalls(markdown: string): string {
  const translated = markdown.replace(
    ARTICLE_PHOTO,
    (_call, indent: string, id: string, placement: string) =>
      [
        `{% renderTemplate 'webc' %}`,
        `<article-photo id="${id}" placement="${placement}"></article-photo>`,
        `{% endrenderTemplate %}`,
      ]
        .map((line) => indent + line)
        .join('\n')
  )
  const untranslated = LEM_LINE.exec(translated)
  if (untranslated) {
    throw new Error(`no WebC form for the lem line ${untranslated[0].trim()}`)
  }
  return translated
}
