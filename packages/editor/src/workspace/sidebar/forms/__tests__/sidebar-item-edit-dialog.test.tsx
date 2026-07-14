import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ReactNode } from 'react'
import { createFolder, createNote } from '../../../../test/sidebar-item-factory'
import { SidebarItemEditDialog } from '../sidebar-item-edit-dialog'

const handleErrorMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const nameValidationState = vi.hoisted(() => ({
  debouncedName: null as string | null,
  validationError: null as string | null,
}))

vi.mock('@wizard-archive/ui/components/form-dialog', () => ({
  FormDialog: ({ children, isOpen }: { children: ReactNode; isOpen: boolean }) =>
    isOpen ? (
      <dialog open aria-label="Edit item">
        {children}
      </dialog>
    ) : null,
}))

vi.mock('../../../../filesystem/use-name-validation', () => ({
  useNameValidation: ({ name }: { name: string }) => ({
    debouncedName: nameValidationState.debouncedName ?? name.trim(),
    validationError: nameValidationState.validationError,
  }),
}))

vi.mock('../../../../errors/handle-error', () => ({
  handleError: handleErrorMock,
}))

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock },
}))

describe('SidebarItemEditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nameValidationState.debouncedName = null
    nameValidationState.validationError = null
  })

  it('refreshes draft values from the current item when reopened for another item', () => {
    const first = createNote({ name: 'First note' })
    const second = createFolder({ name: 'Second folder' })
    const editItem = vi.fn()
    const onClose = vi.fn()
    const { rerender } = render(
      <SidebarItemEditDialog item={first} isOpen={true} onClose={onClose} editItem={editItem} />,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsaved draft' } })

    rerender(
      <SidebarItemEditDialog item={second} isOpen={true} onClose={onClose} editItem={editItem} />,
    )

    expect(screen.getByLabelText('Name')).toHaveValue('Second folder')
  })

  it('labels icon and color picker triggers with the visible field labels', () => {
    const item = createNote({ name: 'Labeled note' })

    render(<SidebarItemEditDialog item={item} isOpen={true} onClose={vi.fn()} editItem={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Icon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Color' })).toBeInTheDocument()
  })

  it('saves the trimmed name, selected icon, and selected color', async () => {
    const user = userEvent.setup()
    const item = createNote({ name: 'Old note' })
    const editItem = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <SidebarItemEditDialog item={item} isOpen={true} onClose={onClose} editItem={editItem} />,
    )

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), '  New note  ')
    await user.click(screen.getByRole('button', { name: 'Icon' }))
    await user.click(screen.getByRole('button', { name: 'Select Star icon' }))
    await user.click(screen.getByRole('button', { name: 'Color' }))
    await user.click(screen.getByRole('button', { name: 'Select blue color' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(editItem).toHaveBeenCalledExactlyOnceWith({
        item,
        name: 'New note',
        iconName: 'Star',
        color: '#3b82f6',
      })
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Note updated')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps save disabled while the name is invalid or still validating', () => {
    const item = createNote({ name: 'Blocked note' })
    const editItem = vi.fn()
    const { rerender } = render(
      <SidebarItemEditDialog item={item} isOpen={true} onClose={vi.fn()} editItem={editItem} />,
    )

    nameValidationState.validationError = 'Name is already taken'
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Taken name' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    nameValidationState.validationError = null
    nameValidationState.debouncedName = 'Previous name'
    rerender(
      <SidebarItemEditDialog item={item} isOpen={true} onClose={vi.fn()} editItem={editItem} />,
    )
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Checking name' } })

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(editItem).not.toHaveBeenCalled()
  })

  it('routes save failures through shared error handling without closing', async () => {
    const user = userEvent.setup()
    const item = createNote({ name: 'Error note' })
    const error = new Error('save failed')
    const editItem = vi.fn().mockRejectedValue(error)
    const onClose = vi.fn()

    render(
      <SidebarItemEditDialog item={item} isOpen={true} onClose={onClose} editItem={editItem} />,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(handleErrorMock).toHaveBeenCalledExactlyOnceWith(error, 'Failed to save changes')
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})
