import { describe, expect, it } from 'vitest'
import {
  FILE_UPLOAD_ACCEPT_PATTERN,
  MAX_FILE_SIZE,
  isMediaFile,
  isTextFile,
  validateFileUpload,
} from 'shared/storage/validation'

describe('isMediaFile', () => {
  it('returns true for image, video, audio, and pdf', () => {
    expect(isMediaFile('image/png')).toBe(true)
    expect(isMediaFile('video/mp4')).toBe(true)
    expect(isMediaFile('audio/mpeg')).toBe(true)
    expect(isMediaFile('application/pdf')).toBe(true)
  })

  it('returns false for text and other types', () => {
    expect(isMediaFile('text/plain')).toBe(false)
    expect(isMediaFile('application/zip')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isMediaFile(null)).toBe(false)
  })

  it('detects media file extensions when content type is missing', () => {
    expect(isMediaFile('', 'portrait.png')).toBe(true)
    expect(isMediaFile(null, 'map.webp')).toBe(true)
    expect(isMediaFile(null, 'archive.zip')).toBe(false)
  })

  it('uses media file extensions when a generic content type is present', () => {
    expect(isMediaFile('application/octet-stream', 'battle-map.webp')).toBe(true)
    expect(isMediaFile('application/octet-stream', 'archive.zip')).toBe(false)
  })
})

describe('isTextFile', () => {
  it('detects text content types', () => {
    expect(isTextFile('text/plain')).toBe(true)
    expect(isTextFile('text/markdown')).toBe(true)
  })

  it('detects text file extensions when content type is not text', () => {
    expect(isTextFile('application/octet-stream', 'readme.txt')).toBe(true)
    expect(isTextFile('application/octet-stream', 'notes.md')).toBe(true)
  })

  it('returns false for non-text files', () => {
    expect(isTextFile('image/png')).toBe(false)
    expect(isTextFile('image/png', 'photo.png')).toBe(false)
  })

  it('returns false for null content type and no filename', () => {
    expect(isTextFile(null)).toBe(false)
  })

  it('detects text extension when content type is null', () => {
    expect(isTextFile(null, 'readme.txt')).toBe(true)
    expect(isTextFile(null, 'notes.md')).toBe(true)
  })
})

describe('validateFileUpload', () => {
  it('offers media extension fallbacks to file pickers', () => {
    expect(FILE_UPLOAD_ACCEPT_PATTERN).toContain('.png')
    expect(FILE_UPLOAD_ACCEPT_PATTERN).toContain('.webp')
  })

  it('accepts valid file', () => {
    expect(validateFileUpload('image/png', 1024)).toEqual({ valid: true })
  })

  it('rejects invalid type before checking size', () => {
    const result = validateFileUpload('application/zip', 1)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('valid file type')
    }
  })

  it('rejects oversized file with valid type', () => {
    const result = validateFileUpload('image/png', MAX_FILE_SIZE + 1)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('less than')
    }
  })
})
