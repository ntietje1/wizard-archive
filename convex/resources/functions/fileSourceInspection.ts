'use node'

import sharp from 'sharp'
import { PDFDocument, ParseSpeeds } from 'pdf-lib'
import { createFile, MP4BoxBuffer } from 'mp4box'
import { MAX_VIEWABLE_IMAGE_ANIMATION_PIXELS } from '@wizard-archive/editor/resources/source-classifier'
import type {
  ImageSourceInspection,
  IsoBmffSourceInspection,
  PdfSourceInspection,
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
      return { pdf: await inspectPdf(bytes) }
    case 'mp4':
      return { isoBmff: inspectIsoBmff(bytes) }
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

async function inspectPdf(bytes: Uint8Array): Promise<PdfSourceInspection> {
  try {
    const document = await PDFDocument.load(bytes, {
      capNumbers: true,
      ignoreEncryption: false,
      parseSpeed: ParseSpeeds.Fastest,
      throwOnInvalidObject: true,
      updateMetadata: false,
    })
    const pageCount = document.getPageCount()
    if (pageCount < 1) return { status: 'unavailable', reason: 'malformed' }
    const { width, height } = document.getPage(0).getSize()
    if (!(width > 0) || !(height > 0)) {
      return { status: 'unavailable', reason: 'malformed' }
    }
    document.getTitle()
    return {
      status: 'valid',
      encrypted: false,
      pageCount,
      firstPageWidth: width,
      firstPageHeight: height,
      metadataReadable: true,
    }
  } catch (error) {
    return {
      status: 'unavailable',
      reason:
        error instanceof Error &&
        error.message.startsWith('Input document to `PDFDocument.load` is encrypted.')
          ? 'encrypted'
          : 'malformed',
    }
  }
}

function inspectIsoBmff(bytes: Uint8Array): IsoBmffSourceInspection {
  const file = createFile()
  let failed = false
  file.onError = () => {
    failed = true
  }
  try {
    file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(bytes.slice().buffer, 0), true)
    file.flush()
  } catch {
    failed = true
  }
  const info = file.getInfo()
  if (
    failed ||
    !info.hasMoov ||
    info.tracks.some((track) => /^(enca|encv|drmi|drms)/.test(track.codec))
  ) {
    return { status: 'unavailable', reason: 'malformed' }
  }
  if (info.videoTracks.length > 0) return { status: 'valid', media: 'video' }
  return info.audioTracks.length > 0
    ? { status: 'valid', media: 'audio' }
    : { status: 'unavailable', reason: 'malformed' }
}
