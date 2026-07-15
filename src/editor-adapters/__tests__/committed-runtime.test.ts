import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useCommittedRuntime } from '../committed-runtime'

describe('useCommittedRuntime', () => {
  it('replaces the disposed instance across the setup-cleanup-setup lifecycle', () => {
    const starts: Array<ReturnType<typeof vi.fn>> = []
    const disposals: Array<ReturnType<typeof vi.fn>> = []
    let nextRuntime = 0
    const factory = vi.fn(() => {
      const start = vi.fn()
      const dispose = vi.fn()
      starts.push(start)
      disposals.push(dispose)
      return { runtime: ++nextRuntime, start, dispose }
    })
    const first = renderHook(() => useCommittedRuntime(factory))

    expect(first.result.current).toBe(1)
    expect(starts[0]).toHaveBeenCalledOnce()
    first.unmount()
    expect(disposals[0]).toHaveBeenCalledOnce()

    const second = renderHook(() => useCommittedRuntime(factory))
    expect(second.result.current).toBe(2)
    expect(starts[1]).toHaveBeenCalledOnce()
    expect(factory).toHaveBeenCalledTimes(2)
    second.unmount()
    expect(disposals[1]).toHaveBeenCalledOnce()
  })

  it('does not construct a runtime for an aborted render', () => {
    const factory = vi.fn(() => ({ runtime: 1, start: vi.fn(), dispose: vi.fn() }))

    expect(() =>
      renderHook(() => {
        useCommittedRuntime(factory)
        throw new TypeError('abort')
      }),
    ).toThrow('abort')
    expect(factory).not.toHaveBeenCalled()
  })
})
