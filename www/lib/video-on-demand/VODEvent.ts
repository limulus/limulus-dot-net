type VODEventType = 'error' | 'played' | 'hls-level-switched' | 'viewed'

export class VODEvent extends CustomEvent<{ vod: string } & Record<string, any>> {
  constructor(type: VODEventType, vod: string, detail?: Record<string, any>) {
    super(type, {
      bubbles: true,
      detail: { type: `net.limulus.vod.${type}`, vod, ...detail },
    })
  }

  get message(): string | undefined {
    if (this.type !== 'error') return undefined
    return `VODEvent: ${JSON.stringify(this.detail)}`
  }
}
