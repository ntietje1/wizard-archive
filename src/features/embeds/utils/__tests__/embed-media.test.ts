import { describe, expect, it } from 'vitest'
import { inferEmbedMediaKindFromContentType, inferEmbedMediaKindFromUrl } from '../embed-media'

describe('embed media detection', () => {
  it('infers external URL kind by extension', () => {
    expect(inferEmbedMediaKindFromUrl('https://x.test/a.png')).toBe('image')
    expect(inferEmbedMediaKindFromUrl('https://x.test/a.mp4')).toBe('video')
    expect(inferEmbedMediaKindFromUrl('https://x.test/a.mp3')).toBe('audio')
    expect(inferEmbedMediaKindFromUrl('https://x.test/a.pdf')).toBe('pdf')
    expect(inferEmbedMediaKindFromUrl('https://x.test/a')).toBe('unknown')
  })

  it('infers internal file kind by content type', () => {
    expect(inferEmbedMediaKindFromContentType('image/png')).toBe('image')
    expect(inferEmbedMediaKindFromContentType('video/mp4')).toBe('video')
    expect(inferEmbedMediaKindFromContentType('audio/mpeg')).toBe('audio')
    expect(inferEmbedMediaKindFromContentType('application/pdf')).toBe('pdf')
    expect(inferEmbedMediaKindFromContentType(null)).toBe('unknown')
  })
})
