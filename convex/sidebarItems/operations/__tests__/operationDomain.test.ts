import { describe, expect, it } from 'vitest'
import { PERMISSION_LEVEL } from '../../../permissions/types'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../types/baseTypes'
import { planMoveOperations } from '../planner'
import { normalizeTopLevelSelectedItems } from '../selection'
import type { Id } from '../../../_generated/dataModel'
import type { AnySidebarItem } from '../../types/types'

function item(
  id: string,
  name: string,
  type: AnySidebarItem['type'] = SIDEBAR_ITEM_TYPES.notes,
  overrides: Partial<AnySidebarItem> = {},
): AnySidebarItem {
  return {
    _id: id as Id<'sidebarItems'>,
    _creationTime: 1,
    name: name as AnySidebarItem['name'],
    slug: name.toLowerCase() as AnySidebarItem['slug'],
    campaignId: 'campaign' as Id<'campaigns'>,
    iconName: null,
    color: null,
    type,
    parentId: null,
    allPermissionLevel: null,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'user' as Id<'userProfiles'>,
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
    ...overrides,
  } as AnySidebarItem
}

describe('sidebar operation domain', () => {
  it('normalizes selected roots and plans moves from backend-side shared modules', () => {
    const folder = item('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders)
    const child = item('note-1', 'Child', SIDEBAR_ITEM_TYPES.notes, {
      parentId: folder._id,
    })
    const itemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([
      [folder._id, folder],
      [child._id, child],
    ])

    const selectedRoots = normalizeTopLevelSelectedItems([folder, child], itemsMap)
    const plan = planMoveOperations({
      items: selectedRoots,
      targetParentId: null,
      targetItems: [],
      getChildren: (parentId) => (parentId === folder._id ? [child] : []),
    })

    expect(selectedRoots.map((selected) => selected._id)).toEqual([folder._id])
    expect(plan).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [],
    })
  })
})
