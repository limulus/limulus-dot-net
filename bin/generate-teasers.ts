import Anthropic from '@anthropic-ai/sdk'
import matter from 'gray-matter'
import { writeFile } from 'node:fs/promises'
import { smartypantsu } from 'smartypants'

import { getArticles } from '../11ty/get-articles.ts'
import {
  computeHash,
  computeTeaserHash,
  loadRevisions,
  saveRevisions,
} from '../11ty/revisions.ts'

const TEASER_PROMPT = `
You are generating a preview teaser for a blog post. The teaser appears as
the Open Graph description in link previews on social media, messaging apps,
and search results.

Your task: extract the opening lines of this article and lightly edit them
to read naturally as a standalone preview. This is NOT a summary — it should
read like the first few lines of the article, adapted to make sense without
the surrounding context.

Guidelines:
- Plain text only. No markdown, HTML, or formatting. Unicode punctuation is fine.
- Em-dashes must have spaces on both sides (\` — \`).
- Target ~200 characters. Never exceed 250.
- Skip blockquotes. Bridge the text before and after naturally, including
only essential context from the quote if needed for surrounding text to
make sense.
- Preserve voice transitions naturally (e.g., third-person attribution
transitioning to first-person commentary is fine for link posts).
- Fix awkward transitions. For example, if the text reads “energy use:”
followed by a blockquote, change the colon to a period since the blockquote
won’t be present.
- If the teaser ends mid-thought, end with an ellipsis (…)
- If the opening naturally fits within the limit, don’t add an ellipsis.
- Output only the teaser text. No explanation, no quotes around it.

Examples of correct output:
- John Gruber is scathing about macOS Tahoe's window corners. In general I think the larger corner radiuses look fine. But if Apple really wanted to make this new look functional it needed to rethink how windows work…
- Maybe you've heard of the "social contract." It's a concept in philosophy popularized during the Enlightenment…
- I've reimplemented everything to target WebAssembly using SIMD instructions — a language I've wanted to learn…
- Simon P. Couch used energy-per-token estimates to calculate his AI coding energy use — about 1,300 Wh through Claude Code on a median day. This matches my mental model…
`.trim()

export interface TeaserDecision {
  action: 'skip' | 'generate' | 'regenerate'
  reason: string
}

export function decideTeaserAction(
  hasSubhead: boolean,
  hasTeaser: boolean,
  inRevisions: boolean,
  hashMatch: boolean,
  teaserManuallyEdited: boolean
): TeaserDecision {
  if (hasSubhead) {
    return { action: 'skip', reason: 'has subhead' }
  }
  if (hasTeaser && !inRevisions) {
    return { action: 'skip', reason: 'manually written teaser' }
  }
  if (hasTeaser && teaserManuallyEdited) {
    return { action: 'skip', reason: 'manually edited teaser' }
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
      return beforeClose.replace(teaserPattern, newTeaser + '\n') + afterClose
    } else if (singleLinePattern.test(beforeClose)) {
      return beforeClose.replace(singleLinePattern, newTeaser + '\n') + afterClose
    }
  }

  // Insert new teaser before closing ---
  return `${beforeClose}${formatTeaserYaml(teaser)}\n${afterClose}`
}

export async function generateTeaser(
  anthropic: Anthropic,
  title: string,
  content: string
): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    system: TEASER_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Title: ${title}\n\n${content}`,
      },
    ],
  })

  const block = message.content.findLast((b) => b.type === 'text')
  if (!block || block.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic API')
  }

  return smartypantsu(block.text.trim())
}

async function main() {
  const revisions = await loadRevisions()
  const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

  const articles = await getArticles()
  let generatedCount = 0
  let teaserHashChanged = false

  for (const { filePath, data, content, rawInput } of articles) {
    const title = data.title as string
    const subhead = data.subhead as string | undefined
    const teaser = data.teaser as string | undefined

    const hash = computeHash(title, subhead, content)

    const inRevisions =
      filePath in revisions.entries && revisions.entries[filePath].teaserHash != null
    const hashMatch = inRevisions && revisions.entries[filePath].teaserHash === hash

    // Check if teaser was manually edited by comparing its hash to the stored generated hash
    const currentTeaserHash = teaser != null ? computeTeaserHash(teaser) : null
    const storedTeaserHash = revisions.entries[filePath]?.generatedTeaserHash ?? null
    const teaserManuallyEdited =
      currentTeaserHash != null &&
      storedTeaserHash != null &&
      currentTeaserHash !== storedTeaserHash

    const decision = decideTeaserAction(
      subhead != null,
      teaser != null,
      inRevisions,
      hashMatch,
      teaserManuallyEdited
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
    const updatedContent = insertTeaserIntoFrontmatter(rawInput, newTeaser)
    await writeFile(filePath, updatedContent)

    revisions.entries[filePath] ??= { revisions: [] }
    revisions.entries[filePath].teaserHash = hash
    revisions.entries[filePath].generatedTeaserHash = computeTeaserHash(newTeaser)
    teaserHashChanged = true
    generatedCount++
  }

  if (teaserHashChanged) {
    await saveRevisions(revisions)
  }

  console.log(`Done. ${generatedCount} teaser(s) generated.`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
