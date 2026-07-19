import { internal } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { ITEM_HISTORY_ACTION } from '@wizard-archive/editor/resources/editor-runtime-contract'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import {
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { CampaignMutationCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'

const YJS_CHECKPOINT_IDLE_MS = 10_000
const YJS_CHECKPOINT_MIN_INTERVAL_MS = 5 * 60_000

export async function queueYjsHistoryCheckpoint(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
  version: VersionStamp,
): Promise<void> {
  const current = await ctx.db
    .query('itemHistoryCaptureIntents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  const value = {
    resourceUuid: resourceId,
    actorMemberUuid: ctx.resourceScope.actorId,
    version,
  }
  if (current) {
    await ctx.db.replace('itemHistoryCaptureIntents', current._id, value)
  } else {
    await ctx.db.insert('itemHistoryCaptureIntents', value)
  }
  await ctx.scheduler.runAfter(
    YJS_CHECKPOINT_IDLE_MS,
    internal.resources.internalMutations.captureYjsHistoryCheckpoint,
    { resourceId, expectedVersion: version },
  )
}

export async function captureYjsHistoryCheckpoint(
  ctx: MutationCtx,
  resourceId: ResourceId,
  expectedVersionValue: unknown,
): Promise<void> {
  const expectedVersion = assertVersionStamp(expectedVersionValue)
  const intent = await ctx.db
    .query('itemHistoryCaptureIntents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  if (!intent || !versionStampEquals(assertVersionStamp(intent.version), expectedVersion)) return

  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (
    !resource ||
    (resource.kind !== 'note' && resource.kind !== 'canvas') ||
    resource.lifecycle !== 'active'
  ) {
    await ctx.db.delete('itemHistoryCaptureIntents', intent._id)
    return
  }

  const delay = await checkpointDelay(ctx, resource, intent)
  if (delay > 0) {
    await ctx.scheduler.runAfter(
      delay,
      internal.resources.internalMutations.captureYjsHistoryCheckpoint,
      { resourceId, expectedVersion },
    )
    return
  }

  const update = await loadYjsCheckpointUpdate(ctx, resource.kind, resourceId, expectedVersion)
  if (!update) {
    await ctx.db.delete('itemHistoryCaptureIntents', intent._id)
    return
  }

  const snapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)
  const historyEntryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
  const createdAt = Date.now()
  await ctx.db.insert('itemHistoryCheckpoints', {
    snapshotUuid: snapshotId,
    campaignUuid: resource.campaignUuid,
    resourceUuid: resourceId,
    kind: resource.kind,
    update,
    version: expectedVersion,
  })
  await ctx.db.insert('itemHistoryEntries', {
    historyEntryUuid: historyEntryId,
    campaignUuid: resource.campaignUuid,
    resourceUuid: resourceId,
    actorMemberUuid: intent.actorMemberUuid,
    action: ITEM_HISTORY_ACTION.contentEdited,
    metadata: null,
    checkpoint: {
      kind: resource.kind,
      snapshotId,
      version: expectedVersion,
    },
    createdAt,
  })
  await ctx.db.delete('itemHistoryCaptureIntents', intent._id)
}

async function checkpointDelay(
  ctx: MutationCtx,
  resource: Doc<'resources'>,
  intent: { actorMemberUuid: CampaignMemberId },
): Promise<number> {
  const previous = await ctx.db
    .query('itemHistoryEntries')
    .withIndex('by_resource_action_history', (query) =>
      query
        .eq('campaignUuid', resource.campaignUuid)
        .eq('resourceUuid', resource.resourceUuid)
        .eq('action', ITEM_HISTORY_ACTION.contentEdited),
    )
    .order('desc')
    .first()
  if (!previous || previous.actorMemberUuid !== intent.actorMemberUuid) return 0
  return Math.max(0, previous.createdAt + YJS_CHECKPOINT_MIN_INTERVAL_MS - Date.now())
}

async function loadYjsCheckpointUpdate(
  ctx: MutationCtx,
  kind: 'note' | 'canvas',
  resourceId: ResourceId,
  expectedVersion: VersionStamp,
): Promise<ArrayBuffer | null> {
  const table = kind === 'note' ? 'resourceNoteContents' : 'resourceCanvasContents'
  const content = await ctx.db
    .query(table)
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  return content && versionStampEquals(assertVersionStamp(content.version), expectedVersion)
    ? content.update
    : null
}
