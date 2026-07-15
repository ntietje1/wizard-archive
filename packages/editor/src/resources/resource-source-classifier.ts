import { FILE_CLASSIFICATION, FILE_VIEWER_UNAVAILABLE_REASON } from './file-content-contract'
import type {
  FileClassification,
  FileOwnedMetadata,
  FileViewerUnavailableReason,
} from './file-content-contract'

export const MAX_RESOURCE_SOURCE_BYTES = 100 * 1024 * 1024
export const MAX_NOTE_SOURCE_BYTES = 10 * 1024 * 1024
export const MAX_VIEWABLE_IMAGE_DIMENSION = 16_384
export const MAX_VIEWABLE_IMAGE_FRAME_PIXELS = 100_000_000
export const MAX_VIEWABLE_IMAGE_FRAMES = 500
export const MAX_VIEWABLE_IMAGE_ANIMATION_PIXELS = 500_000_000
export const MAX_VIEWABLE_PDF_PAGES = 2_000

export const RESOURCE_SOURCE_REJECTION = {
  entryTooLarge: 'entry_too_large',
} as const

export type ResourceSourceRejection =
  (typeof RESOURCE_SOURCE_REJECTION)[keyof typeof RESOURCE_SOURCE_REJECTION]

export type NoteSourceInspection =
  | { readonly status: 'safe' }
  | {
      readonly status: 'unavailable'
      readonly reason: 'note_complexity' | 'parser_timeout'
    }

export type ImageSourceInspection =
  | {
      readonly status: 'valid'
      readonly format: 'png' | 'jpeg' | 'gif' | 'webp'
      readonly width: number
      readonly height: number
      readonly frameCount: number
      readonly totalDecodedPixels: number
      readonly canonicalOrientation: boolean
    }
  | {
      readonly status: 'unavailable'
      readonly reason: Extract<
        FileViewerUnavailableReason,
        'malformed' | 'limit_exceeded' | 'parser_timeout' | 'decoder_limit'
      >
    }

export type PdfSourceInspection =
  | {
      readonly status: 'valid'
      readonly encrypted: false
      readonly pageCount: number
      readonly firstPageWidth: number
      readonly firstPageHeight: number
      readonly metadataReadable: true
    }
  | {
      readonly status: 'unavailable'
      readonly reason: Extract<
        FileViewerUnavailableReason,
        'malformed' | 'encrypted' | 'limit_exceeded' | 'parser_timeout'
      >
    }

export type IsoBmffSourceInspection =
  | { readonly status: 'valid'; readonly media: 'audio' | 'video' }
  | { readonly status: 'unavailable'; readonly reason: 'malformed' | 'parser_timeout' }

export type ResourceSourceInspection = Readonly<{
  note?: NoteSourceInspection
  image?: ImageSourceInspection
  pdf?: PdfSourceInspection
  isoBmff?: IsoBmffSourceInspection
}>

export type ClassifiedNoteSource = Readonly<{
  classification: 'note'
  byteSize: number
  extension: 'md' | 'markdown' | 'mdown' | 'mkd' | 'txt'
  text: string
  removedUtf8Bom: boolean
}>

export type RejectedResourceSource = Readonly<{
  classification: 'rejected'
  byteSize: number
  reason: ResourceSourceRejection
}>

export type ResourceSourceClassification =
  | ClassifiedNoteSource
  | FileOwnedMetadata
  | RejectedResourceSource

const NOTE_EXTENSIONS: ReadonlySet<string> = new Set(['md', 'markdown', 'mdown', 'mkd', 'txt'])
const KNOWN_COMPOUND_EXTENSIONS = [
  'tar.bz2',
  'tar.gz',
  'tar.xz',
  'tar.zst',
  'd.ts',
  'min.css',
  'min.js',
  'user.js',
] as const
const VALID_EXTENSION = /^[a-z0-9][a-z0-9_-]*$/
const UTF8_BOM = [0xef, 0xbb, 0xbf] as const

