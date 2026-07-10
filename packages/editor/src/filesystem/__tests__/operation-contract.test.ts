import { describe, expect, it } from 'vite-plus/test'

import type { SidebarItemId } from '../../../../../shared/common/ids'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { planTransferOperations } from '../operation-contract'
import type { ResourceOperationDecision } from '../transaction-contract'

describe('planTransferOperations', () => {
  it('plans explicit folder merge conflict decisions', () => {
    const sourceFolder = createFolder({
      id: 'source_folder' as SidebarItemId,
      name: 'Scenes',
    })
    const sourceChild = createNote({
      id: 'source_child' as SidebarItemId,
      name: 'Act I',
      parentId: sourceFolder.id,
    })
    const targetFolder = createFolder({
      id: 'target_folder' as SidebarItemId,
      name: 'Scenes',
    })
    const itemsById = new Map<SidebarItemId, { id: SidebarItemId; parentId: SidebarItemId | null }>(
      [
        [sourceFolder.id, sourceFolder],
        [sourceChild.id, sourceChild],
        [targetFolder.id, targetFolder],
      ],
    )

    const plan = planTransferOperations({
      mode: 'copy',
      items: [sourceFolder],
      itemsById,
      targetParentId: null,
      targetItems: [targetFolder],
      decisions: [
        { sourceItemId: sourceFolder.id, action: 'mergeFolder' },
      ] satisfies Array<ResourceOperationDecision>,
      getChildren: (parentId) => (parentId === sourceFolder.id ? [sourceChild] : []),
    })

    expect(plan).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceChild.id,
          action: 'place',
          targetParentId: targetFolder.id,
          name: 'Act I',
        },
        {
          sourceItemId: sourceFolder.id,
          action: 'mergeFolder',
          targetParentId: null,
          destinationItemId: targetFolder.id,
        },
      ],
    })
  })
})
