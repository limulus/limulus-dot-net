export const PixelClockMessageType = {
  Frame: 'frame',
  Init: 'init',
} as const

export interface PixelClockFrameMessage {
  type: typeof PixelClockMessageType.Frame
  bitmap: ImageBitmap
}

export interface PixelClockInitMessage {
  type: typeof PixelClockMessageType.Init
  width: number
  height: number
}

export type PixelClockMessage = PixelClockFrameMessage | PixelClockInitMessage
