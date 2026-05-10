import { describe, expect, it, vi } from 'vitest'
import { createFilesystemActions } from '../filesystem-actions'
import type { SidebarItemOperationsValue } from '~/features/sidebar/operations/useSidebarItemOperations'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'

function createItemOperations(overrides?: Partial<SidebarItemOperationsValue>) {
  return {
    selectedItems: [],
    dialog: null,
    copyItems: vi.fn(),
    cutItems: vi.fn(),
    pasteClipboard: vi.fn(),
    duplicateItems: vi.fn(),
    moveItems: vi.fn(),
    restoreItems: vi.fn(),
    trashItems: vi.fn(),
    permanentlyDeleteItems: vi.fn(),
    confirmPermanentDeleteItems: vi.fn(),
    normalizeItems: (items) => items,
    ...overrides,
  } satisfies SidebarItemOperationsValue
}

describe('createFilesystemActions', () => {
  it('pastes into a right-clicked folder', () => {
    const folder = createFolder()
    const itemOperations = createItemOperations()
    const actions = createFilesystemActions({
      itemOperations,
      parentItemsMap: new Map(),
      setDeleteFolderDialog: vi.fn(),
    })

    actions.paste({ surface: 'sidebar', item: folder })

    expect(itemOperations.pasteClipboard).toHaveBeenCalledWith(folder._id)
  })

  it('pastes into the common parent when right-clicking a selected non-folder item', () => {
    const parent = createFolder()
    const first = createNote({ parentId: parent._id })
    const second = createNote({ parentId: parent._id })
    const itemOperations = createItemOperations()
    const actions = createFilesystemActions({
      itemOperations,
      parentItemsMap: new Map(),
      setDeleteFolderDialog: vi.fn(),
    })

    actions.paste({
      surface: 'sidebar',
      item: first,
      primaryItem: first,
      selectedItems: [first, second],
    })

    expect(itemOperations.pasteClipboard).toHaveBeenCalledWith(parent._id)
  })

  it('lets the active surface decide when selected paste items do not share a parent', () => {
    const first = createNote({ parentId: null })
    const folder = createFolder()
    const second = createNote({ parentId: folder._id })
    const itemOperations = createItemOperations()
    const actions = createFilesystemActions({
      itemOperations,
      parentItemsMap: new Map(),
      setDeleteFolderDialog: vi.fn(),
    })

    actions.paste({
      surface: 'sidebar',
      item: first,
      primaryItem: first,
      selectedItems: [first, second],
    })

    expect(itemOperations.pasteClipboard).toHaveBeenCalledWith(undefined)
  })
})
