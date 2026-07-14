import { describe, expect, it } from 'vite-plus/test'
import {
  MAX_NOTE_SOURCE_BYTES,
  MAX_RESOURCE_SOURCE_BYTES,
  canonicalFileExtension,
  classifyResourceSource,
} from '../resource-source-classifier'

const encoder = new TextEncoder()
const safeNote = { status: 'safe' as const }
const validImage = {
  status: 'valid' as const,
  format: 'png' as const,
  width: 32,
  height: 16,
  frameCount: 1,
  totalDecodedPixels: 512,
  canonicalOrientation: true,
}

describe('resource source classifier', () => {
  it.each(['md', 'markdown', 'mdown', 'mkd', 'txt'])(
    '%s is a note only with safe UTF-8',
    (extension) => {
      expect(
        classifyResourceSource({
          bytes: encoder.encode('# Hello'),
          fileName: `note.${extension.toUpperCase()}`,
          inspection: { note: safeNote },
        }),
      ).toEqual({
        classification: 'note',
        byteSize: 7,
        extension,
        text: '# Hello',
        removedUtf8Bom: false,
      })
    },
  )

  it('removes one UTF-8 BOM from note semantics', () => {
    expect(
      classifyResourceSource({
        bytes: Uint8Array.from([0xef, 0xbb, 0xbf, ...encoder.encode('Hello')]),
        fileName: 'note.md',
        inspection: { note: safeNote },
      }),
    ).toMatchObject({ classification: 'note', text: 'Hello', removedUtf8Bom: true })
  })

  it.each([
    {
      bytes: Uint8Array.from([0xc3, 0x28]),
      inspection: { note: safeNote },
      reason: 'invalid_utf8',
    },
    {
      bytes: Uint8Array.from([0x61, 0, 0x62]),
      inspection: { note: safeNote },
      reason: 'nul_byte',
    },
    {
      bytes: encoder.encode('deep'),
      inspection: { note: { status: 'unavailable' as const, reason: 'note_complexity' as const } },
      reason: 'note_complexity',
    },
    {
      bytes: encoder.encode('slow'),
      inspection: { note: { status: 'unavailable' as const, reason: 'parser_timeout' as const } },
      reason: 'parser_timeout',
    },
  ])(
    'preserves an unsafe note candidate as inert bytes: $reason',
    ({ bytes, inspection, reason }) => {
      expect(classifyResourceSource({ bytes, fileName: 'note.md', inspection })).toMatchObject({
        classification: 'inert_file',
        mediaType: 'application/octet-stream',
        viewerUnavailableReason: reason,
      })
    },
  )

  it('preserves note candidates above the note ceiling as inert files', () => {
    const bytes = new Uint8Array(MAX_NOTE_SOURCE_BYTES + 1)
    bytes.fill(0x61)
    expect(
      classifyResourceSource({ bytes, fileName: 'large.txt', inspection: { note: safeNote } }),
    ).toMatchObject({
      classification: 'inert_file',
      byteSize: MAX_NOTE_SOURCE_BYTES + 1,
      viewerUnavailableReason: 'note_size_limit',
    })
  })

  it.each(['css', 'js', 'json', 'yaml', 'xml', 'html', 'svg', 'csv', 'env'])(
    'never promotes .%s text to a note',
    (extension) => {
      expect(
        classifyResourceSource({
          bytes: encoder.encode('# harmless text'),
          fileName: `source.${extension}`,
          inspection: { note: safeNote },
        }),
      ).toMatchObject({
        classification: 'inert_file',
        extension,
        viewerUnavailableReason: 'unsupported_format',
      })
    },
  )

  it('uses validated signatures instead of filename claims', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(
      classifyResourceSource({
        bytes: png,
        fileName: 'spoof.pdf',
        inspection: { image: validImage },
      }),
    ).toEqual({
      classification: 'viewable_image',
      byteSize: 8,
      detectedFormat: 'png',
      extension: 'pdf',
      mediaType: 'image/png',
      viewerUnavailableReason: null,
    })
    expect(
      classifyResourceSource({ bytes: encoder.encode('not an image'), fileName: 'spoof.png' }),
    ).toMatchObject({
      classification: 'inert_file',
      detectedFormat: null,
      extension: 'png',
    })
  })

  it('requires matching decode evidence and enforces image budgets', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(classifyResourceSource({ bytes: png, fileName: 'image.png' })).toMatchObject({
      classification: 'inert_file',
      detectedFormat: 'png',
      viewerUnavailableReason: 'malformed',
    })
    expect(
      classifyResourceSource({
        bytes: png,
        fileName: 'image.png',
        inspection: { image: { ...validImage, width: 16_385 } },
      }),
    ).toMatchObject({
      classification: 'inert_file',
      viewerUnavailableReason: 'limit_exceeded',
    })
  })

  it('requires a safely parsed, unencrypted PDF within the page budget', () => {
    const pdf = encoder.encode('%PDF-1.7\n')
    expect(
      classifyResourceSource({
        bytes: pdf,
        fileName: 'document.bin',
        inspection: {
          pdf: {
            status: 'valid',
            encrypted: false,
            pageCount: 2_000,
            firstPageWidth: 612,
            firstPageHeight: 792,
            metadataReadable: true,
          },
        },
      }),
    ).toMatchObject({
      classification: 'viewable_pdf',
      detectedFormat: 'pdf',
      extension: 'bin',
      mediaType: 'application/pdf',
    })
    expect(
      classifyResourceSource({
        bytes: pdf,
        fileName: 'document.pdf',
        inspection: { pdf: { status: 'unavailable', reason: 'encrypted' } },
      }),
    ).toMatchObject({
      classification: 'inert_file',
      viewerUnavailableReason: 'encrypted',
    })
  })

  it.each([
    {
      bytes: asciiBytes('ID3'),
      classification: 'viewable_audio',
      format: 'mp3',
      mediaType: 'audio/mpeg',
    },
    {
      bytes: concat(asciiBytes('RIFF'), new Uint8Array(4), asciiBytes('WAVE')),
      classification: 'viewable_audio',
      format: 'wav',
      mediaType: 'audio/wav',
    },
    {
      bytes: concat(asciiBytes('OggS'), asciiBytes('OpusHead')),
      classification: 'viewable_audio',
      format: 'ogg_audio',
      mediaType: 'audio/ogg',
    },
    {
      bytes: Uint8Array.from([0xff, 0xf1]),
      classification: 'viewable_audio',
      format: 'aac_adts',
      mediaType: 'audio/aac',
    },
    {
      bytes: concat(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]), asciiBytes('webm')),
      classification: 'viewable_video',
      format: 'webm',
      mediaType: 'video/webm',
    },
  ])(
    'recognizes registered media signature $format',
    ({ bytes, classification, format, mediaType }) => {
      expect(classifyResourceSource({ bytes, fileName: 'payload.bin' })).toMatchObject({
        classification,
        detectedFormat: format,
        mediaType,
      })
    },
  )

  it('uses container inspection to distinguish MP4 audio and video', () => {
    const mp4 = concat(new Uint8Array(4), asciiBytes('ftyp'), asciiBytes('isom'))
    expect(
      classifyResourceSource({
        bytes: mp4,
        fileName: 'track.m4a',
        inspection: { isoBmff: { status: 'valid', media: 'audio' } },
      }),
    ).toMatchObject({ classification: 'viewable_audio', mediaType: 'audio/mp4' })
    expect(
      classifyResourceSource({
        bytes: mp4,
        fileName: 'movie.mp4',
        inspection: { isoBmff: { status: 'valid', media: 'video' } },
      }),
    ).toMatchObject({ classification: 'viewable_video', mediaType: 'video/mp4' })
  })

  it('rejects only bytes above the retained-entry ceiling', () => {
    expect(
      classifyResourceSource({
        bytes: new Uint8Array(MAX_RESOURCE_SOURCE_BYTES + 1),
        fileName: 'large.bin',
      }),
    ).toEqual({
      classification: 'rejected',
      byteSize: MAX_RESOURCE_SOURCE_BYTES + 1,
      reason: 'entry_too_large',
    })
  })
})

describe('canonical file extension', () => {
  it.each([
    ['archive.TAR.GZ', 'tar.gz'],
    ['types.d.ts', 'd.ts'],
    ['unknown.final', 'final'],
    ['.env', null],
    ['.profile.txt', null],
    ['name.', null],
    ['bad.a+b', null],
  ])('%s -> %s', (fileName, expected) => {
    expect(canonicalFileExtension(fileName)).toBe(expected)
  })
})

function asciiBytes(value: string): Uint8Array {
  return encoder.encode(value)
}

function concat(...parts: ReadonlyArray<Uint8Array>): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.byteLength, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.byteLength
  }
  return result
}
