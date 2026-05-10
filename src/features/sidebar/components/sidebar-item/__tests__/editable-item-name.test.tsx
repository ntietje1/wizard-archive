import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditableName } from '../editable-item-name'
import { assertSidebarItemName } from 'convex/sidebarItems/validation/name'

vi.mock('~/shared/hooks/useNameValidation', () => ({
  useNameValidation: () => ({
    hasError: false,
    validationError: null,
    checkNameUnique: vi.fn(),
  }),
}))

describe('EditableName', () => {
  it('applies the display class to the non-renaming name', () => {
    render(
      <EditableName
        initialName={assertSidebarItemName('Session Notes')}
        isRenaming={false}
        displayClassName="text-muted-foreground group-hover:text-foreground"
        onFinishRename={vi.fn()}
        onCancelRename={vi.fn()}
        parentId={null}
      />,
    )

    expect(screen.getByText('Session Notes')).toHaveClass('text-muted-foreground')
    expect(screen.getByText('Session Notes')).toHaveClass('group-hover:text-foreground')
  })

  it('uses the input while renaming and finishes from keyboard flow', async () => {
    const onFinishRename = vi.fn().mockResolvedValue(undefined)
    const onCancelRename = vi.fn()
    render(
      <EditableName
        initialName={assertSidebarItemName('Session Notes')}
        isRenaming={true}
        displayClassName="text-muted-foreground"
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
        parentId={null}
      />,
    )

    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('Session Notes')
    expect(input).not.toHaveClass('text-muted-foreground')

    fireEvent.change(input, { target: { value: 'Session Notes Revised' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    await waitFor(() => {
      expect(onFinishRename).toHaveBeenCalledWith('Session Notes Revised')
    })
    expect(onCancelRename).not.toHaveBeenCalled()
  })

  it('cancels renaming from keyboard flow', () => {
    const onFinishRename = vi.fn().mockResolvedValue(undefined)
    const onCancelRename = vi.fn()
    render(
      <EditableName
        initialName={assertSidebarItemName('Session Notes')}
        isRenaming={true}
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
        parentId={null}
      />,
    )

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancelRename).toHaveBeenCalled()
    expect(onFinishRename).not.toHaveBeenCalled()
  })
})
