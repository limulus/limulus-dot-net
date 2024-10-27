import Hls, { Level } from 'hls.js'
import pFilter from 'p-filter'

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

/**
 * Returns the available quality levels based on the video codec and what is supported by
 * the browser.
 */
export const availableQualityLevels = async (levels: Level[]): Promise<Level[]> =>
  uniqueHeights(await onlySupportedLevels(rankLevelsByVideoCodec(levels)))

/**
 * Sorts levels by video codec ranking (prefer higher efficiency codecs)
 */
const rankLevelsByVideoCodec = (levels: Level[]): Level[] => {
  const videoCodecRanking = new Map<string, number>([
    ['hvc1', 0],
    ['avc1', 100],
  ])

  const getVideoCodecRanking = (codec: string): number => {
    const ranking = videoCodecRanking.get(codec.split('.')[0])
    return ranking ?? 1000
  }

  return levels
    .filter((level) => level.videoCodec !== undefined)
    .sort((a, b) => {
      const aCodecRanking = getVideoCodecRanking(a.videoCodec!)
      const bCodecRanking = getVideoCodecRanking(b.videoCodec!)
      if (aCodecRanking !== bCodecRanking) return aCodecRanking - bCodecRanking
      return 0
    })
}

/**
 * Filter out unsupported levels
 */
const onlySupportedLevels = async (levels: Level[]): Promise<Level[]> => {
  return await pFilter(levels, async (level) => {
    try {
      const info = await navigator.mediaCapabilities.decodingInfo({
        type: 'media-source',
        video: {
          contentType: `video/mp4; codecs="${level.videoCodec}"`,
          bitrate: level.bitrate,
          framerate: level.frameRate,
          width: level.width,
          height: level.height,
        },
      })
      return info.supported
    } catch {
      console.debug('decodingInfo failed', level)
      return false
    }
  })
}

/**
 * Filter out levels with duplicate heights.
 */
const uniqueHeights = (levels: Level[]): Level[] => {
  const seenHeights = new Set<number>()

  return levels.filter((level) => {
    if (seenHeights.has(level.height)) return false
    seenHeights.add(level.height)
    return true
  })
}
