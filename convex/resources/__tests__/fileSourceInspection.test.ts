// @vitest-environment node

import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { createFile, DataStream, Endianness } from 'mp4box'
import { describe, expect, it } from 'vite-plus/test'
import { classifyFileResourceSource } from '@wizard-archive/editor/resources/source-classifier'
import { inspectFileSource } from '../functions/fileSourceInspection'

describe('file source inspection', () => {
  it.each([
    ['png', 640, 480, 'image.png'],
    ['jpeg', 320, 200, 'image.jpg'],
    ['webp', 800, 600, 'image.webp'],
  ] as const)(
    'provides bounded decode evidence for %s images',
    async (format, width, height, fileName) => {
      const bytes = await image(format, width, height)
      const inspection = await inspectFileSource(bytes, format)
      expect(classifyFileResourceSource({ bytes, fileName, inspection })).toMatchObject({
        classification: 'viewable_image',
        detectedFormat: format,
        viewerUnavailableReason: null,
      })
    },
  )

  it('counts animated frames and total decoded pixels through the maintained decoder', async () => {
    await expect(inspectFileSource(animatedGif(), 'gif')).resolves.toEqual({
      image: {
        status: 'valid',
        format: 'gif',
        width: 1,
        height: 1,
        frameCount: 2,
        totalDecodedPixels: 2,
        canonicalOrientation: true,
      },
    })
  })

  it('lets the canonical classifier enforce decoded image limits', async () => {
    const bytes = await image('png', 16_385, 1)
    const inspection = await inspectFileSource(bytes, 'png')
    expect(classifyFileResourceSource({ bytes, fileName: 'large.png', inspection })).toMatchObject({
      classification: 'inert_file',
      viewerUnavailableReason: 'limit_exceeded',
    })
  })

  it('keeps orientation-sensitive JPEGs inert', async () => {
    const bytes = new Uint8Array(
      await imagePipeline(32, 16).withMetadata({ orientation: 6 }).jpeg().toBuffer(),
    )
    const inspection = await inspectFileSource(bytes, 'jpeg')
    expect(inspection).toMatchObject({
      image: { status: 'valid', canonicalOrientation: false },
    })
    expect(
      classifyFileResourceSource({ bytes, fileName: 'rotated.jpg', inspection }),
    ).toMatchObject({
      classification: 'inert_file',
      viewerUnavailableReason: 'unsupported_format',
    })
  })

  it('classifies malformed image input as inert', async () => {
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    await expect(inspectFileSource(bytes, 'png')).resolves.toEqual({
      image: { status: 'unavailable', reason: 'malformed' },
    })
  })

  it('keeps PDF parsing out of the action runtime without terminating isolation', async () => {
    const document = await PDFDocument.create()
    document.addPage([612, 792])
    document.addPage([400, 400])
    const bytes = await document.save()
    const inspection = await inspectFileSource(bytes, 'pdf')

    expect(inspection).toEqual({
      pdf: { status: 'unavailable', reason: 'parser_timeout' },
    })
    expect(classifyFileResourceSource({ bytes, fileName: 'rules.pdf', inspection })).toMatchObject({
      classification: 'inert_file',
      viewerUnavailableReason: 'parser_timeout',
    })
  })

  it('does not start PDF work for encrypted or adversarial input', async () => {
    const document = await PDFDocument.create()
    document.addPage()
    const bytes = await document.save()

    await expect(inspectFileSource(encryptedPdf(), 'pdf')).resolves.toEqual({
      pdf: { status: 'unavailable', reason: 'parser_timeout' },
    })
    await expect(inspectFileSource(bytes.subarray(0, 12), 'pdf')).resolves.toEqual({
      pdf: { status: 'unavailable', reason: 'parser_timeout' },
    })
  })

  it.each(['video', 'audio', 'unknown', 'encrypted-video'] as const)(
    'does not start MP4 work for %s input',
    async (fixture) => {
      await expect(inspectFileSource(mp4(fixture), 'mp4')).resolves.toEqual({
        isoBmff: { status: 'unavailable', reason: 'parser_timeout' },
      })
    },
  )
})

