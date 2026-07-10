import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { ResourceStatus } from '@wizard-archive/editor/resources/resource-contract'

import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { collectSidebarChildrenMap } from '../filesystem/children'

const MAX_DESCENDANT_DEPTH = 50

function flattenDescendants(
  folderId: Id<'sidebarItems'>,
  childrenMap: ReadonlyMap<Id<'sidebarItems'>, Array<Doc<'sidebarItems'>>>,
  result: Array<Doc<'sidebarItems'>>,
) {
  const children = childrenMap.get(folderId) ?? []
  const childFolders: Array<Doc<'sidebarItems'>> = []

  for (const child of children) {
    if (child.type === RESOURCE_TYPES.folders) {
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
    status: ResourceStatus
    folderId: Id<'sidebarItems'>
    maxDepth?: number
  },
): Promise<Array<Doc<'sidebarItems'>>> {
  const result: Array<Doc<'sidebarItems'>> = []
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
