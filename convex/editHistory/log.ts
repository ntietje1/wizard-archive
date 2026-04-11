import { EDIT_HISTORY_ACTION } from './types'
import type { CampaignMutationCtx } from '../functions'
import type { Id } from '../_generated/dataModel'
import type {
  EditHistoryAction,
  EditHistoryChange,
  EditHistoryMetadataMap,
  LogEditHistoryArgs,
} from './types'
import type { SidebarItemType } from '../sidebarItems/types/baseTypes'

type LogEditHistoryBase = {
  itemId: Id<'sidebarItems'>
  itemType: SidebarItemType
}

async function insertEditHistory(
  ctx: CampaignMutationCtx,
  args: LogEditHistoryArgs,
  options?: { hasSnapshot?: boolean },
): Promise<Id<'editHistory'>> {
  return await ctx.db.insert('editHistory', {
    itemId: args.itemId,
    itemType: args.itemType,
    campaignId: ctx.campaign._id,
    campaignMemberId: ctx.membership._id,
    action: args.action,
    metadata: args.metadata ?? null,
    hasSnapshot: options?.hasSnapshot ?? false,
  })
}

function toLogEditHistoryArgs<T extends EditHistoryAction>(
  base: LogEditHistoryBase,
  action: T,
  metadata: EditHistoryMetadataMap[T],
): LogEditHistoryArgs {
  return { ...base, action, metadata } as LogEditHistoryArgs
}

export async function logEditHistory(
  ctx: CampaignMutationCtx,
  args: LogEditHistoryArgs | (LogEditHistoryBase & { changes: Array<EditHistoryChange> }),
  options?: { hasSnapshot?: boolean },
): Promise<Id<'editHistory'>> {
  if ('action' in args) {
    return insertEditHistory(ctx, args, options)
  }

  const { changes, ...base } = args

  if (changes.length === 0) {
    throw new Error('Cannot log edit history with no changes')
  }

  if (changes.length === 1) {
    return insertEditHistory(
      ctx,
      toLogEditHistoryArgs(base, changes[0].action, changes[0].metadata),
      options,
    )
  }

  return insertEditHistory(
    ctx,
    {
      ...base,
      action: EDIT_HISTORY_ACTION.updated,
      metadata: { changes },
    },
    options,
  )
}
