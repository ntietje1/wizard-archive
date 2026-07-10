import { describe, expect, it, vi } from 'vite-plus/test'
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
})
