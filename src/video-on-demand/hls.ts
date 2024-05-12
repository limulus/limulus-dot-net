import Hls from 'hls.js'

import { VideoOnDemand } from '.'
import { VODEvent } from './VODEvent'

const shouldUseHlsJs =
  !document.createElement('video').canPlayType('application/vnd.apple.mpegurl') &&
  Hls.isSupported()

export const createHlsAndBindEvents = (el: VideoOnDemand): Hls | null => {
  if (!shouldUseHlsJs) return null

  const hls = new Hls()

  hls.on(Hls.Events.ERROR, (event, data) => {
    el.dispatchEvent(
      new VODEvent('error', el.getAttribute('vod')!, { fromHlsJS: true, event, data })
    )
  })

  hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
    el.dispatchEvent(
      new VODEvent('hls-level-switched', el.getAttribute('vod')!, {
        fromHlsJS: true,
        event,
        data,
      })
    )
  })

  return hls
}
