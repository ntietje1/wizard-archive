import { describe, expect, it, vi } from 'vite-plus/test'
import { reportResourceCommandFailure } from '../report-command-result'

describe('reportResourceCommandFailure', () => {
  it('reports typed rejected, unavailable, unsupported, and error results', () => {
    const reportError = vi.fn()

    expect(
      reportResourceCommandFailure(
        { status: 'rejected', reason: 'stale-history' },
        'History failed',
        reportError,
      ),
    ).toBe(true)
    expect(
      reportResourceCommandFailure(
        { status: 'unavailable', reason: 'history_unsupported' },
        'History failed',
        reportError,
      ),
    ).toBe(true)
    expect(
      reportResourceCommandFailure(
        { status: 'unsupported', reason: 'adapter_unsupported' },
        'History failed',
        reportError,
      ),
    ).toBe(true)
    const error = new Error('mutation failed')
    expect(
      reportResourceCommandFailure({ status: 'error', error }, 'History failed', reportError),
    ).toBe(true)

    expect(reportError).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ message: 'Filesystem history changed. Try again.' }),
      'History failed',
    )
    expect(reportError).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ message: 'Operation is unavailable: history unsupported' }),
      'History failed',
    )
    expect(reportError).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ message: 'Operation is not supported: adapter unsupported' }),
      'History failed',
    )
    expect(reportError).toHaveBeenNthCalledWith(4, error, 'History failed')
  })

  it('leaves completed, decision, pending, and no-op results with their owning UI', () => {
    const reportError = vi.fn()

    expect(
      reportResourceCommandFailure(
        { status: 'needsDecision', conflicts: [] },
        'Operation failed',
        reportError,
      ),
    ).toBe(false)
    expect(
      reportResourceCommandFailure(
        { status: 'pending', reason: 'folder_confirmation_required' },
        'Operation failed',
        reportError,
      ),
    ).toBe(false)
    expect(
      reportResourceCommandFailure(
        { status: 'noop', reason: 'no_items' },
        'Operation failed',
        reportError,
      ),
    ).toBe(false)
    expect(reportError).not.toHaveBeenCalled()
  })
})
