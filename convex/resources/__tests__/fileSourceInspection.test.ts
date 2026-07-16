import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vite-plus/test'
import { classifyFileResourceSource } from '@wizard-archive/editor/resources/source-classifier'
import { inspectFileSource } from '../functions/fileSourceInspection'

describe('file source inspection', () => {
  it.each([
    ['png', png(640, 480), 'image.png'],
    ['jpeg', jpeg(320, 200), 'image.jpg'],
    ['webp', webp(800, 600), 'image.webp'],
  ] as const)('provides bounded decode evidence for %s images', async (format, bytes, fileName) => {
    const inspection = await inspectFileSource(bytes, format)
    expect(classifyFileResourceSource({ bytes, fileName, inspection })).toMatchObject({
      classification: 'viewable_image',
      detectedFormat: format,
      viewerUnavailableReason: null,
    })
  })

  it('lets the canonical classifier enforce decoded image limits', async () => {
    const bytes = png(16_385, 1)
    const inspection = await inspectFileSource(bytes, 'png')
    expect(classifyFileResourceSource({ bytes, fileName: 'large.png', inspection })).toMatchObject({
      classification: 'inert_file',
      viewerUnavailableReason: 'limit_exceeded',
    })
  })

  it('reads PDF page count and first-page dimensions without exposing parser state', async () => {
    const document = await PDFDocument.create()
    document.addPage([612, 792])
    document.addPage([400, 400])
    const bytes = await document.save()
    const inspection = await inspectFileSource(bytes, 'pdf')

    expect(inspection).toEqual({
      pdf: {
        status: 'valid',
        encrypted: false,
        pageCount: 2,
        firstPageWidth: 612,
        firstPageHeight: 792,
        metadataReadable: true,
      },
    })
    expect(classifyFileResourceSource({ bytes, fileName: 'rules.pdf', inspection })).toMatchObject({
      classification: 'viewable_pdf',
      mediaType: 'application/pdf',
    })
  })

  it('distinguishes MP4 audio and video handlers and rejects an untyped container', async () => {
    const video = mp4('vide')
    const audio = mp4('soun')
    const unknown = mp4('meta')

    await expect(inspectFileSource(video, 'mp4')).resolves.toEqual({
      isoBmff: { status: 'valid', media: 'video' },
    })
    await expect(inspectFileSource(audio, 'mp4')).resolves.toEqual({
      isoBmff: { status: 'valid', media: 'audio' },
    })
    await expect(inspectFileSource(unknown, 'mp4')).resolves.toEqual({
      isoBmff: { status: 'unavailable', reason: 'malformed' },
    })
  })
})

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(45)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  writeUint32(bytes, 8, 13)
  writeAscii(bytes, 12, 'IHDR')
  writeUint32(bytes, 16, width)
  writeUint32(bytes, 20, height)
  writeAscii(bytes, 37, 'IEND')
  return bytes
}

function jpeg(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xd9,
  ])
}

function webp(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30)
  writeAscii(bytes, 0, 'RIFF')
  writeUint32LittleEndian(bytes, 4, 22)
  writeAscii(bytes, 8, 'WEBP')
  writeAscii(bytes, 12, 'VP8X')
  writeUint32LittleEndian(bytes, 16, 10)
  writeUint24LittleEndian(bytes, 24, width - 1)
  writeUint24LittleEndian(bytes, 27, height - 1)
  return bytes
}

function mp4(handler: string): Uint8Array {
  const bytes = new Uint8Array(32)
  writeUint32(bytes, 0, 16)
  writeAscii(bytes, 4, 'ftyp')
  writeAscii(bytes, 8, 'isom')
  writeAscii(bytes, 12, 'hdlr')
  writeAscii(bytes, 24, handler)
  return bytes
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index)
  }
}

function writeUint24LittleEndian(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >> 8) & 0xff
  bytes[offset + 2] = (value >> 16) & 0xff
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff
  bytes[offset + 1] = (value >>> 16) & 0xff
  bytes[offset + 2] = (value >>> 8) & 0xff
  bytes[offset + 3] = value & 0xff
}

function writeUint32LittleEndian(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >>> 8) & 0xff
  bytes[offset + 2] = (value >>> 16) & 0xff
  bytes[offset + 3] = (value >>> 24) & 0xff
}
