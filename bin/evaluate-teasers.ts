import Anthropic from '@anthropic-ai/sdk'

import { generateTeaser } from './generate-teasers.ts'
import { getArticles } from '../11ty/get-articles.ts'

interface Article {
  title: string
  date: Date
  content: string
}

async function main() {
  const count = parseInt(process.argv[2] ?? '5', 10)
  const anthropic = new Anthropic()
  const allArticles = await getArticles()
  const articles: Article[] = allArticles.map((a) => ({
    title: a.data.title as string,
    date: new Date(a.data.date as string),
    content: a.content,
  }))

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
