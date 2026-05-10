import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { logEditHistory } from '../../editHistory/log'
import { evaluateTrash } from '../operations/capabilities'
import { assertSidebarOperationAllowed } from './operationCapability'
import { trashTree } from './treeOperations'
import type { CampaignMutationCtx } from '../../functions'
import type { AnySidebarItem } from '../types/types'

export async function trashSidebarItemTree(
  ctx: CampaignMutationCtx,
  item: AnySidebarItem,
): Promise<void> {
  assertSidebarOperationAllowed(evaluateTrash({ role: ctx.membership.role }, item))

  await trashTree(ctx, item, {
    deletionTime: Date.now(),
    deletedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: item._id,
    itemType: item.type,
    action: EDIT_HISTORY_ACTION.trashed,
  })
}
