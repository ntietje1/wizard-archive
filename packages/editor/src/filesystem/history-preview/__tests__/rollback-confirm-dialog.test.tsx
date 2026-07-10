import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { RollbackState } from '../../history-types'
import { RollbackConfirmDialog } from '../rollback-confirm-dialog'

describe('RollbackConfirmDialog', () => {
  it('renders ready details and delegates restore', () => {
    const onOpenChange = vi.fn()
    const onRestore = vi.fn()

    render(
      <RollbackConfirmDialog
        state={{
          status: 'ready',
          entryTime: Date.UTC(2026, 0, 1),
          isRestoring: false,
        }}
        onOpenChange={onOpenChange}
        onRestore={onRestore}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    expect(screen.getByText('Restore this version?')).toBeInTheDocument()
    expect(onRestore).toHaveBeenCalled()
  })

  it('keeps the confirmation visible after restore is selected', () => {
    const onRestore = vi.fn()

    function ControlledDialog() {
      const [state, setState] = useState<RollbackState>({
        status: 'ready',
        entryTime: Date.UTC(2026, 0, 1),
        isRestoring: false,
      })
      return (
        <RollbackConfirmDialog
          state={state}
          onOpenChange={(open) => {
            if (!open) setState({ status: 'closed', isRestoring: false })
          }}
          onRestore={onRestore}
        />
      )
    }

    render(<ControlledDialog />)

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    expect(screen.getByText('Restore this version?')).toBeInTheDocument()
    expect(onRestore).toHaveBeenCalledOnce()
  })

  it('shows restoring progress without enabling another restore', () => {
    render(
      <RollbackConfirmDialog
        state={{
          status: 'ready',
          entryTime: Date.UTC(2026, 0, 1),
          isRestoring: true,
        }}
        onOpenChange={vi.fn()}
        onRestore={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Restoring/ })).toBeDisabled()
  })

  it('shows the error copy when rollback details cannot load', () => {
    render(
      <RollbackConfirmDialog
        state={{ status: 'error', isRestoring: false }}
        onOpenChange={vi.fn()}
        onRestore={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Failed to load version details. Please close and try again.'),
    ).toBeInTheDocument()
  })
})
