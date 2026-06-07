import { describe, expect, it } from 'vitest'
import { getExternalUrlDropTarget } from '../embed-targets'

describe('embed target drop helpers', () => {
  it('uses the first non-comment URL from uri-list drops', () => {
    const target = getExternalUrlDropTarget(
      createDataTransfer({
        'text/uri-list':
          '# SourceURL: https://ignored.example\n\nhttps://example.com/file.pdf\nhttps://example.com/other.pdf',
        'text/plain': 'https://fallback.example/fallback.pdf',
      }),
    )

    expect(target).toEqual({
      kind: 'externalUrl',
      url: 'https://example.com/file.pdf',
      name: 'file.pdf',
    })
  })

  it('falls back to plain text when uri-list has no URL entries', () => {
    const target = getExternalUrlDropTarget(
      createDataTransfer({
        'text/uri-list': '# SourceURL: https://ignored.example',
        'text/plain': 'https://example.com/from-plain-text.png',
      }),
    )

    expect(target).toEqual({
      kind: 'externalUrl',
      url: 'https://example.com/from-plain-text.png',
      name: 'from-plain-text.png',
    })
  })
})

function createDataTransfer(data: Record<string, string>): DataTransfer {
  return {
    getData: (type: string) => data[type] ?? '',
  } as DataTransfer
}