type ImageFormat = 'jpeg' | 'png' | 'webp'

async function image(format: ImageFormat, width: number, height: number): Promise<Uint8Array> {
  const pipeline = imagePipeline(width, height)
  const encoded =
    format === 'png'
      ? await pipeline.png().toBuffer()
      : format === 'jpeg'
        ? await pipeline.jpeg().toBuffer()
        : await pipeline.webp().toBuffer()
  return new Uint8Array(encoded)
}

function imagePipeline(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 32, g: 64, b: 96, alpha: 1 },
    },
  })
}

function animatedGif(): Uint8Array {
  const header = [
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 0xff, 0xff, 0xff,
  ]
  const frame = [0x21, 0xf9, 4, 0, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0]
  return Uint8Array.from([...header, ...frame, ...frame, 0x3b])
}

function encryptedPdf(): Uint8Array {
  return Uint8Array.from(Buffer.from(ENCRYPTED_PDF_BASE64, 'base64'))
}

const ENCRYPTED_PDF_BASE64 =
  'JVBERi0xLjMKJeLjz9MKMSAwIG9iago8PAovUHJvZHVjZXIgPGJiMGJkNmIxM2I+Cj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbIDQgMCBSIF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9SZXNvdXJjZXMgPDwKPj4KL01lZGlhQm94IFsgMC4wIDAuMCA3MiA3MiBdCi9QYXJlbnQgMiAwIFIKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL1YgMgovUiAzCi9MZW5ndGggMTI4Ci9QIDQyOTQ5NjcyOTIKL0ZpbHRlciAvU3RhbmRhcmQKL08gPGE4MTdjMDMyMWNlYjkyYzA0NzA5MjA3NjEwNDYyZGY1YmViMDMyY2MwYWE0OGE2NzBmOWFlZjUzNzU5NjM3ZDY+Ci9VIDw4ZTg0Y2Y0NDY0YmE2MmY1ZDRlM2NmODRlZGJhNmE5MTI4YmY0ZTVlNGU3NThhNDE2NDAwNGU1NmZmZmEwMTA4Pgo+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNTkgMDAwMDAgbiAKMDAwMDAwMDExOCAwMDAwMCBuIAowMDAwMDAwMTY3IDAwMDAwIG4gCjAwMDAwMDAyNTkgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDMgMCBSCi9JbmZvIDEgMCBSCi9JRCBbIDw2NDY2NjM2MTY2MzUzNDMyMzczOTMwMzMzMjMwMzY2NDY0MzEzMTM0MzQzMTY0MzA2MjM1NjI2MTM5MzYzMTYyPiA8NjQ2NjM2MTY2MzUzNDMyMzczOTMwMzMzMjMwMzY2NDY0MzEzMTM0MzQzMTY0MzA2MjM1NjI2MTM5MzYzMTYyPiBdCi9FbmNyeXB0IDUgMCBSCj4+CnN0YXJ0eHJlZgo0NzQKJSVFT0YK'

type Mp4Fixture = 'audio' | 'encrypted-video' | 'unknown' | 'video'

function mp4(fixture: Mp4Fixture): Uint8Array {
  const file = createFile()
  switch (fixture) {
    case 'audio':
      file.addTrack({ type: 'mp4a', hdlr: 'soun', samplerate: 44_100 * 65_536 })
      break
    case 'encrypted-video':
      file.addTrack({ type: 'encv', hdlr: 'vide', width: 320, height: 200 })
      break
    case 'video':
      file.addTrack({ type: 'avc1', hdlr: 'vide', width: 320, height: 200 })
      break
    case 'unknown':
      file.init()
  }
  const stream = new DataStream()
  stream.endianness = Endianness.BIG_ENDIAN
  file.write(stream)
  return new Uint8Array(stream.buffer)
}
