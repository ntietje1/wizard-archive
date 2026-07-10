import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { FolderDeleteConfirmDialog } from '../folder-confirm-dialog'

const handleErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../../../errors/handle-error', () => ({
  handleError: handleErrorMock,
}))

describe('FolderDeleteConfirmDialog', () => {
  beforeEach(() => {
    handleErrorMock.mockReset()
  })

  it('trashes the folder after showing the supplied descendant count', async () => {
    const onTrash = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <FolderDeleteConfirmDialog
        descendantCount={2}
        isDeleting
        onClose={onClose}
        onTrash={onTrash}
      />,
    )

    expect(screen.getByText('This folder contains 2 items!')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Move to Trash' }))

    expect(onTrash).toHaveBeenCalledExactlyOnceWith()
    expect(onClose).toHaveBeenCalledExactlyOnceWith()
  })

  it('confirms after the folder is moved to trash successfully', async () => {
    const onTrash = vi.fn().mockResolvedValue(undefined)
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <FolderDeleteConfirmDialog
        descendantCount={1}
        isDeleting
        onClose={onClose}
        onConfirm={onConfirm}
        onTrash={onTrash}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Move to Trash' }))

    expect(onTrash).toHaveBeenCalledExactlyOnceWith()
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith()
    expect(onClose).toHaveBeenCalledExactlyOnceWith()
  })

  it('keeps the dialog open when trashing fails', async () => {
    const error = new Error('trash failed')
    const onTrash = vi.fn().mockRejectedValue(error)
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <FolderDeleteConfirmDialog
        descendantCount={1}
        isDeleting
        onClose={onClose}
        onConfirm={onConfirm}
        onTrash={onTrash}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Move to Trash' }))

    expect(onTrash).toHaveBeenCalledExactlyOnceWith()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(handleErrorMock).toHaveBeenCalledExactlyOnceWith(error, 'Failed to move folder to trash')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('blocks duplicate trash requests while the first request is pending', async () => {
    const trashRequest = createDeferred<void>()
    const onTrash = vi.fn(() => trashRequest.promise)
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <FolderDeleteConfirmDialog
        descendantCount={0}
        isDeleting
        onClose={onClose}
        onTrash={onTrash}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Move to Trash' }))

    const pendingButton = screen.getByRole('button', { name: 'Processing...' })
    expect(pendingButton).toBeDisabled()

    await user.click(pendingButton)

    expect(onTrash).toHaveBeenCalledExactlyOnceWith()
    expect(onClose).not.toHaveBeenCalled()

    trashRequest.resolve()
    await screen.findByRole('button', { name: 'Move to Trash' })

    expect(onClose).toHaveBeenCalledExactlyOnceWith()
  })
})

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
