import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it, vi } from 'vite-plus/test'

import { createNote } from '../../test/sidebar-item-factory'
import { applyFileSystemLifecycleIntents } from '../lifecycle-intents'

describe('applyFileSystemLifecycleIntents', () => {
  it('surfaces open-resource intents that point at missing items', async () => {
    const itemId = 'missing_item' as ResourceId

    await expect(
      applyFileSystemLifecycleIntents({
        previousResourceId: null,
        readModel: { getItem: () => undefined },
        intents: [{ type: 'openResource', itemId }],
        adapters: createLifecycleAdapters(),
      }),
    ).rejects.toThrow(`Cannot open missing filesystem resource ${itemId}`)
  })

  it('does not restore a previous location after the guarded resource changes', async () => {
    const clearItemSelection = vi.fn()
    const openResource = vi.fn()
    const clearWorkspaceContent = vi.fn()

    await applyFileSystemLifecycleIntents({
      previousResourceId: 'previous_item' as ResourceId,
      readModel: { getItem: vi.fn() },
      intents: [
        {
          type: 'restorePreviousLocation',
          guardedByItemId: 'created_item' as ResourceId,
        },
      ],
      adapters: {
        setFolderState: vi.fn(),
        setSelectedItemIds: vi.fn(),
        getSelectionState: () => ({
          selectedItemIds: ['created_item' as ResourceId],
          clearItemSelection,
        }),
        getCurrentResourceId: () => 'other_item' as ResourceId,
        openResource,
        clearWorkspaceContent,
      },
    })

    expect(clearItemSelection).not.toHaveBeenCalled()
    expect(openResource).not.toHaveBeenCalled()
    expect(clearWorkspaceContent).not.toHaveBeenCalled()
  })

  it('restores the previous location while still on the guarded resource', async () => {
    const clearItemSelection = vi.fn()
    const openResource = vi.fn()
    const previousItem = createNote({ id: 'previous_item' as ResourceId })

    await applyFileSystemLifecycleIntents({
      previousResourceId: previousItem.id,
      readModel: { getItem: (itemId) => (itemId === previousItem.id ? previousItem : undefined) },
      intents: [
        {
          type: 'restorePreviousLocation',
          guardedByItemId: 'created_item' as ResourceId,
        },
      ],
      adapters: {
        setFolderState: vi.fn(),
        setSelectedItemIds: vi.fn(),
        getSelectionState: () => ({
          selectedItemIds: [],
          clearItemSelection,
        }),
        getCurrentResourceId: () => 'created_item' as ResourceId,
        openResource,
        clearWorkspaceContent: vi.fn(),
      },
    })

    expect(clearItemSelection).toHaveBeenCalledOnce()
    expect(openResource).toHaveBeenCalledWith(previousItem, { replace: true })
  })
})

function createLifecycleAdapters() {
  return {
    setFolderState: vi.fn(),
    setSelectedItemIds: vi.fn(),
    getSelectionState: () => ({
      selectedItemIds: [],
      clearItemSelection: vi.fn(),
    }),
    getCurrentResourceId: () => null,
    openResource: vi.fn(),
    clearWorkspaceContent: vi.fn(),
  }
}
