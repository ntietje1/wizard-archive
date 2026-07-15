import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CanonicalTargetMapEntry } from '@wizard-archive/editor/resources/content-copy-contract'
import {
  parseAuthoredDestination,
  remapAuthoredDestination,
  serializeAuthoredDestination,
} from '@wizard-archive/editor/resources/authored-destination'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import { initialJsonContentVersion } from './contentVersion'
import type { ContentCopyPreparation } from './contentCopyTypes'
import { findCanonicalResource } from './findCanonicalResource'
import { prepareAssetCopies } from './assetContent'

const EMPTY_MAP_CONTENT = { imageAssetUuid: null, layers: [], pins: [] } as const

export async function createMapContent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<void> {
  await ctx.db.insert('resourceMapContents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    state: 'ready',
    imageAssetUuid: null,
    layers: [],
    version: await initialJsonContentVersion(EMPTY_MAP_CONTENT),
  })
}

export async function loadMapContentRows(db: CampaignQueryCtx['db'], resourceId: ResourceId) {
  const [content, pins] = await Promise.all([
    db
      .query('resourceMapContents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
      .unique(),
    db
      .query('resourceMapPins')
      .withIndex('by_mapResourceUuid', (query) => query.eq('mapResourceUuid', resourceId))
      .take(501),
  ])
  return { content, pins }
}

export async function prepareMapContentCopy(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  operationId: OperationId,
  sourceResourceId: ResourceId,
  destinationResourceId: ResourceId,
): Promise<ContentCopyPreparation> {
  const { content, pins } = await loadMapContentRows(ctx.db, sourceResourceId)
  if (!content || content.campaignUuid !== campaignId || pins.length > 500) {
    return { status: 'integrity_error' }
  }
  const assets = await prepareAssetCopies(ctx, campaignId, operationId, destinationResourceId, [
    content.imageAssetUuid,
    ...content.layers.map((layer) => layer.imageAssetUuid),
  ])
  if (!assets) return { status: 'integrity_error' }
  const layerIds = new Set(content.layers.map((layer) => layer.id))
  if (layerIds.size !== content.layers.length) return { status: 'integrity_error' }

  const sourcePins = []
  try {
    for (const pin of pins) {
      const destination = parseAuthoredDestination(pin.destination)
      if (
        !destination ||
        pin.campaignUuid !== campaignId ||
        pin.mapResourceUuid !== sourceResourceId ||
        (destination.kind === 'internal' && destination.target.resourceId === sourceResourceId) ||
        (pin.layerId !== null && !layerIds.has(pin.layerId))
      ) {
        return { status: 'integrity_error' }
      }
      sourcePins.push({
        ...pin,
        mapPinUuid: assertDomainId(DOMAIN_ID_KIND.mapPin, pin.mapPinUuid),
        destination,
      })
    }
  } catch {
    return { status: 'integrity_error' }
  }
  if (
    new Set(sourcePins.map((pin) => pin.mapPinUuid)).size !== sourcePins.length ||
    new Set(sourcePins.map((pin) => serializeAuthoredDestination(pin.destination))).size !==
      sourcePins.length
  ) {
    return { status: 'integrity_error' }
  }
  const internalResourceIds = sourcePins.flatMap((pin) =>
    pin.destination.kind === 'internal' ? [pin.destination.target.resourceId] : [],
  )
  const targets = await Promise.all(
    [...new Set(internalResourceIds)].map((resourceId) =>
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
          destination: remapMapDestination(pin.destination, targetMap),
          layerId: pin.layerId,
          x: pin.x,
          y: pin.y,
          visible: pin.visible,
        }))
        const copiedContent = {
          imageAssetUuid: assets.remap(content.imageAssetUuid),
          layers: content.layers.map((layer) => ({
            ...layer,
            imageAssetUuid: assets.remap(layer.imageAssetUuid),
          })),
          pins: copiedPins.map(({ mapPinUuid, destination, layerId, x, y, visible }) => ({
            mapPinUuid,
            destination,
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
            state: assets.initializing ? 'initializing' : 'ready',
            imageAssetUuid: copiedContent.imageAssetUuid,
            layers: copiedContent.layers,
            version,
          })
          await Promise.all(copiedPins.map((pin) => ctx.db.insert('resourceMapPins', pin)))
          await assets.commit()
        }
      },
    },
  }
}

function remapMapDestination(
  destination: NonNullable<ReturnType<typeof parseAuthoredDestination>>,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
) {
  const result = remapAuthoredDestination(destination, targetMap, 'same_campaign_copy')
  if (result.status !== 'completed') throw new TypeError('Unmapped authored destination')
  return result.destination
}
