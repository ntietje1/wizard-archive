import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'
import { RESOURCE_TYPES } from '../../items-persistence-contract'
import { createWorkspaceResource } from '../../runtime'
import { createCreationActions } from '../actions/creation-actions'
import { CREATE_PARENT_TARGET_KIND } from '../../items'

const handleErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../../../errors/handle-error', () => ({
  handleError: handleErrorMock,
}))

describe('createCreationActions', () => {
  beforeEach(() => {
    handleErrorMock.mockReset()
  })

  it('opens and renames the item created from a folder context menu', async () => {
    const folder = createFolder()
    const created = createNote({ parentId: folder.id })
    const createItem = vi.fn(() => ({
      status: 'completed' as const,
      id: created.id,
      slug: created.slug,
    }))
    const openItem = vi.fn()
    const setRenamingItemId = vi.fn()
    const actions = createCreationActions({
      createItem,
      openItem,
      setRenamingItemId,
    })

    actions.createNote({
      surface: 'sidebar',
      item: folder,
      selectedItems: [folder],
    })

    expect(createItem).toHaveBeenCalledExactlyOnceWith({
      name: 'Untitled Note',
      type: RESOURCE_TYPES.notes,
      parentTarget: { kind: CREATE_PARENT_TARGET_KIND.direct, parentId: folder.id },
    })
    await waitFor(() => {
      expect(openItem).toHaveBeenCalledExactlyOnceWith(createWorkspaceResource(created.id))
    })
    expect(setRenamingItemId).toHaveBeenCalledExactlyOnceWith(created.id)
  })

  it('leaves navigation unchanged when creation does not complete', () => {
    const createItem = vi.fn(() => ({
      status: 'failed' as const,
      reason: 'create_failed' as const,
    }))
    const openItem = vi.fn()
    const setRenamingItemId = vi.fn()
    const actions = createCreationActions({
      createItem,
      openItem,
      setRenamingItemId,
    })

    actions.createNote({
      surface: 'sidebar',
      item: undefined,
      selectedItems: [],
    })

    expect(createItem).toHaveBeenCalled()
    expect(openItem).not.toHaveBeenCalled()
    expect(setRenamingItemId).not.toHaveBeenCalled()
  })

  it('rejects non-folder parent contexts before creating', () => {
    const note = createNote()
    const createItem = vi.fn()
    const openItem = vi.fn()
    const setRenamingItemId = vi.fn()
    const actions = createCreationActions({
      createItem,
      openItem,
      setRenamingItemId,
    })

    actions.createNote({
      surface: 'sidebar',
      item: note,
      selectedItems: [note],
    })

    expect(createItem).not.toHaveBeenCalled()
    expect(openItem).not.toHaveBeenCalled()
    expect(setRenamingItemId).not.toHaveBeenCalled()
    expect(handleErrorMock).toHaveBeenCalledExactlyOnceWith(
      new Error('Invalid parent type'),
      'Failed to create note',
    )
  })
})
