import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { toast } from 'sonner'
import { reportMapActionError } from '../map-action-errors'
import { getClientErrorMessage } from '../../../../../../shared/errors/client'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

vi.mock('../../../../../../shared/errors/client', () => ({
  getClientErrorMessage: vi.fn(),
}))

describe('reportMapActionError', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
    vi.mocked(getClientErrorMessage).mockReset()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('uses the client error message when available', () => {
    vi.mocked(getClientErrorMessage).mockReturnValue('Map update denied')

    reportMapActionError(new Error('denied'), 'Failed to update map')

    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Map update denied')
  })

  it('uses the fallback message when the client error message is empty', () => {
    vi.mocked(getClientErrorMessage).mockReturnValue('')

    reportMapActionError(new Error('empty'), 'Failed to update map')

    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Failed to update map')
  })

  it.each([
    {
      result: { status: 'error', error: new Error('write failed') } as const,
      message: 'write failed',
    },
    {
      result: { status: 'unsupported', reason: 'not supported' } as const,
      message: 'not supported',
    },
    { result: { status: 'unavailable', reason: 'offline' } as const, message: 'offline' },
  ])('reports $result.status operation results', ({ result, message }) => {
    vi.mocked(getClientErrorMessage).mockImplementation((error) =>
      error instanceof Error ? error.message : '',
    )

    reportMapActionError(result, 'Failed to update map')

    expect(toast.error).toHaveBeenCalledExactlyOnceWith(message)
    expect(consoleErrorSpy).toHaveBeenCalledOnce()
  })
})
