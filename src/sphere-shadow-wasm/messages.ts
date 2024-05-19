export enum SphereShadowMessageType {
  Frame = 'frame',
  Init = 'init',
  LightTranslate = 'light-translate',
  Ready = 'ready',
}

export interface SphereShadowFrameMessage {
  type: SphereShadowMessageType.Frame
  bitmap: ImageBitmap
  renderTime: number
}

export interface SphereShadowInitMessage {
  type: SphereShadowMessageType.Init
  width: number
  height: number
}

export interface SphereShadowLightTranslateMessage {
  type: SphereShadowMessageType.LightTranslate
  x: number
  y: number
  z: number
}

export interface SphereShadowReadyMessage {
  type: SphereShadowMessageType.Ready
}
