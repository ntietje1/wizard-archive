import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasKeyboardShortcuts } from '../use-canvas-keyboard-shortcuts'

const hotkeyRegistrations = vi.hoisted(
  () =>
    [] as Array<{
      hotkey: string
      callback: (event: KeyboardEvent) => void
      options: { ignoreInputs: boolean }
    }>,
)
const clearSelectionSpy = vi.hoisted(() => vi.fn())
const copySnapshotSpy = vi.hoisted(() => vi.fn(() => true))
const cutSnapshotSpy = vi.hoisted(() => vi.fn(() => true))
const pasteClipboardSpy = vi.hoisted(() => vi.fn(() => ({ nodeIds: ['node-2'], edgeIds: [] })))
const getCanvasSelectionSnapshotSpy = vi.hoisted(() =>
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

vi.mock('../../context-menu/use-canvas-context-menu-services', () => ({
  useCanvasContextMenuServices: () => ({
    copySnapshot: copySnapshotSpy,
    cutSnapshot: cutSnapshotSpy,
    pasteClipboard: pasteClipboardSpy,
  }),
}))

vi.mock('../../selection/use-canvas-selection-state', () => ({
  getCanvasSelectionSnapshot: () => getCanvasSelectionSnapshotSpy(),
}))

vi.mock('../../selection/use-canvas-selection-actions', () => ({
  useCanvasSelectionActions: () => ({
    clear: clearSelectionSpy,
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
    clearSelectionSpy.mockReset()
    copySnapshotSpy.mockClear()
    cutSnapshotSpy.mockClear()
    pasteClipboardSpy.mockClear()
    getCanvasSelectionSnapshotSpy.mockClear()
  })

  it('registers the canvas shortcuts through TanStack Hotkeys with input filtering enabled', () => {
    const history = {
      undo: vi.fn(),
      redo: vi.fn(),
    }

    renderHook(() =>
      useCanvasKeyboardShortcuts({
        ...history,
        canEdit: true,
        nodesMap: {} as never,
        edgesMap: {} as never,
        selection: { replace: vi.fn(), clear: vi.fn() },
      }),
    )

    expect(hotkeyRegistrations.map((entry) => entry.hotkey)).toEqual([
      'Escape',
      'Mod+Z',
      'Mod+Shift+Z',
      'Mod+Y',
      'Mod+C',
      'Mod+X',
      'Mod+V',
    ])
    expect(hotkeyRegistrations.map((entry) => entry.options)).toEqual([
      { ignoreInputs: true },
      { ignoreInputs: true },
      { ignoreInputs: true },
      { ignoreInputs: true },
      { ignoreInputs: true },
      { ignoreInputs: true },
      { ignoreInputs: true },
    ])
  })

  it('routes Escape, undo, redo, copy, cut, and paste through the expected canvas actions while ignoring repeated key events', () => {
    const history = {
      undo: vi.fn(),
      redo: vi.fn(),
    }

    renderHook(() =>
      useCanvasKeyboardShortcuts({
        ...history,
        canEdit: true,
        nodesMap: {} as never,
        edgesMap: {} as never,
        selection: { replace: vi.fn(), clear: vi.fn() },
      }),
    )

    getRegistration('Escape').callback(new KeyboardEvent('keydown', { key: 'Escape' }))
    getRegistration('Mod+Z').callback(new KeyboardEvent('keydown', { key: 'z' }))
    getRegistration('Mod+Shift+Z').callback(
      new KeyboardEvent('keydown', { key: 'Z', shiftKey: true }),
    )
    getRegistration('Mod+Y').callback(new KeyboardEvent('keydown', { key: 'y' }))
    getRegistration('Mod+C').callback(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
    getRegistration('Mod+X').callback(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }))
    getRegistration('Mod+V').callback(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
    getRegistration('Mod+Z').callback(new KeyboardEvent('keydown', { key: 'z', repeat: true }))

    expect(clearSelectionSpy).toHaveBeenCalledTimes(1)
    expect(history.undo).toHaveBeenCalledTimes(1)
    expect(history.redo).toHaveBeenCalledTimes(2)
    expect(copySnapshotSpy).toHaveBeenCalledWith({ nodeIds: ['node-1'], edgeIds: [] })
    expect(cutSnapshotSpy).toHaveBeenCalledWith({ nodeIds: ['node-1'], edgeIds: [] })
    expect(pasteClipboardSpy).toHaveBeenCalledTimes(1)
  })
})
