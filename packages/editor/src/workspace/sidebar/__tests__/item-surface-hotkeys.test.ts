import { describe, expect, it } from 'vite-plus/test'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'
import { testResourceId } from '../../../../../../shared/test/resource-id'
import {
  isEditableHotkeyTarget,
  isItemSurfaceHotkeyTarget,
  isItemSurfaceInteractionTarget,
  isNestedInteractiveHotkeyTarget,
  isModifierShortcut,
} from '../item-surface-hotkeys'
import { getKeyboardOpenItem, getKeyboardPasteParentId } from '../item-surface-keyboard'

describe('item surface hotkey utilities', () => {
  it('detects modifier shortcuts with either Ctrl or Meta', () => {
    expect(isModifierShortcut(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }), 'a')).toBe(
      true,
    )
    expect(isModifierShortcut(new KeyboardEvent('keydown', { key: 'A', metaKey: true }), 'a')).toBe(
      true,
    )
    expect(isModifierShortcut(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }), 'X')).toBe(
      true,
    )
    expect(
      isModifierShortcut(
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, altKey: true }),
        'a',
      ),
    ).toBe(false)
    expect(
      isModifierShortcut(
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, shiftKey: true }),
        'a',
      ),
    ).toBe(false)
  })

  it('detects editable hotkey targets from controls, contenteditable, active element, and selection', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    const editable = document.createElement('div')
    editable.tabIndex = 0
    editable.setAttribute('contenteditable', 'true')
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    const child = document.createElement('span')
    child.textContent = 'selected text'
    editable.append(child)
    document.body.append(editable)

    expect(isEditableHotkeyTarget(input)).toBe(true)
    expect(isEditableHotkeyTarget(textarea)).toBe(true)
    expect(isEditableHotkeyTarget(select)).toBe(true)
    expect(isEditableHotkeyTarget(editable)).toBe(true)
    expect(isEditableHotkeyTarget(child)).toBe(true)

    editable.focus()
    expect(isEditableHotkeyTarget(window)).toBe(true)

    const range = document.createRange()
    range.selectNodeContents(child)
    const selection = window.getSelection()
    if (!selection) throw new Error('Expected DOM selection')
    selection.removeAllRanges()
    selection.addRange(range)

    expect(isEditableHotkeyTarget(window)).toBe(true)

    selection.removeAllRanges()
    editable.remove()
  })

  it('detects item surface interaction and hotkey ownership', () => {
    const surface = document.createElement('div')
    surface.dataset.itemSurfaceHotkeyTarget = 'true'
    surface.dataset.itemSelectionTarget = 'true'
    const child = document.createElement('button')
    surface.append(child)
    document.body.append(surface)

    expect(isItemSurfaceInteractionTarget(child)).toBe(true)
    expect(isItemSurfaceHotkeyTarget(child)).toBe(true)

    child.focus()
    expect(isItemSurfaceHotkeyTarget(window)).toBe(true)

    surface.remove()
  })

  it('treats editable controls as item surface interaction targets', () => {
    const input = document.createElement('input')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    const editableChild = document.createElement('span')
    editable.append(editableChild)

    expect(isItemSurfaceInteractionTarget(input)).toBe(true)
    expect(isItemSurfaceInteractionTarget(editableChild)).toBe(true)
  })

  it('detects context menu content as an item-surface interaction target', () => {
    const menu = document.createElement('div')
    menu.dataset.slot = 'context-menu-content'
    const menuItem = document.createElement('div')
    menu.append(menuItem)

    expect(isItemSurfaceInteractionTarget(menu)).toBe(true)
    expect(isItemSurfaceInteractionTarget(menuItem)).toBe(true)
  })

  it('detects nested interactive hotkey targets', () => {
    const roleButton = document.createElement('div')
    roleButton.setAttribute('role', 'button')
    const child = document.createElement('span')
    roleButton.append(child)

    expect(isNestedInteractiveHotkeyTarget(child)).toBe(true)
    expect(isItemSurfaceInteractionTarget(child)).toBe(false)
  })

  it('resolves keyboard open and paste targets from selected sidebar items', () => {
    const parent = createFolder()
    const note = createNote({ parentId: parent.id })
    const folder = createFolder({ parentId: parent.id })

    expect(getKeyboardOpenItem({ selectedItems: [note, folder], focusedItemId: folder.id })).toBe(
      folder,
    )
    expect(
      getKeyboardOpenItem({
        selectedItems: [note, folder],
        focusedItemId: testResourceId('other_item'),
      }),
    ).toBe(note)
    expect(
      getKeyboardPasteParentId({
        selectedItems: [note, folder],
        surface: 'sidebar',
        surfaceParentId: null,
      }),
    ).toBe(parent.id)
  })

  it('uses the active surface parent for folder views and multi-folder sidebar selections', () => {
    const surfaceParent = createFolder()
    const firstParent = createFolder()
    const secondParent = createFolder()
    const first = createNote({ parentId: firstParent.id })
    const second = createNote({ parentId: secondParent.id })
    const childFolder = createFolder({ parentId: surfaceParent.id })

    expect(
      getKeyboardPasteParentId({
        selectedItems: [first, second],
        surface: 'sidebar',
        surfaceParentId: surfaceParent.id,
      }),
    ).toBe(surfaceParent.id)
    expect(
      getKeyboardPasteParentId({
        selectedItems: [childFolder],
        surface: 'folder-view',
        surfaceParentId: surfaceParent.id,
      }),
    ).toBe(surfaceParent.id)
  })
})
