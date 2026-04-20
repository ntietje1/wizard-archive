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

vi.mock('@tanstack/react-hotkeys', () => ({
  useHotkey: (
    hotkey: string,
    callback: (event: KeyboardEvent) => void,
    options: { ignoreInputs: boolean },
  ) => {
    hotkeyRegistrations.push({ hotkey, callback, options })
  },
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
  })

  it('registers the canvas shortcuts through TanStack Hotkeys with input filtering enabled', () => {
    const history = {
      undo: vi.fn(),
      redo: vi.fn(),
    }

    renderHook(() => useCanvasKeyboardShortcuts(history))

    expect(hotkeyRegistrations.map((entry) => entry.hotkey)).toEqual([
      'Escape',
      'Mod+Z',
      'Mod+Shift+Z',
      'Mod+Y',
    ])
    expect(hotkeyRegistrations.map((entry) => entry.options)).toEqual([
      { ignoreInputs: true },
      { ignoreInputs: true },
      { ignoreInputs: true },
      { ignoreInputs: true },
    ])
  })

  it('routes Escape, undo, and redo through the expected canvas actions while ignoring repeated key events', () => {
    const history = {
      undo: vi.fn(),
      redo: vi.fn(),
    }

    renderHook(() => useCanvasKeyboardShortcuts(history))

    getRegistration('Escape').callback(new KeyboardEvent('keydown', { key: 'Escape' }))
    getRegistration('Mod+Z').callback(new KeyboardEvent('keydown', { key: 'z' }))
    getRegistration('Mod+Shift+Z').callback(
      new KeyboardEvent('keydown', { key: 'Z', shiftKey: true }),
    )
    getRegistration('Mod+Y').callback(new KeyboardEvent('keydown', { key: 'y' }))
    getRegistration('Mod+Z').callback(new KeyboardEvent('keydown', { key: 'z', repeat: true }))

    expect(clearSelectionSpy).toHaveBeenCalledTimes(1)
    expect(history.undo).toHaveBeenCalledTimes(1)
    expect(history.redo).toHaveBeenCalledTimes(2)
  })
})
