import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmationDialog } from '../confirmation-dialog'

describe('ConfirmationDialog', () => {
  it('gates confirm and close actions while disabled or loading', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    const { rerender } = renderConfirmationDialog({ onClose, onConfirm, disabled: true })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)

    onClose.mockClear()
    rerender(renderConfirmationDialogElement({ onClose, onConfirm, isLoading: true }))

    expect(screen.getByText('Processing...')).toHaveAttribute('aria-live', 'polite')
    fireEvent.click(screen.getByRole('button', { name: /Processing/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    rerender(renderConfirmationDialogElement({ onClose, onConfirm }))

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})

function renderConfirmationDialog({
  disabled = false,
  isLoading = false,
  onClose,
  onConfirm,
}: {
  disabled?: boolean
  isLoading?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return render(renderConfirmationDialogElement({ disabled, isLoading, onClose, onConfirm }))
}

function renderConfirmationDialogElement({
  disabled = false,
  isLoading = false,
  onClose,
  onConfirm,
}: {
  disabled?: boolean
  isLoading?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ConfirmationDialog
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete item"
      description="This cannot be undone."
      disabled={disabled}
      isLoading={isLoading}
    />
  )
}
