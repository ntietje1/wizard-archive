import { describe, expect, it } from 'vitest'
import { overlapsSelection } from '~/features/editor/utils/link-extension-utils'

describe('overlapsSelection', () => {
  it('detects overlap when selection is inside match', () => {
    expect(overlapsSelection(0, 10, 3, 7)).toBe(true)
  })

  it('detects overlap when selection starts before match', () => {
    expect(overlapsSelection(5, 10, 3, 7)).toBe(true)
  })

  it('detects overlap when selection ends after match', () => {
    expect(overlapsSelection(0, 5, 3, 7)).toBe(true)
  })

  it('detects overlap at exact boundaries', () => {
    expect(overlapsSelection(0, 5, 5, 10)).toBe(true)
  })

  it('returns false for adjacent but non-touching ranges', () => {
    expect(overlapsSelection(0, 4, 5, 10)).toBe(false)
  })

  it('returns false when no overlap', () => {
    expect(overlapsSelection(0, 3, 5, 10)).toBe(false)
  })

  it('returns true for identical ranges', () => {
    expect(overlapsSelection(5, 10, 5, 10)).toBe(true)
  })
})
