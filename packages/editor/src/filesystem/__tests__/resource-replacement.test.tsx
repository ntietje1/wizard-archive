import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { completedResourceOperation } from '../transaction-contract'
import { useResourceReplacementController } from '../resource-replacement'

describe('useResourceReplacementController', () => {
  it('keeps replacement pending until all concurrent selections settle', async () => {
    let resolveFirst!: () => void
    let resolveSecond!: () => void
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })
    const second = new Promise<void>((resolve) => {
      resolveSecond = resolve
    })
    const replace = vi.fn((file: File) =>
      (file.name === 'first.txt' ? first : second).then(() =>
        completedResourceOperation({ kind: 'fileReplaced', affectedCount: 1 }),
      ),
    )

    const { result } = renderHook(() =>
      useResourceReplacementController({
        allowSelectionWhilePending: true,
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

    act(() => {
      result.current.attemptReplacement(new File(['first'], 'first.txt'))
      result.current.attemptReplacement(new File(['second'], 'second.txt'))
    })

    expect(replace).toHaveBeenCalledTimes(2)
    expect(result.current.isReplacing).toBe(true)

    await act(async () => {
      resolveFirst()
      await first
    })
    expect(result.current.isReplacing).toBe(true)

    await act(async () => {
      resolveSecond()
      await second
    })
    expect(result.current.isReplacing).toBe(false)
  })
})
