import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFileSystemUndoHotkeys } from '../filesystem-hotkeys'

describe('filesystem undo/redo hotkeys', () => {
  it('does not undo filesystem history from an editable target', () => {
    const undo = vi.fn().mockResolvedValue(undefined)
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()

    renderHook(() =>
      useFileSystemUndoHotkeys({
        canUndo: true,
        canRedo: false,
        undo,
        redo: vi.fn().mockResolvedValue(undefined),
      }),
    )

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    })

    expect(undo).not.toHaveBeenCalled()

    input.remove()
  })

  it.each([
    ['context menu', 'context-menu-content'],
    ['context menu rich submenu', 'context-menu-rich-submenu-content'],
    ['popover', 'popover-content'],
    ['select portal', 'select-content'],
    ['dropdown menu', 'dropdown-menu-content'],
  ])('undoes filesystem history from a focused %s control', (_label, slot) => {
    const undo = vi.fn().mockResolvedValue(undefined)
    const overlay = document.createElement('div')
    overlay.dataset.slot = slot
    const control = document.createElement('button')
    control.textContent = 'Share'
    overlay.append(control)
    document.body.append(overlay)
    control.focus()

    renderHook(() =>
      useFileSystemUndoHotkeys({
        canUndo: true,
        canRedo: false,
        undo,
        redo: vi.fn().mockResolvedValue(undefined),
      }),
    )

    act(() => {
      control.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      )
    })

    expect(undo).toHaveBeenCalledTimes(1)

    overlay.remove()
  })

  it('redoes filesystem history from a context menu control that stops bubbling keydown', () => {
    const redo = vi.fn().mockResolvedValue(undefined)
    const contextMenu = document.createElement('div')
    contextMenu.dataset.slot = 'context-menu-content'
    const control = document.createElement('button')
    control.textContent = 'View'
    control.addEventListener('keydown', (event) => event.stopPropagation())
    contextMenu.append(control)
    document.body.append(contextMenu)
    control.focus()

    renderHook(() =>
      useFileSystemUndoHotkeys({
        canUndo: false,
        canRedo: true,
        undo: vi.fn().mockResolvedValue(undefined),
        redo,
      }),
    )

    act(() => {
      control.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }),
      )
    })

    expect(redo).toHaveBeenCalledTimes(1)

    contextMenu.remove()
  })

  it('undoes filesystem history when a share menu remains open after focus falls back to the page', () => {
    const undo = vi.fn().mockResolvedValue(undefined)
    const editor = document.createElement('div')
    editor.contentEditable = 'true'
    editor.textContent = 'stale selection'
    const shareMenu = document.createElement('div')
    shareMenu.dataset.slot = 'popover-content'
    const closedSelectItem = document.createElement('button')
    closedSelectItem.textContent = 'Edit'
    shareMenu.append(closedSelectItem)
    document.body.append(editor, shareMenu)
    const range = document.createRange()
    range.selectNodeContents(editor)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    closedSelectItem.focus()
    closedSelectItem.remove()

    renderHook(() =>
      useFileSystemUndoHotkeys({
        canUndo: true,
        canRedo: false,
        undo,
        redo: vi.fn().mockResolvedValue(undefined),
      }),
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })

    expect(undo).toHaveBeenCalledTimes(1)

    selection?.removeAllRanges()
    editor.remove()
    shareMenu.remove()
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

  it('ignores stale editor selections when a non-editable item surface has focus', () => {
    const undo = vi.fn().mockResolvedValue(undefined)
    const editor = document.createElement('div')
    editor.contentEditable = 'true'
    editor.textContent = 'stale selection'
    const surface = document.createElement('div')
    surface.dataset.itemSurfaceHotkeyTarget = 'true'
    surface.tabIndex = 0
    document.body.append(editor, surface)
    const range = document.createRange()
    range.selectNodeContents(editor)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
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

    selection?.removeAllRanges()
    editor.remove()
    surface.remove()
  })
})
