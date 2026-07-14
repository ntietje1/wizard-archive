import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CanonicalTargetMapEntry } from '@wizard-archive/editor/resources/content-copy-contract'
import type { CampaignMutationCtx } from '../../functions'
import { initialJsonContentVersion } from './contentVersion'
import type { ContentCopyPreparation } from './contentCopyTypes'
import { remapResourceId } from './contentCopyTypes'
import { findCanonicalResource } from './findCanonicalResource'

const EMPTY_MAP_CONTENT = { imageAssetUuid: null, layers: [], pins: [] } as const

export async function createMapContent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<void> {
  await ctx.db.insert('resourceMapContents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    imageAssetUuid: null,
    layers: [],
    version: await initialJsonContentVersion(EMPTY_MAP_CONTENT),
  })
}

export async function loadMapContentDeletion(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  const content = await ctx.db
    .query('resourceMapContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  const pins = await ctx.db
    .query('resourceMapPins')
    .withIndex('by_mapResourceUuid', (query) => query.eq('mapResourceUuid', resourceId))
    .take(501)
  return { content, pins }
}

export async function prepareMapContentCopy(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  sourceResourceId: ResourceId,
  destinationResourceId: ResourceId,
): Promise<ContentCopyPreparation> {
  const { content, pins } = await loadMapContentDeletion(ctx, sourceResourceId)
  if (!content || content.campaignUuid !== campaignId || pins.length > 500) {
    return { status: 'integrity_error' }
  }
  if (content.imageAssetUuid !== null || content.layers.some((layer) => layer.imageAssetUuid)) {
    return { status: 'unavailable' }
  }
  const layerIds = new Set(content.layers.map((layer) => layer.id))
  if (layerIds.size !== content.layers.length) return { status: 'integrity_error' }

  const sourcePins = []
  try {
    for (const pin of pins) {
      if (
        pin.campaignUuid !== campaignId ||
        pin.mapResourceUuid !== sourceResourceId ||
        pin.targetResourceUuid === sourceResourceId ||
        (pin.layerId !== null && !layerIds.has(pin.layerId))
      ) {
        return { status: 'integrity_error' }
      }
      sourcePins.push({
        ...pin,
        mapPinUuid: assertDomainId(DOMAIN_ID_KIND.mapPin, pin.mapPinUuid),
        targetResourceUuid: assertDomainId(DOMAIN_ID_KIND.resource, pin.targetResourceUuid),
      })
    }
  } catch {
    return { status: 'integrity_error' }
  }
  if (
    new Set(sourcePins.map((pin) => pin.mapPinUuid)).size !== sourcePins.length ||
    new Set(sourcePins.map((pin) => pin.targetResourceUuid)).size !== sourcePins.length
  ) {
    return { status: 'integrity_error' }
  }
  const targets = await Promise.all(
    [...new Set(sourcePins.map((pin) => pin.targetResourceUuid))].map((resourceId) =>
      findCanonicalResource(ctx.db, resourceId),
    ),
  )
  if (targets.some((resource) => resource?.campaignUuid !== campaignId)) {
    return { status: 'integrity_error' }
  }

  const allocated = sourcePins.map((pin) => ({
    sourceId: pin.mapPinUuid,
    destinationId: generateDomainId(DOMAIN_ID_KIND.mapPin),
    pin,
  }))
  const referenceableTargets: Array<CanonicalTargetMapEntry> = allocated.map(
    ({ sourceId, destinationId }) => ({
      source: { kind: 'mapPin', resourceId: sourceResourceId, pinId: sourceId },
      destination: {
        kind: 'mapPin',
        resourceId: destinationResourceId,
        pinId: destinationId,
      },
    }),
  )

  return {
    status: 'ready',
    plan: {
      referenceableTargets,
      finalize: async (targetMap) => {
        const copiedPins = allocated.map(({ destinationId, pin }) => ({
          campaignUuid: campaignId,
          mapResourceUuid: destinationResourceId,
          mapPinUuid: destinationId,
          targetResourceUuid: remapResourceId(targetMap, pin.targetResourceUuid),
          layerId: pin.layerId,
          x: pin.x,
          y: pin.y,
          visible: pin.visible,
        }))
        const copiedContent = {
          imageAssetUuid: null,
          layers: content.layers,
          pins: copiedPins.map(({ mapPinUuid, targetResourceUuid, layerId, x, y, visible }) => ({
            mapPinUuid,
            targetResourceUuid,
            layerId,
            x,
            y,
            visible,
          })),
        }
        const version = await initialJsonContentVersion(copiedContent)
        return async () => {
          await ctx.db.insert('resourceMapContents', {
            campaignUuid: campaignId,
            resourceUuid: destinationResourceId,
            imageAssetUuid: null,
            layers: content.layers,
            version,
          })
          await Promise.all(copiedPins.map((pin) => ctx.db.insert('resourceMapPins', pin)))
        }
      },
    },
  }
}
