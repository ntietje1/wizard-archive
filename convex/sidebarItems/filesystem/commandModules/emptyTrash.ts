import { CAMPAIGN_MEMBER_ROLE } from '../../../../shared/campaigns/types'
import { ERROR_CODE } from '../../../../shared/errors/client'
import { throwClientError } from '../../../errors'
import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import { buildPermanentDeleteDelta } from './permanentDelete'
import type { ResourceCommand } from '@wizard-archive/editor/resources/transaction-contract'
import type { CampaignMutationCtx } from '../../../functions'
import type { Doc, Id } from '../../../_generated/dataModel'
import type { StoredResourceDelta } from '../deltas'

// Keep empty-trash transactions bounded so one click cannot cause long DB work or UX pauses.
const MAX_EMPTY_TRASH_AFFECTED_ITEMS = 100
type EmptyTrashFileSystemCommand = Extract<ResourceCommand, { type: 'emptyTrash' }>
type StoredSidebarItemRow = Doc<'sidebarItems'>

function selectRootTrashItems(items: Array<StoredSidebarItemRow>): Array<StoredSidebarItemRow> {
  const itemIds = new Set<Id<'sidebarItems'>>(items.map((item) => item._id))
  return items.filter((item) => !item.parentId || !itemIds.has(item.parentId))
}

export async function executeEmptyTrashCommand(
  ctx: CampaignMutationCtx,
  {
    command,
  }: {
    command: EmptyTrashFileSystemCommand
  },
): Promise<StoredResourceDelta> {
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can empty the trash')
  }

  const trashedItems = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_status_deletionTime', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('status', RESOURCE_STATUS.trashed),
    )
    .take(MAX_EMPTY_TRASH_AFFECTED_ITEMS + 1)
  if (trashedItems.length > MAX_EMPTY_TRASH_AFFECTED_ITEMS) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Empty Trash can delete at most ${MAX_EMPTY_TRASH_AFFECTED_ITEMS} items at once`,
    )
  }
  const rootItems = selectRootTrashItems(trashedItems)

  return await buildPermanentDeleteDelta(ctx, command, rootItems)
}
