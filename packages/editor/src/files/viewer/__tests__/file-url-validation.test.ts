import { describe, expect, it } from 'vite-plus/test'
import { isValidFileUrl } from '../file-url-validation'

describe('isValidFileUrl', () => {
  it('accepts https storage URLs and rejects insecure remote URLs', () => {
    expect(isValidFileUrl('https://example.com/file.png')).toBe(true)
    expect(isValidFileUrl('http://example.com/file.png')).toBe(false)
  })

  it('allows object URLs only when the caller opts in', () => {
    expect(isValidFileUrl('blob:https://example.com/object')).toBe(false)
    expect(isValidFileUrl('blob:https://example.com/object', { allowObjectUrl: true })).toBe(true)
  })

  it('allows data URLs only when the caller opts in', () => {
    expect(isValidFileUrl('data:text/plain,hello')).toBe(false)
    expect(isValidFileUrl('data:text/plain,hello', { allowDataUrl: true })).toBe(true)
  })

  it('rejects malformed URLs through the parser boundary', () => {
    expect(isValidFileUrl('https://')).toBe(false)
    expect(isValidFileUrl('not a url')).toBe(false)
  })

  it('rejects browser-valid local and executable URL schemes', () => {
    expect(isValidFileUrl('javascript:alert(1)')).toBe(false)
    expect(isValidFileUrl('file:///C:/campaign/secret.pdf')).toBe(false)
  })
})
