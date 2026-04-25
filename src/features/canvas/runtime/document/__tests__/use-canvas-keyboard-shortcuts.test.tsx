import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasKeyboardShortcuts } from '../use-canvas-keyboard-shortcuts'
import { useCanvasToolStore } from '../../../stores/canvas-tool-store'
import type { CanvasCommands } from '../use-canvas-commands'

const hotkeyRegistrations = vi.hoisted(
  () =>
    [] as Array<{
      hotkey: string
      callback: (event: KeyboardEvent) => void
      options: { ignoreInputs: boolean }
    }>,
)
const copySnapshotSpy = vi.hoisted(() => vi.fn(() => true))
const cutSnapshotSpy = vi.hoisted(() => vi.fn(() => true))
const deleteSnapshotSpy = vi.hoisted(() => vi.fn(() => true))
const pasteClipboardSpy = vi.hoisted(() =>
  vi.fn(() => ({ nodeIds: new Set(['node-2']), edgeIds: new Set<string>() })),
)
const getSelectionSnapshotSpy = vi.hoisted(() =>
  vi.fn(() => ({ nodeIds: new Set(['node-1']), edgeIds: new Set<string>() })),
)

vi.mock('@tanstack/react-hotkeys', () => ({
  useHotkey: (
    hotkey: string,
    callback: (event: KeyboardEvent) => void,
    options: { ignoreInputs: boolean },
  ) => {
    hotkeyRegistrations.push({ hotkey, callback, options })
  },
}))

function getRegistration(hotkey: string) {
  const registration = hotkeyRegistrations.find((entry) => entry.hotkey === hotkey)
  if (!registration) {
    throw new Error(`Missing hotkey registration for ${hotkey}`)
  }

  return registration
}

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
    hotkeyRegistrations.length = 0
    useCanvasToolStore.getState().reset()
    copySnapshotSpy.mockClear()
    cutSnapshotSpy.mockClear()
    deleteSnapshotSpy.mockClear()
    pasteClipboardSpy.mockClear()
    getSelectionSnapshotSpy.mockClear()
  })

  it('registers the canvas shortcuts through TanStack Hotkeys with input filtering enabled', () => {
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
        cancelConnectionDraft: vi.fn(),
        canEdit: true,
        nodesMap: new Map() as never,
        edgesMap: new Map() as never,
        selection,
        commands: createCommands(),
      }),
    )

    expect(hotkeyRegistrations.map((entry) => entry.hotkey)).toEqual([
      'Escape',
      'Backspace',
      'Delete',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      'Mod+A',
      'Mod+Z',
      'Mod+Shift+Z',
      'Mod+Y',
      'Mod+C',
      'Mod+X',
      'Mod+V',
    ])
    expect(hotkeyRegistrations.every((entry) => entry.options.ignoreInputs)).toBe(true)
  })

  it('routes tool shortcuts, deletion, Escape, undo, redo, copy, cut, and paste through the expected canvas actions while ignoring repeated key events', () => {
    const history = {
      undo: vi.fn(),
      redo: vi.fn(),
    }
    const cancelConnectionDraft = vi.fn()
    const selection = {
      getSnapshot: getSelectionSnapshotSpy,
      setSelection: vi.fn(),
      clearSelection: vi.fn(),
    }

    renderHook(() =>
      useCanvasKeyboardShortcuts({
        ...history,
        cancelConnectionDraft,
        canEdit: true,
        nodesMap: new Map([
          ['node-1', {}],
          ['node-2', {}],
        ]) as never,
        edgesMap: new Map([['edge-1', {}]]) as never,
        selection,
        commands: createCommands(),
      }),
    )

    useCanvasToolStore.getState().setActiveTool('draw')
    getRegistration('Escape').callback(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(selection.clearSelection).toHaveBeenCalledTimes(1)
    expect(cancelConnectionDraft).toHaveBeenCalledTimes(1)
    expect(useCanvasToolStore.getState().activeTool).toBe('draw')

    getRegistration('Escape').callback(new KeyboardEvent('keydown', { key: 'Escape' }))
    getRegistration('7').callback(new KeyboardEvent('keydown', { key: '7' }))
    const deletePreventDefaultSpy = vi.fn()
    const deleteEvent = {
      repeat: false,
      preventDefault: deletePreventDefaultSpy,
      target: document.createElement('div'),
    } as unknown as KeyboardEvent
    getRegistration('Delete').callback(deleteEvent)
    const preventDefaultSpy = vi.fn()
    const selectAllEvent = {
      repeat: false,
      preventDefault: preventDefaultSpy,
    } as unknown as KeyboardEvent
    getRegistration('Mod+A').callback(selectAllEvent)
    getRegistration('Mod+Z').callback(new KeyboardEvent('keydown', { key: 'z' }))
    getRegistration('Mod+Shift+Z').callback(
      new KeyboardEvent('keydown', { key: 'Z', shiftKey: true }),
    )
    getRegistration('Mod+Y').callback(new KeyboardEvent('keydown', { key: 'y' }))
    getRegistration('Mod+C').callback(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
    getRegistration('Mod+X').callback(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }))
    getRegistration('Mod+V').callback(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
    getRegistration('Mod+Z').callback(new KeyboardEvent('keydown', { key: 'z', repeat: true }))

    expect(selection.clearSelection).toHaveBeenCalledTimes(2)
    expect(deleteSnapshotSpy).toHaveBeenCalledWith()
    expect(deletePreventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(selection.setSelection).toHaveBeenCalledWith({
      nodeIds: new Set(['node-1', 'node-2']),
      edgeIds: new Set(['edge-1']),
    })
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(useCanvasToolStore.getState().activeTool).toBe('edge')
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
        cancelConnectionDraft: vi.fn(),
        canEdit: true,
        nodesMap: new Map() as never,
        edgesMap: new Map() as never,
        selection: {
          getSnapshot: getSelectionSnapshotSpy,
          setSelection: vi.fn(),
          clearSelection: vi.fn(),
        },
        commands: createCommands(),
      }),
    )

    const editableTarget = document.createElement('div')
    editableTarget.setAttribute('contenteditable', 'true')

    getRegistration('Backspace').callback({
      repeat: false,
      preventDefault: vi.fn(),
      target: editableTarget,
    } as unknown as KeyboardEvent)

    expect(deleteSnapshotSpy).not.toHaveBeenCalled()
  })

  it('does not run commands when canRun returns false', () => {
    const copyCanRun = vi.fn(() => false)

    renderHook(() =>
      useCanvasKeyboardShortcuts({
        undo: vi.fn(),
        redo: vi.fn(),
        cancelConnectionDraft: vi.fn(),
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
      }),
    )

    const preventDefaultSpy = vi.fn()
    getRegistration('Mod+C').callback({
      repeat: false,
      preventDefault: preventDefaultSpy,
    } as unknown as KeyboardEvent)

    expect(copyCanRun).toHaveBeenCalledTimes(1)
    expect(copySnapshotSpy).not.toHaveBeenCalled()
    expect(preventDefaultSpy).not.toHaveBeenCalled()
  })
})