type DetectedFormat =
  | 'png'
  | 'jpeg'
  | 'gif'
  | 'webp'
  | 'pdf'
  | 'mp3'
  | 'wav'
  | 'ogg_audio'
  | 'mp4'
  | 'aac_adts'
  | 'webm'

export function classifyResourceSource({
  bytes,
  fileName,
  inspection = {},
}: {
  bytes: Uint8Array
  fileName: string
  inspection?: ResourceSourceInspection
}): ResourceSourceClassification {
  const byteSize = bytes.byteLength
  if (byteSize > MAX_RESOURCE_SOURCE_BYTES) {
    return { classification: 'rejected', byteSize, reason: RESOURCE_SOURCE_REJECTION.entryTooLarge }
  }

  const extension = canonicalFileExtension(fileName)
  if (extension !== null && NOTE_EXTENSIONS.has(extension)) {
    const note = classifyNoteSource(bytes, extension, inspection.note)
    if (note.classification === 'note') return note
    return inertFile(byteSize, extension, null, note.reason)
  }

  const detectedFormat = detectFormat(bytes)
  switch (detectedFormat) {
    case 'png':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return classifyImage(byteSize, extension, detectedFormat, inspection.image)
    case 'pdf':
      return classifyPdf(byteSize, extension, inspection.pdf)
    case 'mp3':
      return viewableFile(byteSize, extension, 'mp3', 'audio/mpeg', FILE_CLASSIFICATION.audio)
    case 'wav':
      return viewableFile(byteSize, extension, 'wav', 'audio/wav', FILE_CLASSIFICATION.audio)
    case 'ogg_audio':
      return viewableFile(byteSize, extension, 'ogg_audio', 'audio/ogg', FILE_CLASSIFICATION.audio)
    case 'aac_adts':
      return viewableFile(byteSize, extension, 'aac_adts', 'audio/aac', FILE_CLASSIFICATION.audio)
    case 'mp4':
      return classifyIsoBmff(byteSize, extension, inspection.isoBmff)
    case 'webm':
      return viewableFile(byteSize, extension, 'webm', 'video/webm', FILE_CLASSIFICATION.video)
    case null:
      return inertFile(
        byteSize,
        extension,
        null,
        byteSize === 0
          ? FILE_VIEWER_UNAVAILABLE_REASON.empty
          : FILE_VIEWER_UNAVAILABLE_REASON.unsupportedFormat,
      )
  }
}

export function canonicalFileExtension(fileName: string): string | null {
  const normalized = fileName.normalize('NFC').toLowerCase()
  const baseName = normalized.replaceAll('\\', '/').split('/').at(-1) ?? ''
  for (const extension of KNOWN_COMPOUND_EXTENSIONS) {
    if (baseName.length > extension.length + 1 && baseName.endsWith(`.${extension}`)) {
      return extension
    }
  }
  if (baseName.startsWith('.')) return null
  const separator = baseName.lastIndexOf('.')
  if (separator <= 0 || separator === baseName.length - 1) return null
  const extension = baseName.slice(separator + 1)
  return VALID_EXTENSION.test(extension) ? extension : null
}

function classifyNoteSource(
  bytes: Uint8Array,
  extension: string,
  inspection: NoteSourceInspection | undefined,
): ClassifiedNoteSource | { classification: 'file'; reason: FileViewerUnavailableReason } {
  if (bytes.byteLength > MAX_NOTE_SOURCE_BYTES) {
    return { classification: 'file', reason: FILE_VIEWER_UNAVAILABLE_REASON.noteSizeLimit }
  }
  if (bytes.includes(0)) {
    return { classification: 'file', reason: FILE_VIEWER_UNAVAILABLE_REASON.nulByte }
  }
  const removedUtf8Bom =
    bytes.length >= UTF8_BOM.length && UTF8_BOM.every((byte, index) => bytes[index] === byte)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(
      removedUtf8Bom ? bytes.subarray(UTF8_BOM.length) : bytes,
    )
  } catch {
    return { classification: 'file', reason: FILE_VIEWER_UNAVAILABLE_REASON.invalidUtf8 }
  }
  if (!inspection || inspection.status === 'unavailable') {
    return {
      classification: 'file',
      reason:
        inspection?.reason === 'parser_timeout'
          ? FILE_VIEWER_UNAVAILABLE_REASON.parserTimeout
          : FILE_VIEWER_UNAVAILABLE_REASON.noteComplexity,
    }
  }
  return {
    classification: 'note',
    byteSize: bytes.byteLength,
    extension: extension as ClassifiedNoteSource['extension'],
    text,
    removedUtf8Bom,
  }
}

