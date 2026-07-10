import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { toast } from 'sonner'
import { reportMapPinCreationResult } from '../map-pin-creation-feedback'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('reportMapPinCreationResult', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
  })

  it('rejects invalid creation results', () => {
    expect(() => reportMapPinCreationResult(null, 1)).toThrow(
      'Map pin creation returned an invalid result',
    )
  })

  it('reports when no requested pins were placed', () => {
    expect(reportMapPinCreationResult([], 2)).toBe(false)

    expect(toast.error).toHaveBeenCalledExactlyOnceWith('No pins were placed')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('reports partial placement with singular placed text', () => {
    expect(reportMapPinCreationResult(['pin-1'], 2)).toBe(true)

    expect(toast.success).toHaveBeenCalledExactlyOnceWith('1 pin placed on map, 1 skipped')
  })

  it('reports full placement with singular and plural messages', () => {
    expect(reportMapPinCreationResult(['pin-1'], 1)).toBe(true)
    expect(reportMapPinCreationResult(['pin-1', 'pin-2'], 2)).toBe(true)

    expect(toast.success).toHaveBeenNthCalledWith(1, 'Pin placed on map')
    expect(toast.success).toHaveBeenNthCalledWith(2, '2 pins placed on map')
  })
})
