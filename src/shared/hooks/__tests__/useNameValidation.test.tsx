import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  NAME_VALIDATION_DEBOUNCE_MS,
  useNameValidation,
} from '~/shared/hooks/useNameValidation'
import { testId } from '~/test/helpers/test-id'

const mockValidateName = vi.fn()

vi.mock('~/features/sidebar/hooks/useSidebarValidation', () => ({
  useSidebarValidation: () => ({
    validateName: mockValidateName,
    getSiblings: vi.fn(() => []),
    canMoveToParent: vi.fn(() => true),
    getDefaultName: vi.fn(() => 'New Note'),
  }),
}))

const campaignId = testId<'campaigns'>('campaign_1')

function renderNameValidation(overrides = {}) {
  return renderHook(() =>
    useNameValidation({
      name: 'Test',
      initialName: 'Initial',
      isActive: true,
      campaignId,
      parentId: null,
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

  it('debounces uniqueness check', async () => {
    const { result, rerender } = renderHook(
      ({ name }: { name: string }) =>
        useNameValidation({
          name,
          initialName: 'Original',
          isActive: true,
          campaignId,
          parentId: null,
        }),
      { initialProps: { name: 'Original' } },
    )

    mockValidateName.mockReturnValue({
      valid: false,
      error: 'An item with this name already exists here',
    })

    rerender({ name: 'Duplicate' })

    expect(result.current.isNotUnique).toBe(false)

    await act(() => {
      vi.advanceTimersByTime(NAME_VALIDATION_DEBOUNCE_MS)
    })

    expect(result.current.isNotUnique).toBe(true)
    expect(result.current.hasError).toBe(true)
    expect(result.current.validationError).toBe(
      'An item with this name already exists here',
    )
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