function classifyImage(
  byteSize: number,
  extension: string | null,
  format: Extract<DetectedFormat, 'png' | 'jpeg' | 'gif' | 'webp'>,
  inspection: ImageSourceInspection | undefined,
): FileOwnedMetadata {
  if (!inspection) {
    return inertFile(byteSize, extension, format, FILE_VIEWER_UNAVAILABLE_REASON.malformed)
  }
  if (inspection.status === 'unavailable') {
    return inertFile(byteSize, extension, format, inspection.reason)
  }
  if (inspection.format !== format) {
    return inertFile(byteSize, extension, format, FILE_VIEWER_UNAVAILABLE_REASON.malformed)
  }
  if (!imageInspectionWithinLimits(inspection)) {
    return inertFile(byteSize, extension, format, FILE_VIEWER_UNAVAILABLE_REASON.limitExceeded)
  }
  if (format === 'jpeg' && !inspection.canonicalOrientation) {
    return inertFile(byteSize, extension, format, FILE_VIEWER_UNAVAILABLE_REASON.unsupportedFormat)
  }
  const mediaType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`
  return viewableFile(byteSize, extension, format, mediaType, FILE_CLASSIFICATION.image)
}

function imageInspectionWithinLimits(
  inspection: Extract<ImageSourceInspection, { status: 'valid' }>,
): boolean {
  const framePixels = inspection.width * inspection.height
  return (
    safeIntegerInRange(inspection.width, 1, MAX_VIEWABLE_IMAGE_DIMENSION) &&
    safeIntegerInRange(inspection.height, 1, MAX_VIEWABLE_IMAGE_DIMENSION) &&
    framePixels <= MAX_VIEWABLE_IMAGE_FRAME_PIXELS &&
    safeIntegerInRange(inspection.frameCount, 1, MAX_VIEWABLE_IMAGE_FRAMES) &&
    safeIntegerInRange(
      inspection.totalDecodedPixels,
      framePixels,
      MAX_VIEWABLE_IMAGE_ANIMATION_PIXELS,
    )
  )
}

function safeIntegerInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum
}

function classifyPdf(
  byteSize: number,
  extension: string | null,
  inspection: PdfSourceInspection | undefined,
): FileOwnedMetadata {
  if (!inspection || inspection.status === 'unavailable') {
    return inertFile(
      byteSize,
      extension,
      'pdf',
      inspection?.reason ?? FILE_VIEWER_UNAVAILABLE_REASON.malformed,
    )
  }
  if (
    inspection.encrypted !== false ||
    inspection.metadataReadable !== true ||
    !Number.isSafeInteger(inspection.pageCount) ||
    inspection.pageCount < 1 ||
    inspection.pageCount > MAX_VIEWABLE_PDF_PAGES ||
    !Number.isFinite(inspection.firstPageWidth) ||
    !Number.isFinite(inspection.firstPageHeight) ||
    inspection.firstPageWidth <= 0 ||
    inspection.firstPageHeight <= 0
  ) {
    return inertFile(byteSize, extension, 'pdf', FILE_VIEWER_UNAVAILABLE_REASON.limitExceeded)
  }
  return viewableFile(byteSize, extension, 'pdf', 'application/pdf', FILE_CLASSIFICATION.pdf)
}

function classifyIsoBmff(
  byteSize: number,
  extension: string | null,
  inspection: IsoBmffSourceInspection | undefined,
): FileOwnedMetadata {
  if (!inspection || inspection.status === 'unavailable') {
    return inertFile(
      byteSize,
      extension,
      'mp4',
      inspection?.reason === 'parser_timeout'
        ? FILE_VIEWER_UNAVAILABLE_REASON.parserTimeout
        : FILE_VIEWER_UNAVAILABLE_REASON.malformed,
    )
  }
  return inspection.media === 'audio'
    ? viewableFile(byteSize, extension, 'mp4', 'audio/mp4', FILE_CLASSIFICATION.audio)
    : viewableFile(byteSize, extension, 'mp4', 'video/mp4', FILE_CLASSIFICATION.video)
}

function viewableFile(
  byteSize: number,
  extension: string | null,
  detectedFormat: string,
  mediaType: string,
  classification: Exclude<FileClassification, 'inert_file'>,
): FileOwnedMetadata {
  return {
    classification,
    byteSize,
    detectedFormat,
    extension,
    mediaType,
    viewerUnavailableReason: null,
  }
}

function inertFile(
  byteSize: number,
  extension: string | null,
  detectedFormat: string | null,
  viewerUnavailableReason: FileViewerUnavailableReason,
): FileOwnedMetadata {
  return {
    classification: FILE_CLASSIFICATION.inert,
    byteSize,
    detectedFormat,
    extension,
    mediaType: 'application/octet-stream',
    viewerUnavailableReason,
  }
}

function detectFormat(bytes: Uint8Array): DetectedFormat | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (asciiAt(bytes, 0, 'GIF87a') || asciiAt(bytes, 0, 'GIF89a')) return 'gif'
  if (asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')) return 'webp'
  if (validPdfHeader(bytes)) return 'pdf'
  if (asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WAVE')) return 'wav'
  if (isOggAudio(bytes)) return 'ogg_audio'
  if (isIsoBmff(bytes)) return 'mp4'
  if (isAacAdts(bytes)) return 'aac_adts'
  if (isMp3(bytes)) return 'mp3'
  if (isWebm(bytes)) return 'webm'
  return null
}

function validPdfHeader(bytes: Uint8Array): boolean {
  return (
    asciiAt(bytes, 0, '%PDF-1.') &&
    bytes.byteLength > 7 &&
    bytes[7] !== undefined &&
    bytes[7]! >= 0x30 &&
    bytes[7]! <= 0x39
  )
}

function isMp3(bytes: Uint8Array): boolean {
  if (asciiAt(bytes, 0, 'ID3')) return true
  return bytes.byteLength >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0
}

function isAacAdts(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xf6) === 0xf0
}

function isOggAudio(bytes: Uint8Array): boolean {
  if (!asciiAt(bytes, 0, 'OggS')) return false
  return ['OpusHead', '\u0001vorbis', 'Speex   ', '\u007fFLAC'].some((signature) =>
    asciiWithin(bytes, signature, 128),
  )
}

function isIsoBmff(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 12 && asciiAt(bytes, 4, 'ftyp')
}

function isWebm(bytes: Uint8Array): boolean {
  return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) && asciiWithin(bytes, 'webm', 128)
}

function startsWith(bytes: Uint8Array, signature: ReadonlyArray<number>): boolean {
  return signature.every((byte, index) => bytes[index] === byte)
}

function asciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  if (offset + value.length > bytes.byteLength) return false
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false
  }
  return true
}

function asciiWithin(bytes: Uint8Array, value: string, limit: number): boolean {
  const lastOffset = Math.min(bytes.byteLength - value.length, limit - value.length)
  for (let offset = 0; offset <= lastOffset; offset += 1) {
    if (asciiAt(bytes, offset, value)) return true
  }
  return false
}
