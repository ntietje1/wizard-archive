import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useCanvasKeyboardShortcuts } from '../use-canvas-keyboard-shortcuts'
import { createCanvasToolStore } from '../../../stores/canvas-tool-store'
import type { CanvasCommands } from '../use-canvas-commands'

const canvasToolStore = createCanvasToolStore()

const copySnapshotSpy = vi.hoisted(() => vi.fn(() => true))
const cutSnapshotSpy = vi.hoisted(() => vi.fn(() => true))
const deleteSnapshotSpy = vi.hoisted(() => vi.fn(() => true))
const pasteClipboardSpy = vi.hoisted(() =>
  vi.fn(() => ({ nodeIds: new Set(['node-2']), edgeIds: new Set<string>() })),
)
const getSelectionSnapshotSpy = vi.hoisted(() =>
  vi.fn(() => ({ nodeIds: new Set(['node-1']), edgeIds: new Set<string>() })),
)

type KeyboardShortcutCommands = Pick<CanvasCommands, 'copy' | 'cut' | 'paste' | 'delete'>

function createCommands(
  overrides: Partial<KeyboardShortcutCommands> = {},
): KeyboardShortcutCommands {
  return {
    copy: {
      id: 'copy',
      canRun: vi.fn(() => true),
      run: copySnapshotSpy,
    },
    cut: {
      id: 'cut',
      canRun: vi.fn(() => true),
      run: cutSnapshotSpy,
    },
    paste: {
      id: 'paste',
      canRun: vi.fn(() => true),
      run: pasteClipboardSpy,
    },
    delete: {
      id: 'delete',
      canRun: vi.fn(() => true),
      run: deleteSnapshotSpy,
    },
    ...overrides,
  }
}

