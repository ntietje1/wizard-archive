import { describe, expect, it, vi } from 'vitest'
import { createFilesystemActions } from '../filesystem-actions'
import type { FileSystemValue } from '~/features/filesystem/useFileSystem'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'

function createFileSystem(overrides?: Partial<FileSystemValue>) {
  return {
    createItem: vi.fn(),
    discardCreatedItem: vi.fn(),
    renameItem: vi.fn(),
    duplicateItems: vi.fn(),
    requestTrashItems: vi.fn().mockResolvedValue(false),
    restoreItems: vi.fn(),
    emptyTrash: vi.fn(),
    confirmDeleteForever: vi.fn(),
    copy: vi.fn(),
    cut: vi.fn(),
    cancelClipboard: vi.fn(),
    canPaste: true,
    paste: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    executeDrop: vi.fn(),
    canUndo: false,
    canRedo: false,
    ...overrides,
  } satisfies FileSystemValue
}

describe('createFilesystemActions', () => {
  it('pastes into a right-clicked folder', () => {
    const folder = createFolder()
    const filesystem = createFileSystem()
    const actions = createFilesystemActions({
      filesystem,
    })

    actions.paste({ surface: 'sidebar', item: folder })

    expect(filesystem.paste).toHaveBeenCalledWith(folder._id)
  })

  it('pastes into the common parent when right-clicking a selected non-folder item', () => {
    const parent = createFolder()
    const first = createNote({ parentId: parent._id })
    const second = createNote({ parentId: parent._id })
    const filesystem = createFileSystem()
    const actions = createFilesystemActions({
      filesystem,
    })

    actions.paste({
      surface: 'sidebar',
      item: first,
      primaryItem: first,
      selectedItems: [first, second],
    })

    expect(filesystem.paste).toHaveBeenCalledWith(parent._id)
  })

  it('lets the active surface decide when selected paste items do not share a parent', () => {
    const first = createNote({ parentId: null })
    const folder = createFolder()
    const second = createNote({ parentId: folder._id })
    const filesystem = createFileSystem()
    const actions = createFilesystemActions({
      filesystem,
    })

    actions.paste({
      surface: 'sidebar',
      item: first,
      primaryItem: first,
      selectedItems: [first, second],
    })

    expect(filesystem.paste).toHaveBeenCalledWith(undefined)
  })
})
