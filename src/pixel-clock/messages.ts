export enum PixelClockMessageType {
  Frame = 'frame',
  Init = 'init',
}

export interface PixelClockFrameMessage {
  type: PixelClockMessageType.Frame
  bitmap: ImageBitmap
}

export interface PixelClockInitMessage {
  type: PixelClockMessageType.Init
  width: number
  height: number
}

export type PixelClockMessage = PixelClockFrameMessage | PixelClockInitMessage
