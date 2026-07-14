import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { EditableName } from '../editable-item-name'
import { canonicalizeResourceItemTitle } from '../../../../items'

const validateNameMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())
const handleErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../../../../../filesystem/use-name-validation', () => ({
  useNameValidation: () => ({
    hasError: false,
    validationError: null,
    validateName: validateNameMock,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}))

vi.mock('../../../../../errors/handle-error', () => ({
  handleError: handleErrorMock,
}))

describe('EditableName', () => {
  beforeEach(() => {
    validateNameMock.mockReset()
    handleErrorMock.mockReset()
    toastErrorMock.mockReset()
  })

  it('renders display text while not renaming', () => {
    render(
      <EditableName
        initialName={canonicalizeResourceItemTitle('Session Notes')}
        isRenaming={false}
        displayClassName="text-muted-foreground"
        onFinishRename={vi.fn()}
        onCancelRename={vi.fn()}
      />,
    )

    expect(screen.getByText('Session Notes')).toHaveClass('text-muted-foreground')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('uses the input while renaming and finishes from keyboard flow', async () => {
    const onFinishRename = vi.fn().mockResolvedValue(undefined)
    const onCancelRename = vi.fn()
    render(
      <EditableName
        initialName={canonicalizeResourceItemTitle('Session Notes')}
        isRenaming={true}
        displayClassName="text-muted-foreground"
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
      />,
    )

    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('Session Notes')

    fireEvent.change(input, { target: { value: 'Session Notes Revised' } })
    input.focus()
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(onFinishRename).toHaveBeenCalledTimes(1)
      expect(onFinishRename).toHaveBeenCalledWith('Session Notes Revised')
    })
  })

  it('does not submit while Enter confirms IME composition', () => {
    const onFinishRename = vi.fn().mockResolvedValue(undefined)
    const onCancelRename = vi.fn()
    render(
      <EditableName
        initialName={canonicalizeResourceItemTitle('Session Notes')}
        isRenaming={true}
        displayClassName="text-muted-foreground"
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
      />,
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Session Notes Revised' } })
    input.focus()
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
    })
    Object.defineProperty(event, 'isComposing', { value: true })
    fireEvent(input, event)

    expect(onFinishRename).not.toHaveBeenCalled()
    expect(onCancelRename).not.toHaveBeenCalled()
    expect(input).toHaveFocus()
  })

  it('cancels renaming from keyboard flow', () => {
    const onFinishRename = vi.fn().mockResolvedValue(undefined)
    const onCancelRename = vi.fn()
    render(
      <EditableName
        initialName={canonicalizeResourceItemTitle('Session Notes')}
        isRenaming={true}
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
      />,
    )

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancelRename).toHaveBeenCalled()
  })

  it('does not submit a changed name after Escape cancellation blurs the input', () => {
    const onFinishRename = vi.fn().mockResolvedValue(undefined)
    const onCancelRename = vi.fn()
    render(
      <EditableName
        initialName={canonicalizeResourceItemTitle('Session Notes')}
        isRenaming={true}
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
      />,
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Canceled Rename' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)

    expect(onCancelRename).toHaveBeenCalledTimes(1)
    expect(onFinishRename).not.toHaveBeenCalled()
  })

  it('cancels unchanged blur without validating', async () => {
    const onFinishRename = vi.fn().mockResolvedValue(undefined)
    const onCancelRename = vi.fn()
    render(
      <EditableName
        initialName={canonicalizeResourceItemTitle('Session Notes')}
        isRenaming={true}
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
      />,
    )

    fireEvent.blur(screen.getByRole('textbox'))

    await waitFor(() => expect(onCancelRename).toHaveBeenCalledTimes(1))
    expect(validateNameMock).not.toHaveBeenCalled()
    expect(onFinishRename).not.toHaveBeenCalled()
  })

  it('preserves an active rename draft when the backing item name refreshes', () => {
    const onFinishRename = vi.fn().mockResolvedValue(undefined)
    const onCancelRename = vi.fn()
    const { rerender } = render(
      <EditableName
        initialName={canonicalizeResourceItemTitle('Session Notes')}
        isRenaming={true}
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
      />,
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Local Draft' } })

    rerender(
      <EditableName
        initialName={canonicalizeResourceItemTitle('Session Notes from Server')}
        isRenaming={true}
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
      />,
    )

    expect(input).toHaveValue('Local Draft')
  })

  it('reports a rename validation failure and restores the previous name', async () => {
    validateNameMock.mockReturnValue('Title is invalid')
    const onFinishRename = vi.fn().mockResolvedValue(undefined)
    const onCancelRename = vi.fn()
    render(
      <EditableName
        initialName={canonicalizeResourceItemTitle('Session Notes')}
        isRenaming={true}
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
      />,
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Existing Session' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Title is invalid')
      expect(input).toHaveValue('Session Notes')
      expect(onCancelRename).toHaveBeenCalledTimes(1)
    })
    expect(onFinishRename).not.toHaveBeenCalled()
  })

  it('reports a failed rename submission and restores the previous name', async () => {
    const error = new Error('rename failed')
    const onFinishRename = vi.fn().mockRejectedValue(error)
    const onCancelRename = vi.fn()
    render(
      <EditableName
        initialName={canonicalizeResourceItemTitle('Session Notes')}
        isRenaming={true}
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
      />,
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Session Notes Revised' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(handleErrorMock).toHaveBeenCalledWith(error, 'Failed to rename')
      expect(input).toHaveValue('Session Notes')
      expect(onCancelRename).toHaveBeenCalledTimes(1)
    })
  })
})
