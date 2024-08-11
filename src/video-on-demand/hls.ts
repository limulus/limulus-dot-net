import Hls from 'hls.js'

import { VideoOnDemand } from '.'
import { VODEvent } from './VODEvent'

export const createHlsAndBindEvents = (
  vodEl: VideoOnDemand,
  videoEl: HTMLVideoElement
): Hls | null => {
  if (!Hls.isSupported()) return null

  const hls = new Hls({ autoStartLoad: false })

  // Load the HLS stream when the video starts playing. Only needed if autoStartLoad is
  // false.
  const loadOnPlay = () => {
    hls.startLoad()
    videoEl.removeEventListener('play', loadOnPlay)
  }
  videoEl.addEventListener('play', loadOnPlay)

  hls.on(Hls.Events.ERROR, (event, data) => {
    vodEl.dispatchEvent(
      new VODEvent('error', vodEl.getAttribute('vod')!, { fromHlsJS: true, event, data })
    )
  })

  hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
    vodEl.dispatchEvent(
      new VODEvent('hls-level-switched', vodEl.getAttribute('vod')!, {
        fromHlsJS: true,
        event,
        data,
      })
    )
  })

  return hls
}