describe('useCanvasKeyboardShortcuts', () => {
  beforeEach(() => {
    canvasToolStore.getState().reset()
    copySnapshotSpy.mockClear()
    cutSnapshotSpy.mockClear()
    deleteSnapshotSpy.mockClear()
    pasteClipboardSpy.mockClear()
    getSelectionSnapshotSpy.mockClear()
  })

  it('registers one global keydown listener and removes it on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const history = {
      undo: vi.fn(),
      redo: vi.fn(),
    }
    const selection = {
      getSnapshot: getSelectionSnapshotSpy,
      setSelection: vi.fn(),
      clearSelection: vi.fn(),
    }

    const { unmount } = renderHook(() =>
      useCanvasKeyboardShortcuts({
        ...history,
        canEdit: true,
        nodesMap: new Map() as never,
        edgesMap: new Map() as never,
        selection,
        commands: createCommands(),
        toolStore: canvasToolStore,
      }),
    )

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    const registeredHandler = (
      addEventListenerSpy.mock.calls as Array<[string, EventListenerOrEventListenerObject]>
    ).find(([eventName]) => eventName === 'keydown')?.[1]

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', registeredHandler)
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('routes tool shortcuts, deletion, Escape, undo, redo, copy, cut, and paste through the expected canvas actions while ignoring repeated key events', () => {
    const history = {
      undo: vi.fn(),
      redo: vi.fn(),
    }
    const selection = {
      getSnapshot: getSelectionSnapshotSpy,
      setSelection: vi.fn(),
      clearSelection: vi.fn(),
    }

    renderHook(() =>
      useCanvasKeyboardShortcuts({
        ...history,
        canEdit: true,
        nodesMap: new Map([
          ['node-1', {}],
          ['node-2', {}],
        ]) as never,
        edgesMap: new Map([['edge-1', {}]]) as never,
        selection,
        commands: createCommands(),
        toolStore: canvasToolStore,
      }),
    )

    canvasToolStore.getState().setActiveTool('draw')
    dispatchKeyboardShortcut(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(selection.clearSelection).toHaveBeenCalledTimes(1)
    expect(canvasToolStore.getState().activeTool).toBe('draw')

    dispatchKeyboardShortcut(new KeyboardEvent('keydown', { key: 'Escape' }))
    dispatchKeyboardShortcut(new KeyboardEvent('keydown', { key: '7' }))
    const deletePreventDefaultSpy = vi.fn()
    dispatchKeyboardShortcut(
      createKeyboardShortcutEvent('Delete', {
        preventDefault: deletePreventDefaultSpy,
        target: document.createElement('div'),
      }),
    )
    const preventDefaultSpy = vi.fn()
    dispatchKeyboardShortcut(
      createKeyboardShortcutEvent('a', {
        ctrlKey: true,
        preventDefault: preventDefaultSpy,
      }),
    )
    dispatchKeyboardShortcut(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    dispatchKeyboardShortcut(
      new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true }),
    )
    dispatchKeyboardShortcut(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))
    dispatchKeyboardShortcut(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
    dispatchKeyboardShortcut(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }))
    dispatchKeyboardShortcut(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
    dispatchKeyboardShortcut(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, repeat: true }),
    )

    expect(selection.clearSelection).toHaveBeenCalledTimes(2)
    expect(deleteSnapshotSpy).toHaveBeenCalledWith()
    expect(deletePreventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(selection.setSelection).toHaveBeenCalledWith({
      nodeIds: new Set(['node-1', 'node-2']),
      edgeIds: new Set(['edge-1']),
    })
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(canvasToolStore.getState().activeTool).toBe('edge')
    expect(history.undo).toHaveBeenCalledTimes(1)
    expect(history.redo).toHaveBeenCalledTimes(2)
    expect(copySnapshotSpy).toHaveBeenCalledWith()
    expect(cutSnapshotSpy).toHaveBeenCalledWith()
    expect(pasteClipboardSpy).toHaveBeenCalledTimes(1)
  })

  it('does not delete the current selection when Backspace comes from an editable target', () => {
    renderHook(() =>
      useCanvasKeyboardShortcuts({
        undo: vi.fn(),
        redo: vi.fn(),
        canEdit: true,
        nodesMap: new Map() as never,
        edgesMap: new Map() as never,
        selection: {
          getSnapshot: getSelectionSnapshotSpy,
          setSelection: vi.fn(),
          clearSelection: vi.fn(),
        },
        commands: createCommands(),
        toolStore: canvasToolStore,
      }),
    )

    const editableTarget = document.createElement('div')
    editableTarget.setAttribute('contenteditable', 'true')

    dispatchKeyboardShortcut(createKeyboardShortcutEvent('Backspace', { target: editableTarget }))

    expect(deleteSnapshotSpy).not.toHaveBeenCalled()
  })

  it('does not run commands when canRun returns false', () => {
    const copyCanRun = vi.fn(() => false)

    renderHook(() =>
      useCanvasKeyboardShortcuts({
        undo: vi.fn(),
        redo: vi.fn(),
        canEdit: true,
        nodesMap: new Map() as never,
        edgesMap: new Map() as never,
        selection: {
          getSnapshot: getSelectionSnapshotSpy,
          setSelection: vi.fn(),
          clearSelection: vi.fn(),
        },
        commands: createCommands({
          copy: {
            id: 'copy',
            canRun: copyCanRun,
            run: copySnapshotSpy,
          },
        }),
        toolStore: canvasToolStore,
      }),
    )

    const preventDefaultSpy = vi.fn()
    dispatchKeyboardShortcut(
      createKeyboardShortcutEvent('c', { ctrlKey: true, preventDefault: preventDefaultSpy }),
    )

    expect(copyCanRun).toHaveBeenCalledTimes(1)
    expect(copySnapshotSpy).not.toHaveBeenCalled()
    expect(preventDefaultSpy).not.toHaveBeenCalled()
  })

  it('ignores undo and redo shortcuts when editing is disabled', () => {
    const history = {
      undo: vi.fn(),
      redo: vi.fn(),
    }

    renderHook(() =>
      useCanvasKeyboardShortcuts({
        ...history,
        canEdit: false,
        nodesMap: new Map() as never,
        edgesMap: new Map() as never,
        selection: {
          getSnapshot: getSelectionSnapshotSpy,
          setSelection: vi.fn(),
          clearSelection: vi.fn(),
        },
        commands: createCommands(),
        toolStore: canvasToolStore,
      }),
    )

    const undoPreventDefaultSpy = vi.fn()
    const redoPreventDefaultSpy = vi.fn()
    dispatchKeyboardShortcut(
      createKeyboardShortcutEvent('z', {
        ctrlKey: true,
        preventDefault: undoPreventDefaultSpy,
      }),
    )
    dispatchKeyboardShortcut(
      createKeyboardShortcutEvent('y', {
        ctrlKey: true,
        preventDefault: redoPreventDefaultSpy,
      }),
    )

    expect(history.undo).not.toHaveBeenCalled()
    expect(history.redo).not.toHaveBeenCalled()
    expect(undoPreventDefaultSpy).not.toHaveBeenCalled()
    expect(redoPreventDefaultSpy).not.toHaveBeenCalled()
  })

  it('prevents native Backspace behavior on the canvas even when nothing is deleted', () => {
    const deleteCanRun = vi.fn(() => false)

    renderHook(() =>
      useCanvasKeyboardShortcuts({
        undo: vi.fn(),
        redo: vi.fn(),
        canEdit: true,
        nodesMap: new Map() as never,
        edgesMap: new Map() as never,
        selection: {
          getSnapshot: getSelectionSnapshotSpy,
          setSelection: vi.fn(),
          clearSelection: vi.fn(),
        },
        commands: createCommands({
          delete: {
            id: 'delete',
            canRun: deleteCanRun,
            run: deleteSnapshotSpy,
          },
        }),
        toolStore: canvasToolStore,
      }),
    )

    const preventDefaultSpy = vi.fn()
    dispatchKeyboardShortcut(
      createKeyboardShortcutEvent('Backspace', { preventDefault: preventDefaultSpy }),
    )

    expect(deleteCanRun).toHaveBeenCalledTimes(1)
    expect(deleteSnapshotSpy).not.toHaveBeenCalled()
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1)
  })

  it('ignores canvas history shortcuts when the event target is outside the canvas surface', () => {
    const surface = document.createElement('div')
    const outside = document.createElement('button')
    document.body.append(surface, outside)
    const history = {
      undo: vi.fn(),
      redo: vi.fn(),
    }

    renderHook(() =>
      useCanvasKeyboardShortcuts({
        ...history,
        canEdit: true,
        surfaceRef: { current: surface },
        nodesMap: new Map() as never,
        edgesMap: new Map() as never,
        selection: {
          getSnapshot: getSelectionSnapshotSpy,
          setSelection: vi.fn(),
          clearSelection: vi.fn(),
        },
        commands: createCommands(),
        toolStore: canvasToolStore,
      }),
    )

    dispatchKeyboardShortcut(createKeyboardShortcutEvent('z', { ctrlKey: true, target: outside }))

    expect(history.undo).not.toHaveBeenCalled()

    surface.remove()
    outside.remove()
  })

  it('runs canvas history shortcuts when the canvas surface owns focus', () => {
    const surface = document.createElement('div')
    surface.tabIndex = -1
    document.body.append(surface)
    surface.focus()
    const history = {
      undo: vi.fn(),
      redo: vi.fn(),
    }

    renderHook(() =>
      useCanvasKeyboardShortcuts({
        ...history,
        canEdit: true,
        surfaceRef: { current: surface },
        nodesMap: new Map() as never,
        edgesMap: new Map() as never,
        selection: {
          getSnapshot: getSelectionSnapshotSpy,
          setSelection: vi.fn(),
          clearSelection: vi.fn(),
        },
        commands: createCommands(),
        toolStore: canvasToolStore,
      }),
    )

    dispatchKeyboardShortcut(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))

    expect(history.undo).toHaveBeenCalledTimes(1)

    surface.remove()
  })
})

function dispatchKeyboardShortcut(event: KeyboardEvent) {
  window.dispatchEvent(event)
}

function createKeyboardShortcutEvent(
  key: string,
  options: KeyboardEventInit & {
    preventDefault?: () => void
    target?: EventTarget | null
  } = {},
) {
  const { preventDefault, target, ...eventInit } = options
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...eventInit })

  if (preventDefault) {
    Object.defineProperty(event, 'preventDefault', { value: preventDefault })
  }

  if (target) {
    Object.defineProperty(event, 'target', { value: target })
  }

  return event
}
