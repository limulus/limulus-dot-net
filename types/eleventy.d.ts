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

  class Eleventy {
    constructor(inputDir: string, outputDir: string, options?: EleventyOptions)
    write(): Promise<void>
    toJSON(): Promise<EleventyEntry[]>
    toNDJSON(): Promise<any>
  }

  export default Eleventy
}
