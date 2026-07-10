import { describe, expect, it } from 'vite-plus/test'
import { resolveFilePreviewImageUrl } from '../file-preview-url'

describe('resolveFilePreviewImageUrl', () => {
  it('prefers a valid direct image download over a generated preview', () => {
    expect(
      resolveFilePreviewImageUrl({
        contentType: 'image/png',
        downloadUrl: 'https://example.com/original.png',
        fileName: 'original.png',
        previewUrl: 'https://example.com/preview.png',
      }),
    ).toBe('https://example.com/original.png')
  })

  it('uses the generated preview for non-image files', () => {
    expect(
      resolveFilePreviewImageUrl({
        contentType: 'application/pdf',
        downloadUrl: 'https://example.com/document.pdf',
        fileName: 'document.pdf',
        previewUrl: 'https://example.com/preview.png',
      }),
    ).toBe('https://example.com/preview.png')
  })

  it('falls back from unsafe or failed direct image URLs to a valid generated preview', () => {
    expect(
      resolveFilePreviewImageUrl({
        contentType: 'image/png',
        downloadUrl: 'http://example.com/original.png',
        fileName: 'original.png',
        previewUrl: 'https://example.com/preview.png',
      }),
    ).toBe('https://example.com/preview.png')
    expect(
      resolveFilePreviewImageUrl({
        contentType: 'image/png',
        downloadUrl: 'https://example.com/original.png',
        erroredUrls: new Set(['https://example.com/original.png']),
        fileName: 'original.png',
        previewUrl: 'https://example.com/preview.png',
      }),
    ).toBe('https://example.com/preview.png')
  })

  it('returns no image when every candidate URL is unsafe or already failed', () => {
    expect(
      resolveFilePreviewImageUrl({
        contentType: 'image/png',
        downloadUrl: 'https://example.com/original.png',
        erroredUrls: new Set([
          'https://example.com/original.png',
          'https://example.com/preview.png',
        ]),
        fileName: 'original.png',
        previewUrl: 'https://example.com/preview.png',
      }),
    ).toBeNull()
  })
})
