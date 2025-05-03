export enum BlurHashMessageType {
  decode = 'decode',
  decodeResult = 'decodeResult',
}

export interface BlurHashDecodeMessage {
  type: BlurHashMessageType.decode
  id: string
  blurhash: string
  width: number
  height: number
}

export interface BlurHashDecodeResultMessage {
  type: BlurHashMessageType.decodeResult
  id: string
  blobUrl: string
}

export type BlurHashMessage = BlurHashDecodeMessage | BlurHashDecodeResultMessage
