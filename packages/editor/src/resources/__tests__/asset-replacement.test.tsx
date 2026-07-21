import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { FileResourceSource } from '../content-session-contract'
import { useAssetReplacement } from '../asset-replacement'

type ReplacementResult =
  | Readonly<{ status: 'completed' }>
  | Readonly<{ status: 'retryable' | 'rejected'; reason: string }>

type Replace = (target: string, source: FileResourceSource) => Promise<ReplacementResult>

describe('useAssetReplacement', () => {
  it('retries the exact captured candidate after an uncertain response', async () => {
    const replace = vi
      .fn<Replace>()
      .mockResolvedValueOnce({ status: 'retryable', reason: 'response_lost' })
      .mockResolvedValueOnce({ status: 'completed' })
    render(<ReplacementHarness owner={replace} replace={replace} targetKey="first" />)

    fireEvent.click(screen.getByRole('button', { name: 'Choose replacement' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Replacement failed.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(2))
    expect(replace.mock.calls[1]![0]).toBe(replace.mock.calls[0]![0])
    expect(replace.mock.calls[1]![1]).toBe(replace.mock.calls[0]![1])
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('requires a fresh candidate after a rejected replacement', async () => {
    const replace = vi
      .fn<Replace>()
      .mockResolvedValueOnce({ status: 'rejected', reason: 'version_conflict' })
      .mockResolvedValueOnce({ status: 'completed' })
    render(<ReplacementHarness owner={replace} replace={replace} targetKey="first" />)

    fireEvent.click(screen.getByRole('button', { name: 'Choose replacement' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Replacement failed.')
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Choose replacement' }))
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(2))
    expect(replace.mock.calls[1]![1]).not.toBe(replace.mock.calls[0]![1])
  })

  it('ignores a late settlement after the immutable target changes', async () => {
    let settle!: (result: ReplacementResult) => void
    const replace = vi.fn<Replace>(() => new Promise((resolve) => (settle = resolve)))
    const owner = {}
    const view = render(<ReplacementHarness owner={owner} replace={replace} targetKey="first" />)

    fireEvent.click(screen.getByRole('button', { name: 'Choose replacement' }))
    await waitFor(() => expect(replace).toHaveBeenCalledOnce())
    view.rerender(<ReplacementHarness owner={owner} replace={replace} targetKey="second" />)
    await act(async () => {
      settle({ status: 'retryable', reason: 'response_lost' })
      await Promise.resolve()
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(replace.mock.calls[0]![0]).toBe('first')
  })
})

function ReplacementHarness({
  owner,
  replace,
  targetKey,
}: {
  owner: object
  replace: Replace
  targetKey: string
}) {
  const replacement = useAssetReplacement({
    target: { key: targetKey, owner, value: targetKey },
    replace,
    validate: () => null,
    message: () => 'Replacement failed.',
    retryable: (result) => result.status === 'retryable',
    readingMessage: 'Reading replacement…',
    uploadingMessage: 'Uploading replacement…',
    readFailureMessage: 'Could not read replacement.',
    responseLostMessage: 'Replacement response was lost.',
  })

  return (
    <>
      <button type="button" onClick={() => replacement.choose(replacementFile())}>
        Choose replacement
      </button>
      {replacement.message && (
        <p role={replacement.failed ? 'alert' : 'status'}>{replacement.message}</p>
      )}
      {replacement.canRetry && (
        <button type="button" onClick={replacement.retry}>
          Try again
        </button>
      )}
    </>
  )
}

function replacementFile() {
  const bytes = new TextEncoder().encode('replacement')
  const file = new File([bytes], 'replacement.bin', { type: 'application/octet-stream' })
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer) })
  return file
}
