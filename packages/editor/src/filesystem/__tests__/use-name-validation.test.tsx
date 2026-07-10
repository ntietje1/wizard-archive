import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { act, renderHook } from '@testing-library/react'
import { useNameValidation } from '../use-name-validation'

const mockValidateName = vi.fn()

function renderNameValidation(overrides = {}) {
  return renderHook(() =>
    useNameValidation({
      name: 'Test',
      initialName: 'Initial',
      isActive: true,
      parentId: null,
      validateName: mockValidateName,
      ...overrides,
    }),
  )
}

describe('useNameValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockValidateName.mockClear()
    mockValidateName.mockReturnValue({ valid: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns no error when name matches initial name', () => {
    const { result } = renderNameValidation({
      name: 'Same Name',
      initialName: 'Same Name',
    })

    expect(result.current.hasError).toBe(false)
    expect(result.current.validationError).toBeUndefined()
  })

  it('returns error for empty name', () => {
    const { result } = renderNameValidation({
      name: '   ',
      initialName: 'Original',
    })

    expect(result.current.hasError).toBe(true)
    expect(result.current.validationError).toBe('Name is required')
  })

  it('returns error for name with forbidden characters', () => {
    const { result } = renderNameValidation({
      name: 'bad/name',
      initialName: 'Original',
    })

    expect(result.current.hasError).toBe(true)
    expect(result.current.validationError).toMatch(/cannot contain/)
  })

  it('does not report invalid names as unique', () => {
    mockValidateName.mockReturnValue({ valid: true })

    const { result } = renderNameValidation({
      name: 'bad/name',
      initialName: 'Original',
    })

    expect(result.current.hasError).toBe(true)
    expect(result.current.isUnique).toBe(false)
    expect(result.current.isNotUnique).toBe(false)
  })

  it('returns error for name exceeding 255 characters', () => {
    const { result } = renderNameValidation({
      name: 'a'.repeat(256),
      initialName: 'Original',
    })

    expect(result.current.hasError).toBe(true)
    expect(result.current.validationError).toMatch(/255 characters/)
  })

  it('returns error for name starting with dot', () => {
    const { result } = renderNameValidation({
      name: '.hidden',
      initialName: 'Original',
    })

    expect(result.current.hasError).toBe(true)
    expect(result.current.validationError).toMatch(/dot/)
  })

  it('debounces uniqueness check', () => {
    const { result, rerender } = renderHook(
      ({ name }: { name: string }) =>
        useNameValidation({
          name,
          initialName: 'Original',
          isActive: true,
          parentId: null,
          validateName: mockValidateName,
        }),
      { initialProps: { name: 'Original' } },
    )

    mockValidateName.mockReturnValue({
      valid: false,
      error: 'An item with this name already exists here',
    })

    rerender({ name: 'Duplicate' })

    expect(result.current.isNotUnique).toBe(false)

    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(result.current.isNotUnique).toBe(true)
    expect(result.current.hasError).toBe(true)
    expect(result.current.validationError).toBe('An item with this name already exists here')
  })

  it('validates each debounced current name once', () => {
    const { rerender } = renderHook(
      ({ name }: { name: string }) =>
        useNameValidation({
          name,
          initialName: 'Original',
          isActive: true,
          parentId: null,
          validateName: mockValidateName,
        }),
      { initialProps: { name: 'Original' } },
    )

    rerender({ name: 'First' })

    act(() => {
      vi.runOnlyPendingTimers()
    })

    rerender({ name: 'Second' })

    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(mockValidateName.mock.calls.map(([name]) => name)).toEqual(['First', 'Second'])
  })

  it('returns no errors when not active', () => {
    const { result } = renderNameValidation({
      name: 'bad/name',
      initialName: 'Original',
      isActive: false,
    })

    expect(result.current.hasError).toBe(false)
    expect(result.current.validationError).toBeUndefined()
  })

  it('checkNameUnique returns undefined for valid unique names', () => {
    mockValidateName.mockReturnValue({ valid: true })

    const { result } = renderNameValidation()

    expect(result.current.checkNameUnique('Valid Name')).toBeUndefined()
  })

  it('checkNameUnique returns error for duplicate names', () => {
    mockValidateName.mockReturnValue({
      valid: false,
      error: 'An item with this name already exists here',
    })

    const { result } = renderNameValidation()

    expect(result.current.checkNameUnique('Duplicate')).toBe(
      'An item with this name already exists here',
    )
  })
})
