import { describe, expect, it } from 'vitest'
import {
  isEditableHotkeyTarget,
  isItemSurfaceInteractionTarget,
  isModifierShortcut,
} from '../item-surface-hotkeys'
import { getKeyboardOpenItem } from '../item-surface-keyboard'
import { getKeyboardPasteParentId } from '~/features/filesystem/filesystem-targets'
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

  it('detects SVG descendants inside selectable surfaces', () => {
    const item = document.createElement('a')
    item.href = '/folder'
    item.dataset.itemSelectionTarget = 'true'
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    svg.append(path)
    item.append(svg)

    expect(isItemSurfaceInteractionTarget(path)).toBe(true)
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

  it('pastes sidebar-tree selections into their common parent folder', () => {
    const parent = createFolder()
    const note = createNote({ parentId: parent._id })
    const folder = createFolder({ parentId: parent._id })

    expect(
      getKeyboardPasteParentId({
        selectedItems: [note, folder],
        surface: 'sidebar',
        surfaceParentId: null,
      }),
    ).toBe(parent._id)
  })

  it('pastes sidebar-tree root selections at root', () => {
    const folder = createFolder({ parentId: null })

    expect(
      getKeyboardPasteParentId({
        selectedItems: [folder],
        surface: 'sidebar',
        surfaceParentId: null,
      }),
    ).toBeNull()
  })

  it('uses the active surface parent when selected sidebar-tree items span folders', () => {
    const firstParent = createFolder()
    const secondParent = createFolder()
    const first = createNote({ parentId: firstParent._id })
    const second = createNote({ parentId: secondParent._id })

    expect(
      getKeyboardPasteParentId({
        selectedItems: [first, second],
        surface: 'sidebar',
        surfaceParentId: null,
      }),
    ).toBeNull()
  })

  it('uses a non-null active surface parent when selected sidebar-tree items span folders', () => {
    const surfaceParent = createFolder()
    const firstParent = createFolder()
    const secondParent = createFolder()
    const first = createNote({ parentId: firstParent._id })
    const second = createNote({ parentId: secondParent._id })

    expect(
      getKeyboardPasteParentId({
        selectedItems: [first, second],
        surface: 'sidebar',
        surfaceParentId: surfaceParent._id,
      }),
    ).toBe(surfaceParent._id)
  })

  it('uses the active surface parent for folder views regardless of selected child folders', () => {
    const parent = createFolder()
    const childFolder = createFolder({ parentId: parent._id })

    expect(
      getKeyboardPasteParentId({
        selectedItems: [childFolder],
        surface: 'folder-view',
        surfaceParentId: parent._id,
      }),
    ).toBe(parent._id)
  })
})
