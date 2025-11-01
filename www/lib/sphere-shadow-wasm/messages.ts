export const SphereShadowMessageType = {
  Frame: 'frame',
  Init: 'init',
  LightTranslate: 'light-translate',
  Ready: 'ready',
} as const

export interface SphereShadowFrameMessage {
  type: typeof SphereShadowMessageType.Frame
  bitmap: ImageBitmap
  renderTime: number
}

export interface SphereShadowInitMessage {
  type: typeof SphereShadowMessageType.Init
  width: number
  height: number
}

export interface SphereShadowLightTranslateMessage {
  type: typeof SphereShadowMessageType.LightTranslate
  x: number
  y: number
  z: number
}

export interface SphereShadowReadyMessage {
  type: typeof SphereShadowMessageType.Ready
}
