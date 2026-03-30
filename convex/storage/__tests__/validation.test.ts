import { describe, expect, it } from 'vitest'
import {
  MAX_FILE_SIZE,
  isAllowedContentType,
  isMediaFile,
  isTextFile,
  validateFileSize,
  validateFileType,
  validateFileUpload,
} from '../validation'

describe('isAllowedContentType', () => {
  it('allows image types', () => {
    expect(isAllowedContentType('image/png')).toBe(true)
    expect(isAllowedContentType('image/jpeg')).toBe(true)
    expect(isAllowedContentType('image/webp')).toBe(true)
  })

  it('allows video types', () => {
    expect(isAllowedContentType('video/mp4')).toBe(true)
    expect(isAllowedContentType('video/webm')).toBe(true)
  })

  it('allows audio types', () => {
    expect(isAllowedContentType('audio/mpeg')).toBe(true)
    expect(isAllowedContentType('audio/ogg')).toBe(true)
  })

  it('allows text types', () => {
    expect(isAllowedContentType('text/plain')).toBe(true)
    expect(isAllowedContentType('text/markdown')).toBe(true)
  })

  it('allows application/pdf', () => {
    expect(isAllowedContentType('application/pdf')).toBe(true)
  })

  it('rejects disallowed types', () => {
    expect(isAllowedContentType('application/zip')).toBe(false)
    expect(isAllowedContentType('application/javascript')).toBe(false)
    expect(isAllowedContentType('application/x-executable')).toBe(false)
  })

  it('rejects null', () => {
    expect(isAllowedContentType(null)).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isAllowedContentType('Image/PNG')).toBe(true)
    expect(isAllowedContentType('APPLICATION/PDF')).toBe(true)
  })
})

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

describe('validateFileSize', () => {
  it('accepts files under the limit', () => {
    expect(validateFileSize(1024)).toEqual({ valid: true })
    expect(validateFileSize(MAX_FILE_SIZE)).toEqual({ valid: true })
  })

  it('rejects files over the limit', () => {
    const result = validateFileSize(MAX_FILE_SIZE + 1)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('less than')
    }
  })

  it('supports custom max size', () => {
    const limit = 1024
    expect(validateFileSize(512, limit)).toEqual({ valid: true })
    const result = validateFileSize(2048, limit)
    expect(result.valid).toBe(false)
  })
})

describe('validateFileType', () => {
  it('accepts media files', () => {
    expect(validateFileType('image/png')).toEqual({ valid: true })
    expect(validateFileType('application/pdf')).toEqual({ valid: true })
  })

  it('accepts text files by extension', () => {
    expect(validateFileType('application/octet-stream', 'notes.md')).toEqual({
      valid: true,
    })
  })

  it('rejects disallowed types', () => {
    const result = validateFileType('application/zip', 'archive.zip')
    expect(result.valid).toBe(false)
  })

  it('rejects null content type without text extension', () => {
    const result = validateFileType(null)
    expect(result.valid).toBe(false)
  })
})

describe('validateFileUpload', () => {
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
