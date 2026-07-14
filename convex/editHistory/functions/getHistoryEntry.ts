import { DOMAIN_ID_KIND, parseDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { HistoryEntryId } from '@wizard-archive/editor/resources/domain-id'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { Doc } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'

export function requireHistoryEntryId(value: string): HistoryEntryId {
  const id = parseDomainId(DOMAIN_ID_KIND.historyEntry, value)
  if (!id) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'History entry ID must be a lowercase UUIDv7')
  }
  return id
}

export async function getHistoryEntryRow(
  ctx: Pick<QueryCtx, 'db'>,
  id: HistoryEntryId,
): Promise<Doc<'editHistory'> | null> {
  return await ctx.db
    .query('editHistory')
    .withIndex('by_historyEntryUuid', (query) => query.eq('historyEntryUuid', id))
    .unique()
}
