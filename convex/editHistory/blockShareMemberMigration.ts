import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import type { Id } from '../_generated/dataModel'

type LegacyBlockShareMetadata = {
  status: string
  blockCount?: number
  memberId?: Id<'campaignMembers'>
  campaignMemberId?: Id<'campaignMembers'>
}

function migrateMetadata(metadata: LegacyBlockShareMetadata): LegacyBlockShareMetadata {
  if (!metadata.campaignMemberId) return metadata
  const { campaignMemberId, ...current } = metadata
  return { ...current, memberId: current.memberId ?? campaignMemberId }
}

export function getEditHistoryBlockShareMemberMigrationPatch(row: {
  action: string
  metadata: unknown
}): { metadata: unknown } | undefined {
  if (!row.metadata || typeof row.metadata !== 'object') return undefined
  if (row.action === EDIT_HISTORY_ACTION.block_share_changed) {
    const metadata = row.metadata as LegacyBlockShareMetadata
    return metadata.campaignMemberId ? { metadata: migrateMetadata(metadata) } : undefined
  }
  if (row.action !== EDIT_HISTORY_ACTION.updated || !('changes' in row.metadata)) return undefined

  const changes = row.metadata.changes
  if (!Array.isArray(changes)) return undefined
  let changed = false
  const migratedChanges = changes.map((change: unknown) => {
    if (!change || typeof change !== 'object' || !('action' in change) || !('metadata' in change)) {
      return change
    }
    if (change.action !== EDIT_HISTORY_ACTION.block_share_changed) return change
    const metadata = change.metadata as LegacyBlockShareMetadata
    if (!metadata.campaignMemberId) return change
    changed = true
    return { ...change, metadata: migrateMetadata(metadata) }
  })
  return changed ? { metadata: { changes: migratedChanges } } : undefined
}
