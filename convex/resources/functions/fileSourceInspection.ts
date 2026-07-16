import { PDFDocument } from 'pdf-lib'
import type {
  ImageSourceInspection,
  IsoBmffSourceInspection,
  PdfSourceInspection,
  ResourceSourceInspection,
} from '@wizard-archive/editor/resources/source-classifier'

type InspectedFormat = 'gif' | 'jpeg' | 'mp4' | 'pdf' | 'png' | 'webp'

export async function inspectFileSource(
  bytes: Uint8Array,
  format: InspectedFormat,
): Promise<ResourceSourceInspection> {
  switch (format) {
    case 'png':
      return { image: inspectPng(bytes) }
    case 'jpeg':
      return { image: inspectJpeg(bytes) }
    case 'gif':
      return { image: inspectGif(bytes) }
    case 'webp':
      return { image: inspectWebp(bytes) }
    case 'pdf':
      return { pdf: await inspectPdf(bytes) }
    case 'mp4':
      return { isoBmff: inspectIsoBmff(bytes) }
  }
}

function inspectPng(bytes: Uint8Array): ImageSourceInspection {
  if (!ascii(bytes, 12, 'IHDR')) return imageUnavailable()
  const width = uint32(bytes, 16)
  const height = uint32(bytes, 20)
  if (!width || !height) return imageUnavailable()
  let frameCount = 1
  let offset = 8
  while (offset + 12 <= bytes.byteLength) {
    const length = uint32(bytes, offset)
    if (length === null || offset + length + 12 > bytes.byteLength) return imageUnavailable()
    if (ascii(bytes, offset + 4, 'acTL')) {
      frameCount = uint32(bytes, offset + 8) ?? 0
    }
    offset += length + 12
    if (ascii(bytes, offset - length - 8, 'IEND')) break
  }
  return imageInspection('png', width, height, frameCount, width * height * frameCount)
}

function inspectJpeg(bytes: Uint8Array): ImageSourceInspection {
  let offset = 2
  let canonicalOrientation = true
  while (offset + 4 <= bytes.byteLength) {
    const segment = readJpegSegment(bytes, offset)
    if (!segment) return imageUnavailable()
    if (segment === 'end') break
    const orientation = readJpegOrientation(bytes, segment)
    if (orientation !== null) canonicalOrientation = orientation === 1
    const dimensions = readJpegDimensions(bytes, segment)
    if (dimensions) return jpegInspection(dimensions, canonicalOrientation)
    offset = segment.next
  }
  return imageUnavailable()
}

function inspectGif(bytes: Uint8Array): ImageSourceInspection {
  const width = uint16LittleEndian(bytes, 6)
  const height = uint16LittleEndian(bytes, 8)
  if (!width || !height || bytes.byteLength < 13) return imageUnavailable()
  let offset = gifContentOffset(bytes)
  let frameCount = 0
  let totalDecodedPixels = 0
  while (offset < bytes.byteLength) {
    const block = readGifBlock(bytes, offset)
    if (!block) return imageUnavailable()
    if (block.status === 'end') break
    if (block.status === 'frame') {
      frameCount += 1
      totalDecodedPixels += block.decodedPixels
    }
    offset = block.next
  }
  return imageInspection('gif', width, height, frameCount, totalDecodedPixels)
}

function inspectWebp(bytes: Uint8Array): ImageSourceInspection {
  if (!ascii(bytes, 0, 'RIFF') || !ascii(bytes, 8, 'WEBP')) return imageUnavailable()
  let width: number | null = null
  let height: number | null = null
  let frameCount = 0
  let offset = 12
  while (offset + 8 <= bytes.byteLength) {
    const chunk = readWebpChunk(bytes, offset)
    if (!chunk) return imageUnavailable()
    if (chunk.type === 'ANMF') frameCount += 1
    const dimensions = readWebpDimensions(bytes, chunk)
    if (dimensions === 'invalid') return imageUnavailable()
    if (dimensions) ({ width, height } = dimensions)
    offset = chunk.next
  }
  if (!width || !height) return imageUnavailable()
  frameCount = Math.max(1, frameCount)
  return imageInspection('webp', width, height, frameCount, width * height * frameCount)
}

type JpegSegment = Readonly<{
  marker: number
  data: number
  length: number
  next: number
}>

function readJpegSegment(bytes: Uint8Array, offset: number): JpegSegment | 'end' | null {
  if (bytes[offset] !== 0xff) return null
  const marker = bytes[offset + 1]!
  if (marker === 0xd9 || marker === 0xda) return 'end'
  if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
    return { marker, data: offset + 2, length: 0, next: offset + 2 }
  }
  const data = offset + 4
  const length = uint16(bytes, offset + 2)
  if (length === null || length < 2 || offset + 2 + length > bytes.byteLength) return null
  return { marker, data, length: length - 2, next: offset + 2 + length }
}

