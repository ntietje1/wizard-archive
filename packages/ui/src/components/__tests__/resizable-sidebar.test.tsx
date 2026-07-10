import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ResizableSidebar } from '../resizable-sidebar'

describe('ResizableSidebar', () => {
  it('uses slider semantics for keyboard min and max resizing', () => {
    const onSizeChange = vi.fn()
    const onVisibleChange = vi.fn()

    render(
      <ResizableSidebar
        side="left"
        size={200}
        visible
        onSizeChange={onSizeChange}
        onVisibleChange={onVisibleChange}
        isLoaded
      >
        <div>Sidebar content</div>
      </ResizableSidebar>,
    )

    const resizeHandle = screen.getByRole('slider', { name: 'Resize sidebar' })

    expect(resizeHandle).toHaveAttribute('aria-valuemin', '0')
    expect(resizeHandle).toHaveAttribute('aria-valuemax', '600')
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '200')

    fireEvent.keyDown(resizeHandle, { key: 'Home' })
    fireEvent.keyDown(resizeHandle, { key: 'End' })

    expect(onSizeChange).toHaveBeenNthCalledWith(1, 164)
    expect(onSizeChange).toHaveBeenNthCalledWith(2, 600)
    expect(onVisibleChange).not.toHaveBeenCalled()
  })

  it('closes from the keyboard when asked to shrink past the snap threshold', () => {
    const onSizeChange = vi.fn()
    const onVisibleChange = vi.fn()

    render(
      <ResizableSidebar
        side="left"
        size={164}
        visible
        onSizeChange={onSizeChange}
        onVisibleChange={onVisibleChange}
        isLoaded
      >
        <div>Sidebar content</div>
      </ResizableSidebar>,
    )

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Resize sidebar' }), { key: 'ArrowLeft' })

    expect(onVisibleChange).toHaveBeenCalledWith(false)
  })

  it('reports a valid slider value when closed', () => {
    render(
      <ResizableSidebar
        side="left"
        size={164}
        visible={false}
        onSizeChange={vi.fn()}
        onVisibleChange={vi.fn()}
        isLoaded
      >
        <div>Sidebar content</div>
      </ResizableSidebar>,
    )

    const resizeHandle = screen.getByRole('slider', { name: 'Resize sidebar' })

    expect(resizeHandle).toHaveAttribute('aria-valuemin', '0')
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '0')
  })

  it('ignores non-primary pointer resizing', () => {
    const onSizeChange = vi.fn()
    const onVisibleChange = vi.fn()

    render(
      <ResizableSidebar
        side="left"
        size={200}
        visible
        onSizeChange={onSizeChange}
        onVisibleChange={onVisibleChange}
        isLoaded
      >
        <div>Sidebar content</div>
      </ResizableSidebar>,
    )

    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      button: 1,
      cancelable: true,
    })
    screen.getByRole('slider', { name: 'Resize sidebar' }).dispatchEvent(mouseDown)

    expect(mouseDown.defaultPrevented).toBe(false)
    expect(onSizeChange).not.toHaveBeenCalled()
    expect(onVisibleChange).not.toHaveBeenCalled()
  })
})
