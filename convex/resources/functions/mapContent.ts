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
import { isMapPosition } from '@wizard-archive/editor/resources/content-session-contract'
import type { MapImageAttachment } from '@wizard-archive/editor/resources/content-session-contract'
import { assertSha256Digest } from '@wizard-archive/editor/resources/component-version'
import {
  parseAuthoredDestination,
  remapAuthoredDestination,
  serializeAuthoredDestination,
} from '@wizard-archive/editor/resources/authored-destination'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import type { Doc } from '../../_generated/dataModel'
import { initialJsonContentVersion } from './contentVersion'
import type { ContentCopyPreparation } from './contentCopyTypes'
import { findCanonicalResource } from './findCanonicalResource'
import { prepareAssetCopies } from './assetContent'
import { loadPendingAssetState } from './assetContentState'
import { authorizeResourceContent } from './authorizeResourceContent'

const EMPTY_MAP_CONTENT = {
  image: { status: 'unattached' as const },
  layers: [],
  pins: [],
} as const

export async function createMapContent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<void> {
  const existing = await ctx.db
    .query('resourceMapContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  if (existing) {
    if (existing.campaignUuid === campaignId) return
    throw new TypeError('Map content already exists')
  }
  await ctx.db.insert('resourceMapContents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    state: 'ready',
    image: null,
    layers: [],
    recentOperations: [],
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

export async function loadValidMapContentRows(
  db: CampaignQueryCtx['db'],
  resourceId: ResourceId,
  campaignId: CampaignId,
) {
  const rows = await loadMapContentRows(db, resourceId)
  if (!rows.content) return { status: 'missing' as const }
  if (
    rows.content.campaignUuid !== campaignId ||
    rows.pins.length > 500 ||
    rows.pins.some((pin) => pin.campaignUuid !== campaignId || pin.mapResourceUuid !== resourceId)
  ) {
    return { status: 'corrupt' as const }
  }
  try {
    return {
      status: 'ready' as const,
      content: rows.content,
      pins: rows.pins,
      projected: projectMapContent(rows.content, rows.pins),
    }
  } catch {
    return { status: 'corrupt' as const }
  }
}

export async function loadMapContentState(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const rows = await loadValidMapContentRows(ctx.db, resourceId, ctx.resourceScope.campaignId)
  if (rows.status !== 'ready') {
    return {
      status: 'integrity_error' as const,
      issue:
        rows.status === 'missing' ? ('content_missing' as const) : ('content_corrupt' as const),
    }
  }
  const pending = await loadPendingAssetState(ctx, resourceId, rows.content.state)
  return pending ?? rows
}

export async function loadMapContent(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const authorization = await authorizeResourceContent(ctx, resourceId, 'map')
  if (authorization.status !== 'authorized') return authorization
  const state = await loadMapContentState(ctx, resourceId)
  if (state.status !== 'ready') return state
  return {
    status: 'ready' as const,
    content: state.projected,
    version: state.content.version,
  }
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
    content.image?.assetUuid ?? null,
    ...content.layers.map((layer) => layer.image?.assetUuid ?? null),
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
          image: copyMapImage(content.image, assets),
          layers: content.layers.map((layer) => ({
            ...layer,
            image: copyMapImage(layer.image, assets),
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
        const version = await initialJsonContentVersion(
          projectMapContent(copiedContent, copiedPins),
        )
        return async () => {
          await ctx.db.insert('resourceMapContents', {
            campaignUuid: campaignId,
            resourceUuid: destinationResourceId,
            state: assets.initializing ? 'initializing' : 'ready',
            image: copiedContent.image,
            layers: copiedContent.layers,
            recentOperations: [],
            version,
          })
          await Promise.all(copiedPins.map((pin) => ctx.db.insert('resourceMapPins', pin)))
          await assets.commit()
        }
      },
    },
  }
}

type StoredMapImage = NonNullable<Doc<'resourceMapContents'>['image']>
type StoredMapContent = Pick<Doc<'resourceMapContents'>, 'image' | 'layers'>
type StoredMapPin = Pick<
  Doc<'resourceMapPins'>,
  'destination' | 'layerId' | 'mapPinUuid' | 'visible' | 'x' | 'y'
>

export function projectMapContent(content: StoredMapContent, pins: ReadonlyArray<StoredMapPin>) {
  const layerIds = new Set(content.layers.map((layer) => layer.id))
  if (layerIds.size !== content.layers.length) throw new TypeError('Duplicate map layer identity')
  return {
    image: projectMapImage(content.image),
    layers: content.layers.map((layer) => ({
      id: layer.id,
      image: projectMapImage(layer.image),
      name: layer.name,
    })),
    pins: pins.map((pin) => {
      const destination = parseAuthoredDestination(pin.destination)
      if (
        !destination ||
        !isMapPosition(pin) ||
        (pin.layerId !== null && !layerIds.has(pin.layerId))
      ) {
        throw new TypeError('Invalid map pin')
      }
      return {
        id: assertDomainId(DOMAIN_ID_KIND.mapPin, pin.mapPinUuid),
        destination,
        layerId: pin.layerId,
        visible: pin.visible,
        x: pin.x,
        y: pin.y,
      }
    }),
  }
}

function projectMapImage(image: StoredMapImage | null): MapImageAttachment {
  return image === null
    ? { status: 'unattached' }
    : {
        status: 'attached',
        byteSize: image.byteSize,
        digest: assertSha256Digest(image.digest),
        mediaType: image.mediaType,
      }
}

function copyMapImage(
  image: StoredMapImage | null,
  assets: NonNullable<Awaited<ReturnType<typeof prepareAssetCopies>>>,
): StoredMapImage | null {
  if (image === null) return null
  const assetUuid = assets.remap(image.assetUuid)
  if (assetUuid === null) throw new TypeError('Map image asset was not copied')
  return { ...image, assetUuid }
}

function remapMapDestination(
  destination: NonNullable<ReturnType<typeof parseAuthoredDestination>>,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
) {
  const result = remapAuthoredDestination(destination, targetMap, 'same_campaign_copy')
  if (result.status !== 'completed') throw new TypeError('Unmapped authored destination')
  return result.destination
}
