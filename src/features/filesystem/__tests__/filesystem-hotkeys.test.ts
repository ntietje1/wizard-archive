import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFileSystemUndoHotkeys } from '../filesystem-hotkeys'

describe('filesystem undo/redo hotkeys', () => {
  it('does not undo filesystem history from a non-item-surface target', () => {
    const undo = vi.fn().mockResolvedValue(undefined)
    const outsideTarget = document.createElement('button')
    document.body.append(outsideTarget)

    renderHook(() =>
      useFileSystemUndoHotkeys({
        canUndo: true,
        canRedo: false,
        undo,
        redo: vi.fn().mockResolvedValue(undefined),
      }),
    )

    act(() => {
      window.dispatchEvent(createKeyboardEvent('z', { ctrlKey: true, target: outsideTarget }))
    })

    expect(undo).not.toHaveBeenCalled()

    outsideTarget.remove()
  })

  it('undoes filesystem history from the focused item surface', () => {
    const undo = vi.fn().mockResolvedValue(undefined)
    const surface = document.createElement('div')
    surface.dataset.itemSurfaceHotkeyTarget = 'true'
    surface.tabIndex = 0
    document.body.append(surface)
    surface.focus()

    renderHook(() =>
      useFileSystemUndoHotkeys({
        canUndo: true,
        canRedo: false,
        undo,
        redo: vi.fn().mockResolvedValue(undefined),
      }),
    )

    act(() => {
      surface.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      )
    })

    expect(undo).toHaveBeenCalledTimes(1)

    surface.remove()
  })
})

function createKeyboardEvent(
  key: string,
  options: KeyboardEventInit & { target?: EventTarget | null } = {},
) {
  const { target, ...eventInit } = options
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...eventInit })

  if (target) {
    Object.defineProperty(event, 'target', { value: target })
  }

  return event
}
