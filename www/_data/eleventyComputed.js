import readingTime from 'reading-time'

function extractTilTopic(filePathStem) {
  // Example: /www/tils/python/my-learning.md
  const pathParts = filePathStem.split('/')

  // Check if this is a TIL (in /tils/ directory)
  const tilIndex = pathParts.indexOf('tils')
  if (tilIndex !== -1 && pathParts.length > tilIndex + 2) {
    // Must be at least /tils/topic/article (3 parts after tils)
    // Return the directory after /tils/ as the topic
    const topic = pathParts[tilIndex + 1]
    const file = pathParts[tilIndex + 2]

    // Don't return topic if it's a pagination-generated page or an index file
    if (topic !== 'topics' && file !== 'index') {
      return topic
    }
  }

  return null
}

export default {
  // Extract topic from directory path for TILs
  tilTopic: (data) => extractTilTopic(data.page.filePathStem),

  // Auto-add tags based on topic
  tags: (data) => {
    const existingTags = data.tags ?? []
    const tilTopic = extractTilTopic(data.page.filePathStem)

    // If there's a tilTopic, ensure both 'til' and the topic are in tags
    if (tilTopic) {
      const tagsToAdd = ['til', tilTopic]
      const newTags = [...existingTags]

      tagsToAdd.forEach((tag) => {
        if (!newTags.includes(tag)) {
          newTags.push(tag)
        }
      })

      return newTags
    }

    return existingTags
  },

  // Calculate reading time for articles
  readingTime(data) {
    if (data.tags?.includes('article') && data.page?.rawInput) {
      const { time } = readingTime(data.page.rawInput)
      return time / 1000
    }
  },
}
