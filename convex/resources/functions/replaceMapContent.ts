import {
  assertVersionStamp,
  successorVersion,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import { initialMapContentVersion } from '@wizard-archive/editor/resources/map-session-policy'
import { resourceAuthoredDestinationOccurrences } from '@wizard-archive/editor/resources/authored-destination'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc } from '../../_generated/dataModel'
import { mapAssetIds, queueAssetRetirements } from './assetContent'
import { loadValidMapContentRows, projectMapContent } from './mapContent'
import { replaceResourceReferenceProjection } from './resourceReferences'

type MapCheckpoint = Extract<Doc<'itemHistoryCheckpoints'>, { kind: 'map' }>

export async function replaceMapContent(
  ctx: CampaignMutationCtx,
  args: Readonly<{
    resourceId: ResourceId
    expectedVersion: unknown
    checkpoint: MapCheckpoint
  }>,
) {
  const current = await loadValidMapContentRows(
    ctx.db,
    args.resourceId,
    ctx.resourceScope.campaignId,
  )
  if (current.status !== 'ready' || current.content.state !== 'ready') {
    return { status: 'resource_unavailable' as const }
  }
  const currentVersion = assertVersionStamp(current.content.version)
  if (!versionStampEquals(currentVersion, assertVersionStamp(args.expectedVersion))) {
    return { status: 'content_changed' as const }
  }

  let projected
  try {
    projected = projectMapContent(args.checkpoint, args.checkpoint.pins)
  } catch {
    return { status: 'snapshot_incompatible' as const }
  }
  const snapshotVersion = assertVersionStamp(args.checkpoint.version)
  if ((await initialMapContentVersion(projected)).digest !== snapshotVersion.digest) {
    return { status: 'snapshot_incompatible' as const }
  }
  const version = successorVersion(currentVersion, snapshotVersion.digest)
  const targetAssets = new Set(mapAssetIds(args.checkpoint))
  const currentAssets = new Set(mapAssetIds(current.content))
  const targetOwners = await Promise.all(
    [...targetAssets].map(async (assetId) => {
      const [storage, owner] = await Promise.all([
        ctx.db
          .query('fileStorage')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetId))
          .unique(),
        ctx.db
          .query('resourceAssetOwners')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetId))
          .unique(),
      ])
      return { assetId, storage, owner }
    }),
  )
  if (
    targetOwners.some(
      ({ owner, storage }) =>
        storage?.status !== 'committed' ||
        storage.storageId === null ||
        (owner !== null &&
          (owner.campaignUuid !== ctx.resourceScope.campaignId ||
            owner.resourceUuid !== args.resourceId)),
    )
  ) {
    return { status: 'snapshot_incompatible' as const }
  }

  const removedAssets = new Set([...currentAssets].filter((assetId) => !targetAssets.has(assetId)))
  const removedOwners = await Promise.all(
    [...removedAssets].map((assetId) =>
      ctx.db
        .query('resourceAssetOwners')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetId))
        .unique(),
    ),
  )
  if (
    removedOwners.some(
      (owner) =>
        owner !== null &&
        (owner.campaignUuid !== ctx.resourceScope.campaignId ||
          owner.resourceUuid !== args.resourceId),
    )
  ) {
    return { status: 'resource_unavailable' as const }
  }
  if (
    (
      await replaceResourceReferenceProjection(ctx, {
        campaignId: ctx.resourceScope.campaignId,
        sourceResourceId: args.resourceId,
        sourceVersion: version,
        occurrences: resourceAuthoredDestinationOccurrences(
          projected.pins.map((pin) => pin.destination),
        ),
      })
    ).status !== 'completed'
  ) {
    return { status: 'snapshot_incompatible' as const }
  }

  await Promise.all(
    targetOwners.flatMap(({ assetId, owner }) =>
      owner
        ? []
        : [
            ctx.db.insert('resourceAssetOwners', {
              campaignUuid: ctx.resourceScope.campaignId,
              resourceUuid: args.resourceId,
              assetUuid: assertDomainId(DOMAIN_ID_KIND.asset, assetId),
            }),
          ],
    ),
  )
  await Promise.all(current.pins.map((pin) => ctx.db.delete('resourceMapPins', pin._id)))
  await Promise.all(
    args.checkpoint.pins.map((pin) =>
      ctx.db.insert('resourceMapPins', {
        campaignUuid: ctx.resourceScope.campaignId,
        mapResourceUuid: args.resourceId,
        ...pin,
      }),
    ),
  )
  await ctx.db.patch('resourceMapContents', current.content._id, {
    state: 'ready',
    image: args.checkpoint.image,
    layers: args.checkpoint.layers,
    recentOperations: [],
    version,
  })
  await Promise.all(removedOwners.flatMap((owner) => (owner ? [ctx.db.delete(owner._id)] : [])))
  await queueAssetRetirements(ctx, removedAssets)
  return {
    status: 'completed' as const,
    previous: {
      image: current.content.image,
      layers: current.content.layers,
      pins: current.pins.map(({ mapPinUuid, destination, layerId, x, y, visible }) => ({
        mapPinUuid,
        destination,
        layerId,
        x,
        y,
        visible,
      })),
      version: currentVersion,
    },
    version,
  }
}
