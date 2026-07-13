import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { completedResourceOperation } from '../transaction-contract'
import { useResourceReplacementController } from '../resource-replacement'

describe('useResourceReplacementController', () => {
  it('rejects another replacement while one is pending', async () => {
    let resolveReplacement!: () => void
    const replacement = new Promise<void>((resolve) => {
      resolveReplacement = resolve
    })
    const replace = vi.fn(() =>
      replacement.then(() =>
        completedResourceOperation({ kind: 'fileReplaced', affectedCount: 1 }),
      ),
    )

    const { result } = renderHook(() =>
      useResourceReplacementController({
        disabledMessage: 'Disabled',
        enabled: true,
        failureMessage: 'Failed',
        inProgressMessage: 'In progress',
        replace,
        successMessage: 'Replaced',
        toastRejectedFiles: false,
        validateFile: () => ({ valid: true }),
      }),
    )

    let secondResult: ReturnType<typeof result.current.attemptReplacement>
    act(() => {
      result.current.attemptReplacement(new File(['first'], 'first.txt'))
      secondResult = result.current.attemptReplacement(new File(['second'], 'second.txt'))
    })

    expect(secondResult!).toEqual({ valid: false, error: 'In progress' })
    expect(replace).toHaveBeenCalledOnce()
    expect(result.current.isReplacing).toBe(true)

    await act(async () => {
      resolveReplacement()
      await replacement
    })
    expect(result.current.isReplacing).toBe(false)
  })

  it('keeps the active replacement while another attempt is rejected', async () => {
    let resolveReplacement!: () => void
    const replacement = new Promise<void>((resolve) => {
      resolveReplacement = resolve
    })
    const replace = vi.fn(() =>
      replacement.then(() =>
        completedResourceOperation({ kind: 'fileReplaced', affectedCount: 1 }),
      ),
    )
    const { result } = renderHook(() =>
      useResourceReplacementController({
        disabledMessage: 'Disabled',
        enabled: true,
        failureMessage: 'Failed',
        inProgressMessage: 'In progress',
        replace,
        successMessage: 'Replaced',
        toastRejectedFiles: false,
        validateFile: (file) =>
          file.name === 'invalid.txt' ? { valid: false, error: 'Invalid' } : { valid: true },
      }),
    )

    act(() => {
      result.current.attemptReplacement(new File(['valid'], 'valid.txt'))
      expect(result.current.attemptReplacement(new File(['invalid'], 'invalid.txt'))).toEqual({
        valid: false,
        error: 'In progress',
      })
    })

    expect(result.current.isReplacing).toBe(true)
    expect(replace).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveReplacement()
      await replacement
    })
    expect(result.current.isReplacing).toBe(false)
  })
})
