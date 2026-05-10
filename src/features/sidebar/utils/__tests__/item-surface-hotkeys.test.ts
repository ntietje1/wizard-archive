import { describe, expect, it } from 'vitest'
import {
  isEditableHotkeyTarget,
  isItemSurfaceInteractionTarget,
  isModifierShortcut,
} from '../item-surface-hotkeys'
import { getKeyboardOpenItem, getKeyboardPasteParentId } from '../item-surface-keyboard'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

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
    item.appendChild(plainChild)

    expect(isItemSurfaceInteractionTarget(link)).toBe(true)
    expect(isItemSurfaceInteractionTarget(inertLink)).toBe(false)
    expect(isItemSurfaceInteractionTarget(button)).toBe(true)
    expect(isItemSurfaceInteractionTarget(disabledButton)).toBe(false)
    expect(isItemSurfaceInteractionTarget(child)).toBe(true)
    expect(isItemSurfaceInteractionTarget(interactiveChild)).toBe(true)
    expect(isItemSurfaceInteractionTarget(plainChild)).toBe(true)
    expect(isItemSurfaceInteractionTarget(blank)).toBe(false)
  })

  it('detects context menu content as an item-surface interaction target', () => {
    const menu = document.createElement('div')
    menu.dataset.slot = 'context-menu-content'
    const menuItem = document.createElement('div')
    menu.append(menuItem)

    expect(isItemSurfaceInteractionTarget(menu)).toBe(true)
    expect(isItemSurfaceInteractionTarget(menuItem)).toBe(true)
  })

  it('opens the focused selected item during multi-selection', () => {
    const note = createNote()
    const folder = createFolder()

    expect(getKeyboardOpenItem({ selectedItems: [note, folder], focusedItemId: folder._id })).toBe(
      folder,
    )
  })

  it('falls back to the first selected item when focused item is outside the selection', () => {
    const note = createNote()
    const folder = createFolder()

    expect(
      getKeyboardOpenItem({
        selectedItems: [note, folder],
        focusedItemId: testId<'sidebarItems'>('other_item'),
      }),
    ).toBe(note)
  })

  it('pastes into a focused selected folder and otherwise uses the active surface parent', () => {
    const surfaceParentId = testId<'sidebarItems'>('parent_1')
    const note = createNote()
    const folder = createFolder()

    expect(
      getKeyboardPasteParentId({
        selectedItems: [note, folder],
        focusedItemId: folder._id,
        surfaceParentId,
      }),
    ).toBe(folder._id)
    expect(
      getKeyboardPasteParentId({
        selectedItems: [note, folder],
        focusedItemId: note._id,
        surfaceParentId,
      }),
    ).toBe(surfaceParentId)
  })
})
