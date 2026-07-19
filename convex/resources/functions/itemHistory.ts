import { internal } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { ITEM_HISTORY_ACTION } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type {
  ItemHistoryMapEvent,
  ItemHistoryTimelineEvent,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { AuthoredDestination } from '@wizard-archive/editor/resources/authored-destination-contract'
import type {
  MapContentCommand,
  MapResourceContent,
} from '@wizard-archive/editor/resources/content-session-contract'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import {
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { CampaignMutationCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'
import { mapAssetIds } from './assetContent'
import { loadValidMapContentRows } from './mapContent'

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

export async function recordMapHistoryCheckpoint(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
  version: VersionStamp,
  event: ItemHistoryMapEvent,
): Promise<void> {
  const rows = await loadValidMapContentRows(ctx.db, resourceId, ctx.resourceScope.campaignId)
  if (
    rows.status !== 'ready' ||
    rows.content.state !== 'ready' ||
    !versionStampEquals(assertVersionStamp(rows.content.version), version)
  ) {
    throw new TypeError('Cannot checkpoint invalid map content')
  }

  const snapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)
  const createdAt = Date.now()
  await ctx.db.insert('itemHistoryCheckpoints', {
    snapshotUuid: snapshotId,
    campaignUuid: ctx.resourceScope.campaignId,
    resourceUuid: resourceId,
    kind: 'map',
    image: rows.content.image,
    layers: rows.content.layers,
    pins: rows.projected.pins.map((pin) => ({
      mapPinUuid: pin.id,
      destination: pin.destination,
      layerId: pin.layerId,
      x: pin.x,
      y: pin.y,
      visible: pin.visible,
    })),
    version,
  })
  await Promise.all(
    [...new Set(mapAssetIds(rows.content))].map((assetUuid) =>
      ctx.db.insert('itemHistoryCheckpointAssets', { snapshotUuid: snapshotId, assetUuid }),
    ),
  )
  await ctx.db.insert('itemHistoryEntries', {
    historyEntryUuid: generateDomainId(DOMAIN_ID_KIND.historyEntry),
    campaignUuid: ctx.resourceScope.campaignId,
    resourceUuid: resourceId,
    actorMemberUuid: ctx.resourceScope.actorId,
    ...event,
    checkpoint: { kind: 'map', snapshotId, version },
    createdAt,
  })
}

export async function recordItemHistoryEvent(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
  event: ItemHistoryTimelineEvent,
): Promise<void> {
  await ctx.db.insert('itemHistoryEntries', {
    historyEntryUuid: generateDomainId(DOMAIN_ID_KIND.historyEntry),
    campaignUuid: ctx.resourceScope.campaignId,
    resourceUuid: resourceId,
    actorMemberUuid: ctx.resourceScope.actorId,
    ...event,
    createdAt: Date.now(),
  })
}

export async function recordMapCommandHistoryCheckpoint(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
  version: VersionStamp,
  previousContent: MapResourceContent,
  command: MapContentCommand,
): Promise<void> {
  await recordMapHistoryCheckpoint(
    ctx,
    resourceId,
    version,
    await mapCommandHistoryEvent(ctx, previousContent, command),
  )
}

async function mapCommandHistoryEvent(
  ctx: CampaignMutationCtx,
  content: MapResourceContent,
  command: MapContentCommand,
): Promise<ItemHistoryMapEvent> {
  switch (command.type) {
    case 'createPins':
      return {
        action: ITEM_HISTORY_ACTION.mapPinAdded,
        metadata: {
          pinLabel:
            command.pins.length === 1
              ? await mapPinHistoryLabel(ctx, command.pins[0]!.destination)
              : `${command.pins.length} items`,
        },
      }
    case 'movePin':
      return mapPinEvent(
        ctx,
        ITEM_HISTORY_ACTION.mapPinMoved,
        mapPinDestination(content, command.pinId),
      )
    case 'removePin':
      return mapPinEvent(
        ctx,
        ITEM_HISTORY_ACTION.mapPinRemoved,
        mapPinDestination(content, command.pinId),
      )
    case 'setPinVisibility':
      return {
        action: ITEM_HISTORY_ACTION.mapPinVisibilityChanged,
        metadata: {
          pinLabel: await mapPinHistoryLabel(ctx, mapPinDestination(content, command.pinId)),
          visible: command.visible,
        },
      }
  }
}

async function mapPinEvent(
  ctx: CampaignMutationCtx,
  action: typeof ITEM_HISTORY_ACTION.mapPinMoved | typeof ITEM_HISTORY_ACTION.mapPinRemoved,
  destination: AuthoredDestination,
): Promise<ItemHistoryMapEvent> {
  return { action, metadata: { pinLabel: await mapPinHistoryLabel(ctx, destination) } }
}

function mapPinDestination(
  content: MapResourceContent,
  pinId: Extract<MapContentCommand, { type: 'movePin' }>['pinId'],
) {
  return content.pins.find((pin) => pin.id === pinId)!.destination
}

async function mapPinHistoryLabel(
  ctx: Pick<CampaignMutationCtx, 'db'>,
  destination: AuthoredDestination,
): Promise<string> {
  if (destination.kind === 'externalUrl') return destination.url
  if (destination.kind === 'unresolved') return destination.rawTarget || 'Unknown'
  return (await findCanonicalResource(ctx.db, destination.target.resourceId))?.title ?? 'Unknown'
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
