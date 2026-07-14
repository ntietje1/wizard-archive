import { describe, expect, it } from 'vite-plus/test'
import { renderHook } from '@testing-library/react'
import { useNameValidation } from '../use-name-validation'

function renderNameValidation(name: string, isActive = true) {
  return renderHook(() => useNameValidation({ name, initialName: 'Initial', isActive }))
}

describe('useNameValidation', () => {
  it('accepts blank and filesystem-reserved natural titles', () => {
    expect(renderNameValidation('   ').result.current.hasError).toBe(false)
    expect(renderNameValidation('./a\\b:*?"<>[]#|').result.current.hasError).toBe(false)
  })

  it('rejects titles over 255 Unicode scalars', () => {
    const result = renderNameValidation('🎉'.repeat(256)).result.current
    expect(result.hasError).toBe(true)
    expect(result.validationError).toMatch(/255 scalars/)
  })

  it('rejects malformed UTF-16', () => {
    expect(renderNameValidation('\ud800').result.current.hasError).toBe(true)
  })

  it('does not validate an inactive editor', () => {
    expect(renderNameValidation('\ud800', false).result.current.hasError).toBe(false)
  })
})
