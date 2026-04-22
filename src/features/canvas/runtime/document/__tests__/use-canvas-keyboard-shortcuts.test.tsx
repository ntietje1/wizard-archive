import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasKeyboardShortcuts } from '../use-canvas-keyboard-shortcuts'
import { useCanvasToolStore } from '../../../stores/canvas-tool-store'

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
const pasteClipboardSpy = vi.hoisted(() => vi.fn(() => ({ nodeIds: ['node-2'], edgeIds: [] })))
const getSelectionSnapshotSpy = vi.hoisted(() =>
  vi.fn(() => ({ nodeIds: ['node-1'], edgeIds: [] })),
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

vi.mock('../use-canvas-selection-operations', () => ({
  useCanvasSelectionOperations: () => ({
    copySnapshot: copySnapshotSpy,
    cutSnapshot: cutSnapshotSpy,
    deleteSnapshot: deleteSnapshotSpy,
    pasteClipboard: pasteClipboardSpy,
  }),
}))

function getRegistration(hotkey: string) {
  const registration = hotkeyRegistrations.find((entry) => entry.hotkey === hotkey)
  if (!registration) {
    throw new Error(`Missing hotkey registration for ${hotkey}`)
  }

  return registration
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
      replace: vi.fn(),
      clear: vi.fn(),
    }

    renderHook(() =>
      useCanvasKeyboardShortcuts({
        ...history,
        canEdit: true,
        nodesMap: new Map() as never,
        edgesMap: new Map() as never,
        selection,
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
    const selection = {
      getSnapshot: getSelectionSnapshotSpy,
      replace: vi.fn(),
      clear: vi.fn(),
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
      }),
    )

    useCanvasToolStore.getState().setActiveTool('draw')
    getRegistration('Escape').callback(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(selection.clear).toHaveBeenCalledTimes(1)
    expect(useCanvasToolStore.getState().activeTool).toBe('draw')

    getRegistration('Escape').callback(new KeyboardEvent('keydown', { key: 'Escape' }))
    getRegistration('5').callback(new KeyboardEvent('keydown', { key: '5' }))
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

    expect(selection.clear).toHaveBeenCalledTimes(2)
    expect(deleteSnapshotSpy).toHaveBeenCalledWith({ nodeIds: ['node-1'], edgeIds: [] })
    expect(deletePreventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(selection.replace).toHaveBeenCalledWith({
      nodeIds: ['node-1', 'node-2'],
      edgeIds: ['edge-1'],
    })
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(useCanvasToolStore.getState().activeTool).toBe('erase')
    expect(history.undo).toHaveBeenCalledTimes(1)
    expect(history.redo).toHaveBeenCalledTimes(2)
    expect(copySnapshotSpy).toHaveBeenCalledWith({ nodeIds: ['node-1'], edgeIds: [] })
    expect(cutSnapshotSpy).toHaveBeenCalledWith({ nodeIds: ['node-1'], edgeIds: [] })
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
          replace: vi.fn(),
          clear: vi.fn(),
        },
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
})
