import { describe, expect, it } from 'vite-plus/test'
import { validateFileUpload } from 'shared/storage/validation'

describe('validateFileUpload', () => {
  it.each([
    ['image/png', undefined],
    ['video/mp4', undefined],
    ['audio/mpeg', undefined],
    ['application/pdf', undefined],
    ['application/octet-stream', 'battle-map.webp'],
    ['application/octet-stream', 'notes.md'],
  ])('accepts supported content %s', (contentType, fileName) => {
    expect(validateFileUpload(contentType, 1024, fileName)).toEqual({ valid: true })
  })

  it('rejects unsupported content', () => {
    expect(validateFileUpload('application/zip', 1)).toMatchObject({ valid: false })
  })

  it('rejects files larger than the configured limit', () => {
    expect(validateFileUpload('image/png', 101 * 1024 * 1024)).toMatchObject({ valid: false })
  })
})
