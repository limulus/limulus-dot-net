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

  interface UserConfig {
    addWatchTarget(path: string): void
    on(event: string, callback: () => void | Promise<void>): void
    addTransform(
      name: string,
      callback: (
        this: EleventyTransformContext,
        content: string
      ) => string | Promise<string>
    ): void
  }

  class Eleventy {
    constructor(inputDir: string, outputDir: string, options?: EleventyOptions)
    write(): Promise<void>
    toJSON(): Promise<EleventyEntry[]>
    toNDJSON(): Promise<any>
  }

  export { UserConfig, EleventyPage, EleventyTransformContext }
  export default Eleventy
}
