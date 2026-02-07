declare module '@11ty/eleventy' {
  interface EleventyOptions {
    quietMode?: boolean
    configPath?: string
    config?: (config: any) => void
  }

  interface EleventyEntry {
    inputPath: string
    fileSlug: string
    filePathStem: string
    data: Record<string, any>
    date: Date
    outputPath: string
    url: string
    content: string
    rawInput: string
  }

  interface EleventyPage {
    inputPath: string
    url: string
    outputPath: string
  }

  interface EleventyTransformContext {
    page: EleventyPage
  }

  interface CollectionApi {
    getFilteredByTag(tag: string): EleventyEntry[]
  }

  interface UserConfig {
    addWatchTarget(path: string): void
    on(event: string, callback: (...args: any[]) => void | Promise<void>): void
    addTransform(
      name: string,
      callback: (
        this: EleventyTransformContext,
        content: string
      ) => string | Promise<string>
    ): void
    addPassthroughCopy(path: string, options?: { expand?: boolean }): void
    addPlugin(plugin: any, options?: any): void
    addCollection(name: string, callback: (api: CollectionApi) => any): void
    setLibrary(name: string, library: any): void
    addShortcode(name: string, callback: (this: any, ...args: any[]) => any): void
    setServerOptions(options: {
      middleware?: ((req: any, res: any, next: () => void) => void)[]
      port?: number | string
    }): void
    setServerPassthroughCopyBehavior(behavior: string): void
  }

  class Eleventy {
    constructor(inputDir: string, outputDir: string, options?: EleventyOptions)
    write(): Promise<void>
    toJSON(): Promise<EleventyEntry[]>
    toNDJSON(): Promise<any>
  }

  const EleventyRenderPlugin: any
  export {
    UserConfig,
    EleventyPage,
    EleventyTransformContext,
    CollectionApi,
    EleventyEntry,
    EleventyRenderPlugin,
  }
  export default Eleventy
}

declare module '@11ty/eleventy-plugin-rss' {
  const feedPlugin: any
  export { feedPlugin }
}

declare module '@11ty/eleventy-plugin-webc' {
  const pluginWebc: any
  export default pluginWebc
}

declare module 'eleventy-plugin-svg-sprite' {
  const svgSprite: any
  export default svgSprite
}

declare module 'markdown-it-attrs' {
  const markdownItAttrs: any
  export default markdownItAttrs
}

declare module 'markdown-it-footnote' {
  const markdownItFootnote: any
  export default markdownItFootnote
}

declare module 'markdown-it-task-lists' {
  const markdownItTaskLists: any
  export default markdownItTaskLists
}
