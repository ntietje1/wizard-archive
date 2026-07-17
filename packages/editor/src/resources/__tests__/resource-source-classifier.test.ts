import { describe, expect, it } from 'vite-plus/test'
import {
  MAX_NOTE_SOURCE_BYTES,
  MAX_RESOURCE_SOURCE_BYTES,
  canonicalFileExtension,
  classifyFileResourceSource,
  classifyResourceSource,
} from '../resource-source-classifier'

const encoder = new TextEncoder()

describe('resource source classifier', () => {
  it.each(['md', 'markdown', 'mdown', 'mkd', 'txt'])(
    '%s is a note when its retained bytes are valid UTF-8',
    (extension) => {
      expect(
        classifyResourceSource({
          bytes: encoder.encode('# Hello'),
          fileName: `note.${extension.toUpperCase()}`,
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
      }),
    ).toMatchObject({ classification: 'note', text: 'Hello', removedUtf8Bom: true })
  })

  it.each([
    { bytes: Uint8Array.from([0xc3, 0x28]), reason: 'invalid_utf8' },
    { bytes: Uint8Array.from([0x61, 0, 0x62]), reason: 'nul_byte' },
  ])('preserves an invalid note candidate as inert bytes: $reason', ({ bytes, reason }) => {
    expect(classifyResourceSource({ bytes, fileName: 'note.md' })).toMatchObject({
      classification: 'inert_file',
      mediaType: 'application/octet-stream',
      viewerUnavailableReason: reason,
    })
  })

  it('preserves note candidates above the note ceiling as inert files', () => {
    const bytes = new Uint8Array(MAX_NOTE_SOURCE_BYTES + 1)
    bytes.fill(0x61)
    expect(classifyResourceSource({ bytes, fileName: 'large.txt' })).toMatchObject({
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
        }),
      ).toMatchObject({
        classification: 'inert_file',
        extension,
        viewerUnavailableReason: 'unsupported_format',
      })
    },
  )

  it('uses byte signatures instead of filename claims without validating payloads', () => {
    const pngSignature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(classifyResourceSource({ bytes: pngSignature, fileName: 'spoof.pdf' })).toEqual({
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
      mediaType: 'application/octet-stream',
    })
  })

  it('recognizes a PDF header without parsing the document', () => {
    expect(
      classifyResourceSource({ bytes: encoder.encode('%PDF-1.7\n'), fileName: 'document.bin' }),
    ).toMatchObject({
      classification: 'viewable_pdf',
      detectedFormat: 'pdf',
      extension: 'bin',
      mediaType: 'application/pdf',
      viewerUnavailableReason: null,
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
    {
      bytes: concat(new Uint8Array(4), asciiBytes('ftyp'), asciiBytes('isom')),
      classification: 'viewable_video',
      format: 'mp4',
      mediaType: 'video/mp4',
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

  it('keeps explicit file uploads as files even when their extension could create a note', () => {
    expect(
      classifyFileResourceSource({ bytes: encoder.encode('# Hello'), fileName: 'notes.md' }),
    ).toMatchObject({
      classification: 'inert_file',
      extension: 'md',
      mediaType: 'application/octet-stream',
      viewerUnavailableReason: 'unsupported_format',
    })
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
