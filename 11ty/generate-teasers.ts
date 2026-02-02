import Anthropic from '@anthropic-ai/sdk'
import { globby } from 'globby'
import matter from 'gray-matter'
import { readFile, writeFile } from 'node:fs/promises'
import { smartypantsu } from 'smartypants'

import { computeHash, loadRevisions, saveRevisions } from './revisions.ts'

const TEASER_PROMPT = `\
You are generating a preview teaser for a blog post. The teaser appears as \
the Open Graph description in link previews on social media, messaging apps, \
and search results.

Your task: extract the opening lines of this article and lightly edit them \
to read naturally as a standalone preview. This is NOT a summary — it should \
read like the first few lines of the article, adapted to make sense without \
the surrounding context.

Guidelines:
- Plain text only. No markdown, HTML, or formatting.
- Always use curly quotes (\u201C\u201D \u2018\u2019), em-dashes (\u2014), and \
ellipses (\u2026). Never straight quotes or hyphens as dashes.
- Target ~200 characters. Never exceed 250.
- Skip blockquotes. Bridge the text before and after naturally, including \
only essential context from the quote if needed for surrounding text to \
make sense.
- Preserve voice transitions naturally (e.g., third-person attribution \
transitioning to first-person commentary is fine for link posts).
- Fix awkward transitions. For example, if the text reads \u201Cenergy use:\u201D \
followed by a blockquote, change the colon to a period since the blockquote \
won\u2019t be present.
- If the teaser ends mid-thought, end with an ellipsis (\u2026)
- If the opening naturally fits within the limit, don\u2019t add an ellipsis.
- Output only the teaser text. No explanation, no quotes around it.

Examples of correct output:
- Maybe you\u2019ve heard of the \u201Csocial contract.\u201D It\u2019s a concept in philosophy popularized during the Enlightenment\u2026
- I\u2019ve reimplemented everything to target WebAssembly using SIMD instructions\u2014a language I\u2019ve wanted to learn\u2026`

export interface TeaserDecision {
  action: 'skip' | 'generate' | 'regenerate'
  reason: string
}

export function decideTeaserAction(
  hasSubhead: boolean,
  hasTeaser: boolean,
  inRevisions: boolean,
  hashMatch: boolean
): TeaserDecision {
  if (hasSubhead) {
    return { action: 'skip', reason: 'has subhead' }
  }
  if (hasTeaser && !inRevisions) {
    return { action: 'skip', reason: 'manually written teaser' }
  }
  if (hasTeaser && inRevisions && hashMatch) {
    return { action: 'skip', reason: 'unchanged' }
  }
  if (hasTeaser && inRevisions && !hashMatch) {
    return { action: 'regenerate', reason: 'content changed' }
  }
  return { action: 'generate', reason: 'no teaser' }
}

export function wrapText(text: string, width: number): string {
  const lines: string[] = []
  let remaining = text
  while (remaining.length > width) {
    const slice = remaining.slice(0, width)
    const breakAt = slice.lastIndexOf(' ')
    if (breakAt === -1) break
    lines.push(remaining.slice(0, breakAt))
    remaining = remaining.slice(breakAt + 1)
  }
  lines.push(remaining)
  return lines.join('\n')
}

function formatTeaserYaml(teaser: string): string {
  const wrapped = wrapText(teaser, 90)
  return `teaser: >-\n  ${wrapped.split('\n').join('\n  ')}`
}

export function insertTeaserIntoFrontmatter(fileContent: string, teaser: string): string {
  const parsed = matter(fileContent)
  const hadTeaser = 'teaser' in parsed.data

  // Find the closing --- of frontmatter
  const frontmatterEnd = fileContent.indexOf('---', fileContent.indexOf('---') + 3)

  const beforeClose = fileContent.slice(0, frontmatterEnd)
  const afterClose = fileContent.slice(frontmatterEnd)

  if (hadTeaser) {
    // Replace existing teaser field
    const teaserPattern = /^teaser:[ \t]*>-\n(?:[ \t]+[^\n]*\n?)*/m
    const singleLinePattern = /^teaser:[ \t]*[^\n]+$/m

    const newTeaser = formatTeaserYaml(teaser)

    if (teaserPattern.test(beforeClose)) {
      return beforeClose.replace(teaserPattern, newTeaser) + afterClose
    } else if (singleLinePattern.test(beforeClose)) {
      return beforeClose.replace(singleLinePattern, newTeaser) + afterClose
    }
  }

  // Insert new teaser before closing ---
  return `${beforeClose}${formatTeaserYaml(teaser)}\n${afterClose}`
}

async function generateTeaser(
  anthropic: Anthropic,
  title: string,
  content: string
): Promise<string> {
  const message = await anthropic.messages.create({
    // Using claude-opus-4-5 alias to auto-update within Opus 4.5.x releases.
    // Anthropic provides 60 days notice before deprecation.
    // Check quarterly for new major versions: https://platform.claude.com/docs/en/about-claude/models/overview
    // Last checked: February 2026
    model: 'claude-opus-4-5',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `${TEASER_PROMPT}\n\n---\n\nTitle: ${title}\n\n${content}`,
      },
    ],
  })

  const block = message.content[0]
  if (block.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic API')
  }

  return smartypantsu(block.text.trim())
}

async function main() {
  const revisions = await loadRevisions()
  const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

  const files = await globby('www/**/*.md')
  let generatedCount = 0
  let teaserHashChanged = false

  for (const filePath of files) {
    const fileContent = await readFile(filePath, 'utf-8')
    const parsed = matter(fileContent)

    const tags: string[] = parsed.data.tags ?? []
    if (!tags.includes('article')) continue

    const title = parsed.data.title as string
    const subhead = parsed.data.subhead as string | undefined
    const teaser = parsed.data.teaser as string | undefined
    const content = parsed.content

    const hash = computeHash(title, subhead, content)

    const inRevisions = filePath in revisions && revisions[filePath].teaserHash != null
    const hashMatch = inRevisions && revisions[filePath].teaserHash === hash

    const decision = decideTeaserAction(
      subhead != null,
      teaser != null,
      inRevisions,
      hashMatch
    )

    if (decision.action === 'skip') {
      continue
    }

    if (!anthropic) {
      console.log(
        `[skip] ${filePath}: would ${decision.action}` +
          ` (${decision.reason}) but no ANTHROPIC_API_KEY`
      )
      continue
    }

    console.log(`[${decision.action}] ${filePath}: ${decision.reason}`)

    const newTeaser = await generateTeaser(anthropic, title, content)
    const updatedContent = insertTeaserIntoFrontmatter(fileContent, newTeaser)
    await writeFile(filePath, updatedContent)

    revisions[filePath] ??= { revisions: [] }
    revisions[filePath].teaserHash = hash
    teaserHashChanged = true
    generatedCount++
  }

  if (teaserHashChanged) {
    await saveRevisions(revisions)
  }

  console.log(`Done. ${generatedCount} teaser(s) generated.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
