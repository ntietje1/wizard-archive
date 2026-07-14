import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import type {
  EditHistoryChange,
  EditHistoryMetadataMap,
  LogEditHistoryArgs,
} from '@wizard-archive/editor/resources/history-contract'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-contract'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { HistoryEntryId } from '@wizard-archive/editor/resources/domain-id'

type EditHistoryCtx = Pick<MutationCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id'>
  membership: Pick<Doc<'campaignMembers'>, '_id'>
}

type LogEditHistoryBase = {
  itemId: Id<'sidebarItems'>
  itemType: ResourceKind
}

type LoggedEditHistory = {
  id: HistoryEntryId
  rowId: Id<'editHistory'>
}

async function insertEditHistory(
  ctx: EditHistoryCtx,
  args: LogEditHistoryArgs,
  options?: { hasSnapshot?: boolean },
): Promise<LoggedEditHistory> {
  const id = generateDomainId(DOMAIN_ID_KIND.historyEntry)
  const rowId = await ctx.db.insert('editHistory', {
    historyEntryUuid: id,
    itemId: args.itemId,
    itemType: args.itemType,
    campaignId: ctx.campaign._id,
    campaignMemberId: ctx.membership._id,
    action: args.action,
    metadata: args.metadata ?? null,
    hasSnapshot: options?.hasSnapshot ?? false,
  })
  return { id, rowId }
}

function toLogEditHistoryArgs<T extends LogEditHistoryArgs['action']>(
  base: LogEditHistoryBase,
  action: T,
  metadata: EditHistoryMetadataMap[T],
): LogEditHistoryArgs {
  return { ...base, action, metadata } as LogEditHistoryArgs
}

export async function logEditHistory(
  ctx: EditHistoryCtx,
  args: LogEditHistoryArgs | (LogEditHistoryBase & { changes: Array<EditHistoryChange> }),
  options?: { hasSnapshot?: boolean },
): Promise<LoggedEditHistory> {
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
