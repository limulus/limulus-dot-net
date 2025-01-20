import readingTime from 'reading-time'

export default {
  eleventyComputed: {
    readingTime(data) {
      if (data.tags?.includes('article') && data.page?.rawInput) {
        const { time } = readingTime(data.page.rawInput)
        return time / 1000
      }
    },
  },
}
