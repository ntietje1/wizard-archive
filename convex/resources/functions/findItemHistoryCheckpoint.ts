import type { GenericDatabaseReader } from 'convex/server'
import {
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import type {
  CampaignId,
  HistoryEntryId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { DataModel, Doc } from '../../_generated/dataModel'

type CheckpointEntry = Extract<Doc<'itemHistoryEntries'>, { checkpoint: unknown }>
type HistoryCheckpoint = Doc<'itemHistoryCheckpoints'>

export type ItemHistoryCheckpointLookup =
  | Readonly<{ status: 'history_entry_unavailable' }>
  | Readonly<{ status: 'snapshot_unavailable' }>
  | Readonly<{ status: 'snapshot_incompatible' }>
  | Readonly<{
      status: 'ready'
      entry: CheckpointEntry
      checkpoint: HistoryCheckpoint
    }>

export async function findItemHistoryCheckpoint(
  db: GenericDatabaseReader<DataModel>,
  campaignId: CampaignId,
  resourceId: ResourceId,
  entryId: HistoryEntryId,
  resourceKind: 'note' | 'canvas' | 'map',
): Promise<ItemHistoryCheckpointLookup> {
  const entry = await db
    .query('itemHistoryEntries')
    .withIndex('by_historyEntryUuid', (query) => query.eq('historyEntryUuid', entryId))
    .unique()
  if (
    !entry ||
    entry.campaignUuid !== campaignId ||
    entry.resourceUuid !== resourceId ||
    !('checkpoint' in entry)
  ) {
    return { status: 'history_entry_unavailable' }
  }

  const checkpoint = await db
    .query('itemHistoryCheckpoints')
    .withIndex('by_snapshotUuid', (query) => query.eq('snapshotUuid', entry.checkpoint.snapshotId))
    .unique()
  if (!checkpoint) return { status: 'snapshot_unavailable' }
  if (
    checkpoint.campaignUuid !== campaignId ||
    checkpoint.resourceUuid !== resourceId ||
    checkpoint.kind !== resourceKind ||
    checkpoint.kind !== entry.checkpoint.kind ||
    !versionStampEquals(
      assertVersionStamp(checkpoint.version),
      assertVersionStamp(entry.checkpoint.version),
    )
  ) {
    return { status: 'snapshot_incompatible' }
  }
  return { status: 'ready', entry, checkpoint }
}
