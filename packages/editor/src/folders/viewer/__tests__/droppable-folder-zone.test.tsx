import type { ResourceId } from '../../../resources/domain-id'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FolderItem } from '../../../workspace/items'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import { DroppableFolderZone } from '../droppable-folder-zone'

vi.mock('../../../drag-drop/use-sidebar-item-drop-target', () => ({
  useSidebarItemDropTarget: () => ({
    dropTargetRef: { current: null },
    isDropTarget: false,
    isFileDropTarget: false,
    isTrashAction: false,
  }),
}))

describe('DroppableFolderZone', () => {
  it('preserves its accessibility label and focus behavior over consumer props', () => {
    render(
      <DroppableFolderZone
        folder={createFolderItem()}
        source={{ canDropIntoFolder: () => false }}
        aria-label="custom label"
        tabIndex={0}
      >
        Folder contents
      </DroppableFolderZone>,
    )

    const zone = screen.getByRole('region', { name: 'Session Prep folder contents' })

    expect(zone).toHaveAttribute('tabIndex', '-1')
  })
})

function createFolderItem(): FolderItem {
  return {
    id: 'folder-1' as ResourceId,
    name: 'Session Prep',
    type: RESOURCE_TYPES.folders,
    isTrashed: false,
  } as unknown as FolderItem
}
