import { CAMPAIGN_MEMBER_ROLE } from '../../../campaigns/types'
import { ERROR_CODE, throwClientError } from '../../../errors'
import { SIDEBAR_ITEM_STATUS } from '../../types/baseTypes'
import { createFileSystemWriteSession } from '../deltas'
import { FILE_SYSTEM_EVENT_TYPE, fileSystemSelfEvents } from '../receipts'
import type { CampaignMutationCtx } from '../../../functions'
import type { EmptyTrashFileSystemCommand } from '../commands'
import type { FileSystemDelta } from '../receipts'
import type { AnySidebarItemRow } from '../../types/types'
import type { Id } from '../../../_generated/dataModel'

// Keep empty-trash transactions bounded so one click cannot cause long DB work or UX pauses.
const MAX_EMPTY_TRASH_AFFECTED_ITEMS = 100

function selectRootTrashItems(items: Array<AnySidebarItemRow>): Array<AnySidebarItemRow> {
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
): Promise<FileSystemDelta> {
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can empty the trash')
  }

  const session = createFileSystemWriteSession(ctx)
  const trashedItems = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_status_deletionTime', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('status', SIDEBAR_ITEM_STATUS.trashed),
    )
    .take(MAX_EMPTY_TRASH_AFFECTED_ITEMS)
  const rootItems = selectRootTrashItems(trashedItems)

  for (const item of rootItems) {
    await session.deleteSidebarTree(item)
  }
  const events = fileSystemSelfEvents(
    FILE_SYSTEM_EVENT_TYPE.deletedForever,
    rootItems.map((item) => item._id),
  )

  return await session.build({
    command,
    events,
    undoable: false,
  })
}
