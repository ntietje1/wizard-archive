import type { Dispatch } from 'react'

import type { MapPinId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import {
  completeWizardEditorMapPinOperation,
  hasWizardEditorGameMapPin,
  isWizardEditorGameMapItem,
  planWizardEditorMapPinCreations,
  readWizardEditorGameMapPinnedItemIds,
  replaceWizardEditorMapImage,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorMapSession,
  WizardEditorResourceCatalog,
} from '@wizard-archive/editor/adapter'
import type { LocalWorkspaceAction } from './local-workspace-model'
import { assertLocalCanMutate, readLocalFileAsDataUrl } from './local-operation-utils'

type CreatedLocalMapPin = Extract<LocalWorkspaceAction, { type: 'createMapPins' }>['pins'][number]

export function createLocalGameMapSessionSource({
  canEdit,
  catalog,
  dispatch,
}: {
  canEdit: boolean
  catalog: WizardEditorResourceCatalog
  dispatch: Dispatch<LocalWorkspaceAction>
}): WizardEditorMapSession {
  const sessionPinnedItemIdsByMapId = new Map<string, Set<ResourceId>>()
  const sessionCreatedPinsById = new Map<MapPinId, { itemId: ResourceId; mapId: string }>()
  const latestMapImageRequestByMapId = new Map<string, number>()
  let nextMapImageRequestId = 0

  return {
    pins: {
      create: ({ mapId, pins }) => {
        try {
          const created = createLocalMapPins({
            canEdit,
            catalog,
            dispatch,
            mapId,
            layerId: pins[0]?.layerId ?? null,
            pins,
            sessionPinnedItemIdsByMapId,
          })
          for (const pin of created.pins) {
            sessionCreatedPinsById.set(pin.id, {
              itemId: pin.itemId as ResourceId,
              mapId: String(mapId),
            })
          }
          if (created.unavailable) return { status: 'unavailable', reason: 'map_not_found' }
          return {
            status: 'completed',
            receipt: {
              kind: 'mapPinsCreated',
              itemId: mapId,
              affectedCount: created.pinIds.length,
              pinIds: created.pinIds,
            },
          }
        } catch (error) {
          return { status: 'error', error }
        }
      },
      update: ({ mapId, mapPinId, x, y }) => {
        try {
          assertLocalCanMutate(canEdit)
          if (!canMutateLocalMapPin(catalog, sessionCreatedPinsById, mapId, mapPinId)) {
            return { status: 'unavailable', reason: 'map_pin_not_found' }
          }
          dispatch({ type: 'updateMapPin', mapPinId, x, y })
          return completeWizardEditorMapPinOperation({
            kind: 'mapPinUpdated',
            mapId,
          })
        } catch (error) {
          return { status: 'error', error }
        }
      },
      remove: ({ mapId, mapPinId }) => {
        try {
          assertLocalCanMutate(canEdit)
          if (!canMutateLocalMapPin(catalog, sessionCreatedPinsById, mapId, mapPinId)) {
            return { status: 'unavailable', reason: 'map_pin_not_found' }
          }
          const createdPin = sessionCreatedPinsById.get(mapPinId)
          if (createdPin) {
            const sessionPinnedItemIds = sessionPinnedItemIdsByMapId.get(createdPin.mapId)
            sessionPinnedItemIds?.delete(createdPin.itemId)
            if (sessionPinnedItemIds?.size === 0) {
              sessionPinnedItemIdsByMapId.delete(createdPin.mapId)
            }
            sessionCreatedPinsById.delete(mapPinId)
          }
          dispatch({ type: 'removeMapPin', mapPinId })
          return completeWizardEditorMapPinOperation({
            kind: 'mapPinRemoved',
            mapId,
          })
        } catch (error) {
          return { status: 'error', error }
        }
      },
      setVisibility: ({ mapId, mapPinId, isVisible }) => {
        try {
          assertLocalCanMutate(canEdit)
          if (!canMutateLocalMapPin(catalog, sessionCreatedPinsById, mapId, mapPinId)) {
            return { status: 'unavailable', reason: 'map_pin_not_found' }
          }
          dispatch({
            type: 'updateMapPinVisibility',
            mapPinId,
            isVisible,
          })
          return completeWizardEditorMapPinOperation({
            kind: 'mapPinVisibilityUpdated',
            mapId,
          })
        } catch (error) {
          return { status: 'error', error }
        }
      },
    },
    updateMapImage: async ({ layerId, mapId, file }) => {
      return replaceWizardEditorMapImage({
        file,
        layerId,
        mapId,
        stageImage: async (input) => {
          assertLocalCanMutate(canEdit)
          const map = catalog.getVisibleItemById(input.mapId)
          if (!isWizardEditorGameMapItem(map)) {
            return { status: 'unavailable', reason: 'map_not_found' }
          }
          const mapKey = String(input.mapId)
          const requestId = ++nextMapImageRequestId
          latestMapImageRequestByMapId.set(mapKey, requestId)
          const image = await readLocalFileAsDataUrl(input.file)
          if (latestMapImageRequestByMapId.get(mapKey) !== requestId) {
            return { status: 'unavailable', reason: 'stale_map_image' }
          }
          return {
            status: 'staged',
            image,
            cancel: () => ({
              status: 'completed' as const,
              receipt: {
                kind: 'mapImageUpdated' as const,
                itemId: input.mapId,
                affectedCount: 1,
              },
            }),
          }
        },
        commitImage: (staged) => {
          dispatch({
            type: 'updateMapImage',
            layerId: staged.layerId,
            mapId: String(staged.mapId),
            imageUrl: staged.image,
          })
          return {
            status: 'completed' as const,
            receipt: {
              kind: 'mapImageUpdated' as const,
              itemId: staged.mapId,
              affectedCount: 1,
            },
          }
        },
      })
    },
  }
}

function canMutateLocalMapPin(
  catalog: WizardEditorResourceCatalog,
  sessionCreatedPinsById: ReadonlyMap<MapPinId, { mapId: string }>,
  mapId: ResourceId,
  mapPinId: MapPinId,
) {
  const mapKey = String(mapId)
  const sessionPin = sessionCreatedPinsById.get(mapPinId)
  return sessionPin?.mapId === mapKey || catalogHasVisibleMapPin(catalog, mapKey, mapPinId)
}

function catalogHasVisibleMapPin(
  catalog: WizardEditorResourceCatalog,
  mapId: string,
  mapPinId: MapPinId,
) {
  const map = catalog.getVisibleItemById(mapId as ResourceId)
  return hasWizardEditorGameMapPin(map, mapPinId)
}

function createLocalMapPins({
  canEdit,
  catalog,
  dispatch,
  mapId,
  layerId,
  pins,
  sessionPinnedItemIdsByMapId,
}: {
  canEdit: boolean
  catalog: WizardEditorResourceCatalog
  dispatch: Dispatch<LocalWorkspaceAction>
  mapId: ResourceId
  layerId: string | null
  pins: Parameters<WizardEditorMapSession['pins']['create']>[0]['pins']
  sessionPinnedItemIdsByMapId: Map<string, Set<ResourceId>>
}): {
  pinIds: Array<MapPinId>
  pins: Array<CreatedLocalMapPin>
  unavailable: boolean
} {
  assertLocalCanMutate(canEdit)
  const map = catalog.getVisibleItemById(mapId)
  const existingPinnedItemIds = readWizardEditorGameMapPinnedItemIds(map)
  if (!existingPinnedItemIds) {
    return { pinIds: [], pins: [], unavailable: true }
  }
  const mapKey = String(mapId)
  const sessionPinnedItemIds = sessionPinnedItemIdsByMapId.get(mapKey) ?? new Set<ResourceId>()
  sessionPinnedItemIdsByMapId.set(mapKey, sessionPinnedItemIds)
  const pinnedItemIds = [...existingPinnedItemIds, ...sessionPinnedItemIds]
  const createdPins = planWizardEditorMapPinCreations({
    mapId,
    existingPinnedItemIds: pinnedItemIds,
    pins,
    canPinItem: (itemId) => Boolean(catalog.getVisibleItemById(itemId)),
    createPin: (pin) => {
      const created = createLocalMapPin({
        itemId: String(pin.itemId),
        layerId,
        x: pin.x,
        y: pin.y,
      })
      return created
    },
  })
  if (createdPins.length === 0) {
    return { pinIds: [], pins: [], unavailable: false }
  }

  dispatch({
    type: 'createMapPins',
    mapId: mapKey,
    pins: createdPins,
  })
  for (const pin of createdPins) {
    sessionPinnedItemIds.add(pin.itemId as ResourceId)
  }
  return {
    pinIds: createdPins.map((created) => created.id),
    pins: createdPins,
    unavailable: false,
  }
}

function createLocalMapPin({
  itemId,
  layerId,
  x,
  y,
}: {
  itemId: string
  layerId: string | null
  x: number
  y: number
}): CreatedLocalMapPin {
  return {
    id: generateDomainId(DOMAIN_ID_KIND.mapPin),
    itemId,
    layerId,
    x,
    y,
    visible: true,
    creationTime: Date.now(),
  }
}
