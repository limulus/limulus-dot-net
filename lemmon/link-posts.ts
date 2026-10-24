// What a link post's markdown cites, appended to its body before the body compiles, as
// Eleventy's `linkPostContent` preprocessor appended it before markdown-it read it. A
// link post writes `[text][link]` against the `linkUrl` its front matter gives, so
// without this its link renders as brackets.

import type { DocumentSource, JsonValue, Plugin } from '@limulus/lemmon-shell'

/**
 * A plugin whose `transformDocument` appends to each link post — a document whose front
 * matter gives a `linkUrl` — the definition of `[link]` after a blank line, and where
 * it also gives a `viaUrl`, the definition of `[via]` and a paragraph crediting that
 * site by its domain: its host, without a leading `www.`. The paragraph is HTML, so the
 * `viaUrl` and domain it writes are escaped there, where Eleventy wrote them raw and a
 * quote or `<` in one broke the markup; for a `viaUrl` with none of `&<>"'` the text it
 * appends is what Eleventy appended, to the byte. Appending keeps every position in the
 * file the author wrote.
 *
 * A `linkUrl` or `viaUrl` that is not a string is left to the schema, which refuses it
 * when the front matter loads. The transform throws, an error at the document's front
 * matter, on one holding whitespace, which would split the definition it is written into
 * and a `viaUrl`'s paragraph — a newline passes WHATWG's URL parser — and on a `viaUrl`
 * that is not a URL, which has no domain to credit, as Eleventy's build failed on it.
 */
export function linkPosts(): Plugin {
  return { name: 'link-posts', transformDocument: appended }
}

/** A field a link post gives: a string, and not an empty one, which Eleventy skipped. */
const given = (value: JsonValue | undefined): value is string =>
  typeof value === 'string' && value !== ''

function appended({ frontMatter, body }: DocumentSource): string {
  const { linkUrl, viaUrl } = frontMatter
  if (!given(linkUrl)) return body
  let text = `${body}\n\n[link]: ${unbroken('linkUrl', linkUrl)}`
  if (given(viaUrl)) {
    text += `\n[via]: ${unbroken('viaUrl', viaUrl)}`
    text += `\n\n<p>Via <a href="${escaped(viaUrl)}">${escaped(domainOf(viaUrl))}</a>.</p>`
  }
  return text
}

/** `url`, the value of `field`, refused if it holds whitespace. */
function unbroken(field: string, url: string): string {
  if (/\s/.test(url)) {
    throw new Error(`${field} may hold no whitespace, and ${JSON.stringify(url)} does`)
  }
  return url
}

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** `text` safe in HTML as text or as a quoted attribute value. */
const escaped = (text: string): string => text.replace(/[&<>"']/g, (c) => ENTITIES[c])

/** The host of `url`, as WHATWG's URL parser gives it, without a leading `www.`. */
function domainOf(url: string): string {
  if (!URL.canParse(url)) {
    throw new Error(`viaUrl ${url} is not a URL, so it has no domain to credit`)
  }
  return new URL(url).hostname.replace(/^www\./, '')
}
