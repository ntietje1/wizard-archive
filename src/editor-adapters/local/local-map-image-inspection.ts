import type { FileResourceSource } from '@wizard-archive/editor/resources/content-session-contract'
import {
  detectImageSourceFormat,
  MAX_VIEWABLE_IMAGE_ANIMATION_PIXELS,
} from '@wizard-archive/editor/resources/source-classifier'
import type {
  DetectedImageSourceFormat,
  ImageSourceInspection,
} from '@wizard-archive/editor/resources/source-classifier'

const IMAGE_DECODER_TIMEOUT_MS = 2_000

const IMAGE_MEDIA_TYPE = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const satisfies Record<DetectedImageSourceFormat, string>

export async function inspectLocalMapImage(
  source: FileResourceSource,
): Promise<ImageSourceInspection> {
  const format = detectImageSourceFormat(source.bytes)
  if (!format) return unavailable('malformed')
  if (typeof ImageDecoder === 'undefined') return unavailable('decoder_limit')

  const mediaType = IMAGE_MEDIA_TYPE[format]
  if (!(await ImageDecoder.isTypeSupported(mediaType))) return unavailable('decoder_limit')
  const decoder = new ImageDecoder({ data: source.bytes, type: mediaType, preferAnimation: true })
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    decoder.close()
  }, IMAGE_DECODER_TIMEOUT_MS)
  try {
    await decoder.tracks.ready
    const track = decoder.tracks.selectedTrack
    if (!track) return unavailable('malformed')
    const decoded = await decoder.decode({ frameIndex: 0, completeFramesOnly: true })
    const { codedHeight, codedWidth, displayHeight, displayWidth } = decoded.image
    decoded.image.close()
    const totalDecodedPixels = displayWidth * displayHeight * track.frameCount
    if (
      !Number.isSafeInteger(totalDecodedPixels) ||
      totalDecodedPixels > MAX_VIEWABLE_IMAGE_ANIMATION_PIXELS
    ) {
      return unavailable('decoder_limit')
    }
    return {
      status: 'valid',
      format,
      width: displayWidth,
      height: displayHeight,
      frameCount: track.frameCount,
      totalDecodedPixels,
      canonicalOrientation:
        format !== 'jpeg' || (codedWidth === displayWidth && codedHeight === displayHeight),
    }
  } catch {
    return unavailable(timedOut ? 'parser_timeout' : 'malformed')
  } finally {
    clearTimeout(timeout)
    decoder.close()
  }
}

function unavailable(
  reason: Extract<ImageSourceInspection, { status: 'unavailable' }>['reason'],
): ImageSourceInspection {
  return { status: 'unavailable', reason }
}
