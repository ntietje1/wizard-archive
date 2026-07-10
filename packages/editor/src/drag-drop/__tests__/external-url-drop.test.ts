import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  clearInternalNativeDrag,
  markInternalNativeDrag,
} from '@wizard-archive/ui/drag-drop/internal-native-drag'
import { classifyExternalUrlDrop } from '../external-url-drop'

describe('external URL drop helpers', () => {
  afterEach(() => {
    clearInternalNativeDrag()
  })

  it('uses the first non-comment URL from uri-list drops', () => {
    const classification = classifyExternalUrlDrop(
      createDataTransfer({
        'text/uri-list':
          '# SourceURL: https://ignored.example\n\nhttps://example.com/file.pdf\nhttps://example.com/other.pdf',
        'text/plain': 'https://fallback.example/fallback.pdf',
      }),
      { readData: true },
    )

    expect(classification).toEqual({
      kind: 'accepted',
      target: {
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      },
    })
  })

  it('falls back to plain text when uri-list has no URL entries', () => {
    const classification = classifyExternalUrlDrop(
      createDataTransfer({
        'text/uri-list': '# SourceURL: https://ignored.example',
        'text/plain': 'https://example.com/from-plain-text.png',
      }),
      { readData: true },
    )

    expect(classification).toEqual({
      kind: 'accepted',
      target: {
        kind: 'externalUrl',
        url: 'https://example.com/from-plain-text.png',
        name: 'from-plain-text.png',
      },
    })
  })

  it('accepts browser image drags that expose both Files and a URL', () => {
    const dataTransfer = createDataTransfer({
      Files: '',
      'text/uri-list': 'https://images.example.com/dragon.png',
      'text/plain': 'https://images.example.com/dragon.png',
    })

    expect(classifyExternalUrlDrop(dataTransfer)).toEqual({ kind: 'candidate' })
    expect(classifyExternalUrlDrop(dataTransfer, { readData: true })).toEqual({
      kind: 'accepted',
      target: {
        kind: 'externalUrl',
        url: 'https://images.example.com/dragon.png',
        name: 'dragon.png',
      },
    })
  })

  it('extracts an image URL from dragged HTML content', () => {
    const dataTransfer = createDataTransfer({
      'text/html':
        '<div><a href="https://page.example.com"><img src="https://cdn.example.com/map.webp"></a></div>',
      'text/plain': 'Image result',
    })

    expect(classifyExternalUrlDrop(dataTransfer, { readData: true })).toEqual({
      kind: 'accepted',
      target: {
        kind: 'externalUrl',
        url: 'https://cdn.example.com/map.webp',
        name: 'map.webp',
      },
    })
  })

  it('extracts a linked file URL from dragged HTML content when no image is present', () => {
    const dataTransfer = createDataTransfer({
      'text/html': '<a href="https://cdn.example.com/handout.pdf">Handout</a>',
      'text/plain': 'Handout',
    })

    expect(classifyExternalUrlDrop(dataTransfer, { readData: true })).toEqual({
      kind: 'accepted',
      target: {
        kind: 'externalUrl',
        url: 'https://cdn.example.com/handout.pdf',
        name: 'handout.pdf',
      },
    })
  })

  it('detects URL drops without consuming dropped URL data', () => {
    const getData = vi.fn(() => 'https://example.com/file.pdf')
    const dataTransfer = {
      types: ['text/plain'],
      getData,
    } as unknown as DataTransfer

    expect(classifyExternalUrlDrop(dataTransfer)).toEqual({ kind: 'candidate' })
    expect(getData).not.toHaveBeenCalled()
  })

  it('leaves native file drops to the shared external file monitor', () => {
    expect(
      classifyExternalUrlDrop(
        createDataTransfer({
          Files: '',
        }),
      ),
    ).toEqual({ kind: 'ignored' })
  })

  it('ignores app-internal native drags even when they carry URL text', () => {
    const dataTransfer = createDataTransfer({
      'application/x-wizard-archive-internal-drag': 'true',
      'text/plain': 'https://example.com/internal-image.png',
    })

    expect(classifyExternalUrlDrop(dataTransfer)).toEqual({ kind: 'ignored' })
    expect(classifyExternalUrlDrop(dataTransfer, { readData: true })).toEqual({ kind: 'ignored' })
  })

  it('ignores URL text while an app-internal native drag is active', () => {
    markInternalNativeDrag(null)

    const dataTransfer = createDataTransfer({
      'text/plain': 'https://example.com/internal-image.png',
    })

    expect(classifyExternalUrlDrop(dataTransfer)).toEqual({ kind: 'ignored' })
    expect(classifyExternalUrlDrop(dataTransfer, { readData: true })).toEqual({ kind: 'ignored' })
  })

  it('rejects URL-bearing drags whose payload is not a supported URL', () => {
    const dataTransfer = createDataTransfer({
      Files: '',
      'text/plain': 'not a URL',
    })

    expect(classifyExternalUrlDrop(dataTransfer)).toEqual({ kind: 'candidate' })
    expect(classifyExternalUrlDrop(dataTransfer, { readData: true })).toEqual({
      kind: 'rejected',
      reason: 'unsupported_target',
    })
  })
})

function createDataTransfer(data: Record<string, string>): DataTransfer {
  return {
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? '',
  } as unknown as DataTransfer
}
