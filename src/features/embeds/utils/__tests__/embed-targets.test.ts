import { afterEach, describe, expect, it } from 'vitest'
import {
  clearInternalNativeDrag,
  markInternalNativeDrag,
} from '~/features/dnd/utils/internal-native-drag'
import { getExternalUrlDropTarget } from '../embed-targets'

describe('embed target drop helpers', () => {
  afterEach(() => {
    clearInternalNativeDrag()
  })

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

  it('ignores app-internal native drags even when they carry URL text', () => {
    const target = getExternalUrlDropTarget(
      createDataTransfer({
        'application/x-wizard-archive-internal-drag': 'true',
        'text/plain': 'https://example.com/internal-image.png',
      }),
    )

    expect(target).toBeNull()
  })

  it('ignores URL text while an app-internal native drag is active', () => {
    markInternalNativeDrag(null)

    const target = getExternalUrlDropTarget(
      createDataTransfer({
        'text/plain': 'https://example.com/internal-image.png',
      }),
    )

    expect(target).toBeNull()
  })
})

function createDataTransfer(data: Record<string, string>): DataTransfer {
  return {
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? '',
  } as unknown as DataTransfer
}
