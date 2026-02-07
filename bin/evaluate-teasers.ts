import Anthropic from '@anthropic-ai/sdk'
import { globby } from 'globby'
import matter from 'gray-matter'
import { readFile } from 'node:fs/promises'

import { generateTeaser } from './generate-teasers.ts'

interface Article {
  title: string
  date: Date
  content: string
}

async function main() {
  const count = parseInt(process.argv[2] ?? '5', 10)
  const anthropic = new Anthropic()
  const files = await globby('www/**/*.md')
  const articles: Article[] = []

  for (const filePath of files) {
    const fileContent = await readFile(filePath, 'utf-8')
    const parsed = matter(fileContent)

    const tags: string[] = parsed.data.tags ?? []
    if (!tags.includes('article')) continue

    articles.push({
      title: parsed.data.title as string,
      date: new Date(parsed.data.date as string),
      content: parsed.content,
    })
  }

  articles.sort((a, b) => b.date.getTime() - a.date.getTime())
  const latest = articles.slice(0, count)

  console.log(`Evaluating teasers for ${latest.length} articles\n`)

  for (const article of latest) {
    const preview = article.content.trim().slice(0, 500)

    console.log('='.repeat(72))
    console.log(`Title: ${article.title}`)
    console.log(`Date:  ${article.date.toISOString().slice(0, 10)}`)
    console.log('-'.repeat(72))
    console.log(preview)
    if (article.content.trim().length > 500) console.log('[...]')
    console.log('-'.repeat(72))

    const teaser = await generateTeaser(anthropic, article.title, article.content)

    console.log(`Teaser (${teaser.length} chars):`)
    console.log(teaser)
    console.log()
  }

  console.log('Done.')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
