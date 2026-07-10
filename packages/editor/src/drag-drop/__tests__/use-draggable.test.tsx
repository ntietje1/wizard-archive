import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useDraggable } from '../use-draggable'

const draggable = vi.hoisted(() => vi.fn())
const disableNativeDragPreview = vi.hoisted(() => vi.fn())

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: (args: unknown) => draggable(args),
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview', () => ({
  disableNativeDragPreview: (args: unknown) => disableNativeDragPreview(args),
}))

function DraggableHarness({ canDrag = true, id }: { canDrag?: boolean; id: string }) {
  const { draggableRef } = useDraggable({
    data: { id },
    canDrag,
  })

  return (
    <div key={id} data-testid={id} ref={draggableRef}>
      {id}
    </div>
  )
}

describe('useDraggable', () => {
  beforeEach(() => {
    draggable.mockReset()
    disableNativeDragPreview.mockReset()
    draggable.mockImplementation(() => vi.fn())
  })

  it('rebinds the draggable adapter when the rendered node changes', async () => {
    const cleanups: Array<ReturnType<typeof vi.fn>> = []
    draggable.mockImplementation(() => {
      const cleanup = vi.fn()
      cleanups.push(cleanup)
      return cleanup
    })

    const { rerender } = render(<DraggableHarness id="first" />)

    await waitFor(() => expect(draggable).toHaveBeenCalledTimes(1))
    expect(draggable.mock.calls[0]?.[0]).toMatchObject({
      element: screen.getByTestId('first'),
    })

    rerender(<DraggableHarness id="second" />)

    await waitFor(() => expect(draggable).toHaveBeenCalledTimes(2))
    expect(cleanups[0]).toHaveBeenCalledOnce()
    expect(draggable.mock.calls[1]?.[0]).toMatchObject({
      element: screen.getByTestId('second'),
    })
  })

  it('disables the native drag preview and marks the active drag element', async () => {
    render(<DraggableHarness id="first" />)

    await waitFor(() => expect(draggable).toHaveBeenCalledTimes(1))
    const registration = draggable.mock.calls[0]?.[0] as {
      element: HTMLElement
      onDragStart: () => void
      onDrop: () => void
      onGenerateDragPreview: (args: { nativeSetDragImage: DataTransfer['setDragImage'] }) => void
    }
    const nativeSetDragImage = vi.fn()

    registration.onGenerateDragPreview({ nativeSetDragImage })
    expect(disableNativeDragPreview).toHaveBeenCalledWith({ nativeSetDragImage })

    registration.onDragStart()
    expect(registration.element).toHaveAttribute('data-item-dragging')

    registration.onDrop()
    expect(registration.element).not.toHaveAttribute('data-item-dragging')
  })

  it('clears active drag state when dragging is disabled mid-drag', async () => {
    const cleanup = vi.fn()
    draggable.mockReturnValue(cleanup)
    const { rerender } = render(<DraggableHarness id="first" />)

    await waitFor(() => expect(draggable).toHaveBeenCalledTimes(1))
    const registration = draggable.mock.calls[0]?.[0] as {
      element: HTMLElement
      onDragStart: () => void
    }

    registration.onDragStart()
    expect(registration.element).toHaveAttribute('data-item-dragging')

    rerender(<DraggableHarness id="first" canDrag={false} />)

    await waitFor(() => expect(cleanup).toHaveBeenCalledOnce())
    expect(registration.element).not.toHaveAttribute('data-item-dragging')
  })
})
