import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useFileSystemUndoHotkeys } from '../hotkeys'

describe('filesystem undo/redo hotkeys', () => {
  it.each([
    ['context menu', 'context-menu-content'],
    ['context menu rich submenu', 'context-menu-rich-submenu-content'],
    ['popover', 'popover-content'],
    ['select portal', 'select-content'],
    ['dropdown menu', 'dropdown-menu-content'],
  ])('undoes filesystem history from a focused %s control', async (_label, slot) => {
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
        reportError: vi.fn(),
      }),
    )

    act(() => {
      control.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      )
    })

    await waitFor(() => expect(undo).toHaveBeenCalledTimes(1))

    overlay.remove()
  })

  it('redoes filesystem history from a context menu control that stops bubbling keydown', async () => {
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
        reportError: vi.fn(),
      }),
    )

    act(() => {
      control.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }),
      )
    })

    await waitFor(() => expect(redo).toHaveBeenCalledTimes(1))

    contextMenu.remove()
  })

  it('undoes filesystem history when a share menu remains open after focus falls back to the page', async () => {
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
        reportError: vi.fn(),
      }),
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })

    await waitFor(() => expect(undo).toHaveBeenCalledTimes(1))

    selection?.removeAllRanges()
    editor.remove()
    shareMenu.remove()
  })

  it('undoes filesystem history from the focused item surface', async () => {
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
        reportError: vi.fn(),
      }),
    )

    act(() => {
      surface.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      )
    })

    await waitFor(() => expect(undo).toHaveBeenCalledTimes(1))

    surface.remove()
  })

  it('only runs scoped filesystem history for the host that owns the focused surface', async () => {
    const firstUndo = vi.fn().mockResolvedValue(undefined)
    const secondUndo = vi.fn().mockResolvedValue(undefined)
    const firstScope = document.createElement('div')
    const secondScope = document.createElement('div')
    const secondSurface = document.createElement('div')
    secondSurface.dataset.itemSurfaceHotkeyTarget = 'true'
    secondSurface.tabIndex = 0
    secondScope.append(secondSurface)
    document.body.append(firstScope, secondScope)
    secondSurface.focus()

    renderHook(() =>
      useFileSystemUndoHotkeys(
        {
          canUndo: true,
          canRedo: false,
          undo: firstUndo,
          redo: vi.fn().mockResolvedValue(undefined),
          reportError: vi.fn(),
        },
        { scopeRef: { current: firstScope } },
      ),
    )
    renderHook(() =>
      useFileSystemUndoHotkeys(
        {
          canUndo: true,
          canRedo: false,
          undo: secondUndo,
          redo: vi.fn().mockResolvedValue(undefined),
          reportError: vi.fn(),
        },
        { scopeRef: { current: secondScope } },
      ),
    )

    act(() => {
      secondSurface.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      )
    })

    await waitFor(() => expect(secondUndo).toHaveBeenCalledTimes(1))
    expect(firstUndo).not.toHaveBeenCalled()

    firstScope.remove()
    secondScope.remove()
  })

  it('ignores scoped filesystem history when focus is outside the host surface', () => {
    const undo = vi.fn().mockResolvedValue(undefined)
    const scope = document.createElement('div')
    const outsideSurface = document.createElement('div')
    outsideSurface.dataset.itemSurfaceHotkeyTarget = 'true'
    outsideSurface.tabIndex = 0
    document.body.append(scope, outsideSurface)
    outsideSurface.focus()

    renderHook(() =>
      useFileSystemUndoHotkeys(
        {
          canUndo: true,
          canRedo: false,
          undo,
          redo: vi.fn().mockResolvedValue(undefined),
          reportError: vi.fn(),
        },
        { scopeRef: { current: scope } },
      ),
    )

    act(() => {
      outsideSurface.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      )
    })

    expect(undo).not.toHaveBeenCalled()

    scope.remove()
    outsideSurface.remove()
  })

  it('ignores stale editor selections when a non-editable item surface has focus', async () => {
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
        reportError: vi.fn(),
      }),
    )

    act(() => {
      surface.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      )
    })

    await waitFor(() => expect(undo).toHaveBeenCalledTimes(1))

    selection?.removeAllRanges()
    editor.remove()
    surface.remove()
  })

  it('reports undo failures through the supplied reporter', async () => {
    const error = new Error('undo failed')
    const undo = vi.fn().mockRejectedValue(error)
    const reportError = vi.fn()
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
        reportError,
      }),
    )

    act(() => {
      surface.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      )
    })

    await waitFor(() => expect(reportError).toHaveBeenCalledWith(error, 'Filesystem undo failed'))

    surface.remove()
  })

  it('reports resolved stale-history rejections from undo', async () => {
    const undo = vi.fn().mockResolvedValue({ status: 'rejected', reason: 'stale-history' })
    const reportError = vi.fn()
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
        redo: vi.fn().mockResolvedValue({ status: 'needsDecision', conflicts: [] }),
        reportError,
      }),
    )

    act(() => {
      surface.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      )
    })

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Filesystem history changed. Try again.' }),
        'Filesystem undo failed',
      ),
    )

    surface.remove()
  })

  it.each([
    [
      'undo',
      { key: 'z', ctrlKey: true },
      'Filesystem undo failed',
      { canUndo: true, canRedo: false },
    ],
    [
      'redo',
      { key: 'z', ctrlKey: true, shiftKey: true },
      'Filesystem redo failed',
      { canUndo: false, canRedo: true },
    ],
  ] as const)(
    'reports synchronous %s failures and releases the in-flight guard',
    async (action, keyboardOptions, message, availability) => {
      const error = new Error(`${action} failed`)
      const handler = vi
        .fn()
        .mockImplementationOnce(() => {
          throw error
        })
        .mockResolvedValueOnce(undefined)
      const reportError = vi.fn()
      const surface = document.createElement('div')
      surface.dataset.itemSurfaceHotkeyTarget = 'true'
      surface.tabIndex = 0
      document.body.append(surface)
      surface.focus()

      renderHook(() =>
        useFileSystemUndoHotkeys({
          ...availability,
          undo: action === 'undo' ? handler : vi.fn().mockResolvedValue(undefined),
          redo: action === 'redo' ? handler : vi.fn().mockResolvedValue(undefined),
          reportError,
        }),
      )

      act(() => {
        surface.dispatchEvent(new KeyboardEvent('keydown', { ...keyboardOptions, bubbles: true }))
      })

      await waitFor(() => expect(reportError).toHaveBeenCalledWith(error, message))

      act(() => {
        surface.dispatchEvent(new KeyboardEvent('keydown', { ...keyboardOptions, bubbles: true }))
      })

      await waitFor(() => expect(handler).toHaveBeenCalledTimes(2))

      surface.remove()
    },
  )

  it.each([
    [
      'undo',
      { key: 'z', ctrlKey: true },
      'Filesystem undo failed',
      'Filesystem undo timed out',
      { canUndo: true, canRedo: false },
    ],
    [
      'redo',
      { key: 'z', ctrlKey: true, shiftKey: true },
      'Filesystem redo failed',
      'Filesystem redo timed out',
      { canUndo: false, canRedo: true },
    ],
  ] as const)(
    'reports %s timeouts and releases the in-flight guard',
    async (action, keyboardOptions, message, timeoutMessage, availability) => {
      vi.useFakeTimers()
      const handler = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise(() => {
              // Keep the first operation pending until the timeout releases the guard.
            }),
        )
        .mockResolvedValueOnce(undefined)
      const reportError = vi.fn()
      const surface = document.createElement('div')
      surface.dataset.itemSurfaceHotkeyTarget = 'true'
      surface.tabIndex = 0
      document.body.append(surface)
      surface.focus()

      try {
        renderHook(() =>
          useFileSystemUndoHotkeys({
            ...availability,
            undo: action === 'undo' ? handler : vi.fn().mockResolvedValue(undefined),
            redo: action === 'redo' ? handler : vi.fn().mockResolvedValue(undefined),
            reportError,
          }),
        )

        await act(async () => {
          surface.dispatchEvent(new KeyboardEvent('keydown', { ...keyboardOptions, bubbles: true }))
          await Promise.resolve()
        })
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000)
        })

        expect(reportError).toHaveBeenCalledWith(expect.any(Error), message)
        expect(vi.mocked(reportError).mock.calls[0]?.[0]).toMatchObject({
          message: timeoutMessage,
        })

        await act(async () => {
          surface.dispatchEvent(new KeyboardEvent('keydown', { ...keyboardOptions, bubbles: true }))
          await Promise.resolve()
        })

        expect(handler).toHaveBeenCalledTimes(2)
      } finally {
        surface.remove()
        vi.useRealTimers()
      }
    },
  )
})