function readJpegOrientation(bytes: Uint8Array, segment: JpegSegment): number | null {
  return segment.marker === 0xe1 && ascii(bytes, segment.data, 'Exif\0\0')
    ? jpegOrientation(bytes, segment.data + 6, segment.length - 6)
    : null
}

function readJpegDimensions(
  bytes: Uint8Array,
  segment: JpegSegment,
): Readonly<{ width: number; height: number }> | null {
  if (!isJpegStartOfFrame(segment.marker)) return null
  const height = uint16(bytes, segment.data + 1)
  const width = uint16(bytes, segment.data + 3)
  return width && height ? { width, height } : null
}

function jpegInspection(
  dimensions: Readonly<{ width: number; height: number }>,
  canonicalOrientation: boolean,
): ImageSourceInspection {
  const inspection = imageInspection(
    'jpeg',
    dimensions.width,
    dimensions.height,
    1,
    dimensions.width * dimensions.height,
  )
  return inspection.status === 'valid' ? { ...inspection, canonicalOrientation } : inspection
}

type GifBlock =
  | Readonly<{ status: 'end' }>
  | Readonly<{ status: 'skip'; next: number }>
  | Readonly<{ status: 'frame'; next: number; decodedPixels: number }>

function gifContentOffset(bytes: Uint8Array): number {
  const packed = bytes[10]!
  return 13 + ((packed & 0x80) === 0 ? 0 : 3 * 2 ** ((packed & 0x07) + 1))
}

function readGifBlock(bytes: Uint8Array, offset: number): GifBlock | null {
  const marker = bytes[offset]
  if (marker === 0x3b) return { status: 'end' }
  if (marker === 0x21) {
    const next = skipSubBlocks(bytes, offset + 2)
    return next < 0 ? null : { status: 'skip', next }
  }
  return marker === 0x2c ? readGifFrame(bytes, offset + 1) : null
}

function readGifFrame(bytes: Uint8Array, descriptor: number): GifBlock | null {
  if (descriptor + 9 > bytes.byteLength) return null
  const width = uint16LittleEndian(bytes, descriptor + 4)
  const height = uint16LittleEndian(bytes, descriptor + 6)
  if (!width || !height) return null
  const packed = bytes[descriptor + 8]!
  const colorTableBytes = (packed & 0x80) === 0 ? 0 : 3 * 2 ** ((packed & 0x07) + 1)
  const next = skipSubBlocks(bytes, descriptor + 10 + colorTableBytes)
  return next < 0 ? null : { status: 'frame', next, decodedPixels: width * height }
}

type WebpChunk = Readonly<{
  type: 'ANMF' | 'VP8 ' | 'VP8L' | 'VP8X' | 'other'
  data: number
  length: number
  next: number
}>

function readWebpChunk(bytes: Uint8Array, offset: number): WebpChunk | null {
  const length = uint32LittleEndian(bytes, offset + 4)
  if (length === null || offset + 8 + length > bytes.byteLength) return null
  const known = ['ANMF', 'VP8 ', 'VP8L', 'VP8X'].find((type) => ascii(bytes, offset, type))
  return {
    type: (known ?? 'other') as WebpChunk['type'],
    data: offset + 8,
    length,
    next: offset + 8 + length + (length % 2),
  }
}

function readWebpDimensions(
  bytes: Uint8Array,
  chunk: WebpChunk,
): Readonly<{ width: number; height: number }> | 'invalid' | null {
  switch (chunk.type) {
    case 'VP8X':
      return chunk.length < 10
        ? 'invalid'
        : {
            width: 1 + uint24LittleEndian(bytes, chunk.data + 4),
            height: 1 + uint24LittleEndian(bytes, chunk.data + 7),
          }
    case 'VP8 ':
      return readLossyWebpDimensions(bytes, chunk)
    case 'VP8L':
      return readLosslessWebpDimensions(bytes, chunk)
    case 'ANMF':
    case 'other':
      return null
  }
}

function readLossyWebpDimensions(
  bytes: Uint8Array,
  chunk: WebpChunk,
): Readonly<{ width: number; height: number }> | 'invalid' {
  if (chunk.length < 10 || !asciiBytes(bytes, chunk.data + 3, [0x9d, 0x01, 0x2a])) {
    return 'invalid'
  }
  return {
    width: (uint16LittleEndian(bytes, chunk.data + 6) ?? 0) & 0x3fff,
    height: (uint16LittleEndian(bytes, chunk.data + 8) ?? 0) & 0x3fff,
  }
}

function readLosslessWebpDimensions(
  bytes: Uint8Array,
  chunk: WebpChunk,
): Readonly<{ width: number; height: number }> | 'invalid' {
  if (chunk.length < 5 || bytes[chunk.data] !== 0x2f) return 'invalid'
  const packed = uint32LittleEndian(bytes, chunk.data + 1)
  return packed === null
    ? 'invalid'
    : { width: 1 + (packed & 0x3fff), height: 1 + ((packed >> 14) & 0x3fff) }
}

