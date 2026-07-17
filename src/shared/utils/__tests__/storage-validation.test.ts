import { describe, expect, it } from 'vite-plus/test'
import { validateFileUploadSize } from 'shared/storage/validation'

describe('validateFileUploadSize', () => {
  it('accepts retained bytes independently of file metadata', () => {
    expect(validateFileUploadSize(1024)).toEqual({ valid: true })
  })

  it('rejects files larger than the configured limit', () => {
    expect(validateFileUploadSize(101 * 1024 * 1024)).toMatchObject({ valid: false })
  })
})
