import { awsRum } from './aws-rum.js'

const vodEvents = ['played', 'hls-level-switched', 'viewed']
vodEvents.forEach((type) => {
  document.body.addEventListener(type, (event) => {
    if (
      event instanceof CustomEvent &&
      event.detail.type?.startsWith?.('net.limulus.vod.')
    ) {
      awsRum.recordEvent(`net.limulus.vod.${type}`, {
        vod: event.detail.vod,
      })
    }
  })
})
