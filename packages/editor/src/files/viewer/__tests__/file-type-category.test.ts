import { describe, expect, it } from 'vite-plus/test'
import { getFileTypeCategory } from '../../file-type-category'

describe('getFileTypeCategory', () => {
  it('uses the filename when MIME metadata is missing or generic', () => {
    expect(getFileTypeCategory(null, 'Rules.pdf')).toBe('pdf')
    expect(getFileTypeCategory('application/octet-stream', 'Theme.ogg')).toBe('audio')
    expect(getFileTypeCategory(undefined, 'portrait.webp')).toBe('image')
    expect(getFileTypeCategory('application/octet-stream', 'session.mov')).toBe('video')
  })

  it('recognizes current media extensions when browser MIME data is generic', () => {
    expect(getFileTypeCategory('application/octet-stream', 'battle-map.avif')).toBe('image')
    expect(getFileTypeCategory('application/octet-stream', 'portrait.heic')).toBe('image')
    expect(getFileTypeCategory('application/octet-stream', 'cutscene.mkv')).toBe('video')
    expect(getFileTypeCategory('application/octet-stream', 'ambience.opus')).toBe('audio')
  })

  it('normalizes MIME parameters before classifying PDFs', () => {
    expect(getFileTypeCategory('application/pdf; charset=binary', null)).toBe('pdf')
  })

  it('classifies common MIME families and unknown files', () => {
    expect(getFileTypeCategory('image/svg+xml', null)).toBe('image')
    expect(getFileTypeCategory('video/webm', null)).toBe('video')
    expect(getFileTypeCategory('audio/mpeg', null)).toBe('audio')
    expect(getFileTypeCategory('text/plain', 'notes.txt')).toBe('file')
  })
})
