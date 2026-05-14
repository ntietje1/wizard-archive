import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { SidebarItemStatus } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AnySidebarItemRow } from '../types/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import { collectSidebarChildrenMap } from '../filesystem/children'

const MAX_DESCENDANT_DEPTH = 50

function flattenDescendants(
  folderId: Id<'sidebarItems'>,
  childrenMap: ReadonlyMap<Id<'sidebarItems'>, Array<AnySidebarItemRow>>,
  result: Array<AnySidebarItemRow>,
) {
  const children = childrenMap.get(folderId) ?? []
  const childFolders: Array<AnySidebarItemRow> = []

  for (const child of children) {
    if (child.type === SIDEBAR_ITEM_TYPES.folders) {
      childFolders.push(child)
    } else {
      result.push(child)
    }
  }

  for (const childFolder of childFolders) {
    result.push(childFolder)
    flattenDescendants(childFolder._id, childrenMap, result)
  }
}

export async function collectDescendants(
  ctx: QueryCtx | MutationCtx,
  {
    campaignId,
    status,
    folderId,
    maxDepth = MAX_DESCENDANT_DEPTH,
  }: {
    campaignId: Id<'campaigns'>
    status: SidebarItemStatus
    folderId: Id<'sidebarItems'>
    maxDepth?: number
  },
): Promise<Array<AnySidebarItemRow>> {
  const result: Array<AnySidebarItemRow> = []
  const childrenMap = await collectSidebarChildrenMap({
    rootFolderIds: [folderId],
    maxDepth,
    getChildren: (parentId) =>
      ctx.db
        .query('sidebarItems')
        .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
          q.eq('campaignId', campaignId).eq('status', status).eq('parentId', parentId),
        )
        .collect(),
    onDepthExceeded: () => {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar tree depth exceeded')
    },
  })
  flattenDescendants(folderId, childrenMap, result)
  return result
}
