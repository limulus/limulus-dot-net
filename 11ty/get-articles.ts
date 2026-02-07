import Eleventy, { type CollectionApi, type EleventyEntry } from '@11ty/eleventy'
import matter from 'gray-matter'
import { readFile } from 'node:fs/promises'

export interface ArticleInfo {
  filePath: string
  data: Record<string, any>
  content: string
  rawInput: string
}

export async function getArticles(): Promise<ArticleInfo[]> {
  let captured: EleventyEntry[] = []

  const elev = new Eleventy('www', 'dist/www', {
    quietMode: true,
    config(config) {
      config.addCollection('_getArticles', (api: CollectionApi) => {
        captured = api.getFilteredByTag('article')
        return captured
      })
    },
  })

  await elev.toJSON()

  return Promise.all(
    captured.map(async (entry) => {
      const filePath = entry.inputPath.replace(/^\.\//, '')
      const rawInput = await readFile(filePath, 'utf-8')
      const parsed = matter(rawInput)
      return {
        filePath,
        data: entry.data,
        content: parsed.content,
        rawInput,
      }
    })
  )
}