async function inspectPdf(bytes: Uint8Array): Promise<PdfSourceInspection> {
  try {
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    })
    const pageCount = document.getPageCount()
    if (pageCount < 1) return { status: 'unavailable', reason: 'malformed' }
    const { width, height } = document.getPage(0).getSize()
    if (!(width > 0) || !(height > 0)) return { status: 'unavailable', reason: 'malformed' }
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
        error instanceof Error && error.message.toLowerCase().includes('encrypted')
          ? 'encrypted'
          : 'malformed',
    }
  }
}

function inspectIsoBmff(bytes: Uint8Array): IsoBmffSourceInspection {
  let audio = false
  for (let index = 4; index + 16 <= bytes.byteLength; index += 1) {
    if (!ascii(bytes, index, 'hdlr')) continue
    audio ||= ascii(bytes, index + 12, 'soun')
    if (ascii(bytes, index + 12, 'vide')) return { status: 'valid', media: 'video' }
  }
  return audio
    ? { status: 'valid', media: 'audio' }
    : { status: 'unavailable', reason: 'malformed' }
}

function imageInspection(
  format: 'gif' | 'jpeg' | 'png' | 'webp',
  width: number,
  height: number,
  frameCount: number,
  totalDecodedPixels: number,
): ImageSourceInspection {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    !Number.isSafeInteger(frameCount) ||
    !Number.isSafeInteger(totalDecodedPixels) ||
    width < 1 ||
    height < 1 ||
    frameCount < 1
  ) {
    return imageUnavailable()
  }
  return {
    status: 'valid',
    format,
    width,
    height,
    frameCount,
    totalDecodedPixels,
    canonicalOrientation: true,
  }
}

function imageUnavailable(): ImageSourceInspection {
  return { status: 'unavailable', reason: 'malformed' }
}

function skipSubBlocks(bytes: Uint8Array, start: number): number {
  let offset = start
  while (offset < bytes.byteLength) {
    const length = bytes[offset++]!
    if (length === 0) return offset
    offset += length
    if (offset > bytes.byteLength) return -1
  }
  return -1
}

function jpegOrientation(bytes: Uint8Array, tiffOffset: number, length: number): number {
  const directory = readTiffDirectory(bytes, tiffOffset, length)
  if (!directory) return 1
  for (let index = 0; index < directory.count; index += 1) {
    const entry = directory.offset + 2 + index * 12
    if (entry + 12 > directory.end) return 1
    if (directory.read16(bytes, entry) === 0x0112 && directory.read16(bytes, entry + 2) === 3) {
      return directory.read16(bytes, entry + 8) ?? 1
    }
  }
  return 1
}

type TiffDirectory = Readonly<{
  count: number
  end: number
  offset: number
  read16: typeof uint16
}>

function readTiffDirectory(
  bytes: Uint8Array,
  tiffOffset: number,
  length: number,
): TiffDirectory | null {
  if (length < 8 || tiffOffset + length > bytes.byteLength) return null
  const littleEndian = ascii(bytes, tiffOffset, 'II')
  if (!littleEndian && !ascii(bytes, tiffOffset, 'MM')) return null
  const read16 = littleEndian ? uint16LittleEndian : uint16
  const read32 = littleEndian ? uint32LittleEndian : uint32
  if (read16(bytes, tiffOffset + 2) !== 42) return null
  const ifdOffset = read32(bytes, tiffOffset + 4)
  if (ifdOffset === null) return null
  const offset = tiffOffset + ifdOffset
  const count = read16(bytes, offset)
  return count === null ? null : { count, end: tiffOffset + length, offset, read16 }
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  )
}

function uint16(bytes: Uint8Array, offset: number): number | null {
  return offset + 2 <= bytes.byteLength ? bytes[offset]! * 0x100 + bytes[offset + 1]! : null
}

function uint16LittleEndian(bytes: Uint8Array, offset: number): number | null {
  return offset + 2 <= bytes.byteLength ? bytes[offset]! + bytes[offset + 1]! * 0x100 : null
}

function uint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + bytes[offset + 1]! * 0x100 + bytes[offset + 2]! * 0x10000
}

function uint32(bytes: Uint8Array, offset: number): number | null {
  if (offset + 4 > bytes.byteLength) return null
  return (
    bytes[offset]! * 0x1000000 +
    bytes[offset + 1]! * 0x10000 +
    bytes[offset + 2]! * 0x100 +
    bytes[offset + 3]!
  )
}

function uint32LittleEndian(bytes: Uint8Array, offset: number): number | null {
  if (offset + 4 > bytes.byteLength) return null
  return (
    bytes[offset]! +
    bytes[offset + 1]! * 0x100 +
    bytes[offset + 2]! * 0x10000 +
    bytes[offset + 3]! * 0x1000000
  )
}

function ascii(bytes: Uint8Array, offset: number, value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false
  }
  return true
}

function asciiBytes(bytes: Uint8Array, offset: number, value: ReadonlyArray<number>): boolean {
  return value.every((byte, index) => bytes[offset + index] === byte)
}
