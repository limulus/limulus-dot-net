export const BlurHashMessageType = {
  decode: 'decode',
  decodeResult: 'decodeResult',
} as const

export interface BlurHashDecodeMessage {
  type: typeof BlurHashMessageType.decode
  id: string
  blurhash: string
  width: number
  height: number
}

export interface BlurHashDecodeResultMessage {
  type: typeof BlurHashMessageType.decodeResult
  id: string
  blobUrl: string
}

export type BlurHashMessage = BlurHashDecodeMessage | BlurHashDecodeResultMessage
