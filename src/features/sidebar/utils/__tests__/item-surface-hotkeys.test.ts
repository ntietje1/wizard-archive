import { describe, expect, it } from 'vitest'
import {
  isEditableHotkeyTarget,
  isItemSurfaceInteractionTarget,
  isModifierShortcut,
} from '../item-surface-hotkeys'

describe('item surface hotkey utilities', () => {
  it('detects modifier shortcuts with either Ctrl or Meta', () => {
    expect(isModifierShortcut(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }), 'a')).toBe(
      true,
    )
    expect(isModifierShortcut(new KeyboardEvent('keydown', { key: 'A', metaKey: true }), 'a')).toBe(
      true,
    )
    expect(isModifierShortcut(new KeyboardEvent('keydown', { key: 'a' }), 'a')).toBe(false)
    expect(isModifierShortcut(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }), 'a')).toBe(
      false,
    )
    expect(isModifierShortcut(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }), 'X')).toBe(
      true,
    )
    expect(
      isModifierShortcut(
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, metaKey: true }),
        'a',
      ),
    ).toBe(true)
  })

  it('suppresses hotkeys from editable targets', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    const nonEditable = document.createElement('div')
    nonEditable.setAttribute('contenteditable', 'false')
    Object.defineProperty(nonEditable, 'isContentEditable', { value: false })
    const plain = document.createElement('button')

    expect(isEditableHotkeyTarget(input)).toBe(true)
    expect(isEditableHotkeyTarget(textarea)).toBe(true)
    expect(isEditableHotkeyTarget(select)).toBe(true)
    expect(isEditableHotkeyTarget(editable)).toBe(true)
    expect(isEditableHotkeyTarget(nonEditable)).toBe(false)
    expect(isEditableHotkeyTarget(plain)).toBe(false)
  })

  it('detects item controls inside selectable surfaces', () => {
    const link = document.createElement('a')
    link.href = '/note'
    const inertLink = document.createElement('a')
    const button = document.createElement('button')
    const disabledButton = document.createElement('button')
    disabledButton.disabled = true
    const item = document.createElement('div')
    const child = document.createElement('span')
    const interactiveChild = document.createElement('button')
    const plainChild = document.createElement('span')
    const blank = document.createElement('div')
    item.dataset.itemSelectionTarget = 'true'
    item.appendChild(child)
    item.appendChild(interactiveChild)

    expect(isItemSurfaceInteractionTarget(link)).toBe(true)
    expect(isItemSurfaceInteractionTarget(inertLink)).toBe(false)
    expect(isItemSurfaceInteractionTarget(button)).toBe(true)
    expect(isItemSurfaceInteractionTarget(disabledButton)).toBe(false)
    expect(isItemSurfaceInteractionTarget(child)).toBe(true)
    expect(isItemSurfaceInteractionTarget(interactiveChild)).toBe(true)
    expect(isItemSurfaceInteractionTarget(plainChild)).toBe(false)
    expect(isItemSurfaceInteractionTarget(blank)).toBe(false)
  })
})
