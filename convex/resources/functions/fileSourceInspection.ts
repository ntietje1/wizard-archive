'use node'

import sharp from 'sharp'
import { MAX_VIEWABLE_IMAGE_ANIMATION_PIXELS } from '@wizard-archive/editor/resources/source-classifier'
import type {
  ImageSourceInspection,
  ResourceSourceInspection,
} from '@wizard-archive/editor/resources/source-classifier'

type InspectedFormat = 'gif' | 'jpeg' | 'mp4' | 'pdf' | 'png' | 'webp'
type ImageFormat = Exclude<InspectedFormat, 'mp4' | 'pdf'>

const IMAGE_INSPECTION_TIMEOUT_SECONDS = 2

export async function inspectFileSource(
  bytes: Uint8Array,
  format: InspectedFormat,
): Promise<ResourceSourceInspection> {
  switch (format) {
    case 'png':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return { image: await inspectImage(bytes, format) }
    case 'pdf':
      return { pdf: { status: 'unavailable', reason: 'parser_timeout' } }
    case 'mp4':
      return { isoBmff: { status: 'unavailable', reason: 'parser_timeout' } }
  }
}

async function inspectImage(
  bytes: Uint8Array,
  expectedFormat: ImageFormat,
): Promise<ImageSourceInspection> {
  try {
    const metadata = await sharp(bytes, {
      animated: true,
      failOn: 'error',
      limitInputPixels: MAX_VIEWABLE_IMAGE_ANIMATION_PIXELS,
      sequentialRead: true,
    })
      .timeout({ seconds: IMAGE_INSPECTION_TIMEOUT_SECONDS })
      .metadata()
    const frameCount = metadata.pages ?? 1
    const height = frameCount > 1 ? metadata.pageHeight : metadata.height
    if (metadata.format !== expectedFormat || !metadata.width || !height) {
      return imageUnavailable('malformed')
    }
    const totalDecodedPixels = metadata.width * height * frameCount
    if (
      !Number.isSafeInteger(frameCount) ||
      !Number.isSafeInteger(totalDecodedPixels) ||
      frameCount < 1
    ) {
      return imageUnavailable('decoder_limit')
    }
    return {
      status: 'valid',
      format: expectedFormat,
      width: metadata.width,
      height,
      frameCount,
      totalDecodedPixels,
      canonicalOrientation: expectedFormat !== 'jpeg' || (metadata.orientation ?? 1) === 1,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('timeout')) return imageUnavailable('parser_timeout')
    if (message.includes('pixel limit')) return imageUnavailable('decoder_limit')
    return imageUnavailable('malformed')
  }
}

function imageUnavailable(
  reason: Extract<ImageSourceInspection, { status: 'unavailable' }>['reason'],
): ImageSourceInspection {
  return { status: 'unavailable', reason }
}
