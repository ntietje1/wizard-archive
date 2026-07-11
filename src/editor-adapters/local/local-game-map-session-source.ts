import type { Dispatch } from 'react'
import type { MapPinId, SidebarItemId } from 'shared/common/ids'
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
import type { LocalWorkspaceAction, LocalWorkspaceState } from './local-workspace-model'
import { assertLocalCanMutate, readLocalFileAsDataUrl } from './local-operation-utils'

type CreatedLocalMapPin = Extract<LocalWorkspaceAction, { type: 'createMapPins' }>['pins'][number]

export function createLocalGameMapSessionSource({
  canEdit,
  catalog,
  dispatch,
  workspace,
}: {
  canEdit: boolean
  catalog: WizardEditorResourceCatalog
  dispatch: Dispatch<LocalWorkspaceAction>
  workspace: LocalWorkspaceState
}): WizardEditorMapSession {
  const sessionPinnedItemIdsByMapId = new Map<string, Set<SidebarItemId>>()
  const sessionCreatedPinsById = new Map<MapPinId, { itemId: SidebarItemId; mapId: string }>()
  const latestMapImageRequestByMapId = new Map<string, number>()
  let nextLocalMapPinIndex = workspace.nextLocalMapPinIndex
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
            nextLocalMapPinIndex,
            pins,
            sessionPinnedItemIdsByMapId,
          })
          nextLocalMapPinIndex = created.nextLocalMapPinIndex
          for (const pin of created.pins) {
            const pinId = pin.id as MapPinId
            sessionCreatedPinsById.set(pinId, {
              itemId: pin.itemId as SidebarItemId,
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
          dispatch({ type: 'updateMapPin', mapPinId: String(mapPinId), x, y })
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
          dispatch({ type: 'removeMapPin', mapPinId: String(mapPinId) })
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
            mapPinId: String(mapPinId),
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
    updateMapImage: async ({ mapId, file }) => {
      return replaceWizardEditorMapImage({
        file,
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
  mapId: SidebarItemId,
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
  const map = catalog.getVisibleItemById(mapId as SidebarItemId)
  return hasWizardEditorGameMapPin(map, mapPinId)
}

function createLocalMapPins({
  canEdit,
  catalog,
  dispatch,
  mapId,
  nextLocalMapPinIndex,
  pins,
  sessionPinnedItemIdsByMapId,
}: {
  canEdit: boolean
  catalog: WizardEditorResourceCatalog
  dispatch: Dispatch<LocalWorkspaceAction>
  mapId: SidebarItemId
  nextLocalMapPinIndex: number
  pins: Parameters<WizardEditorMapSession['pins']['create']>[0]['pins']
  sessionPinnedItemIdsByMapId: Map<string, Set<SidebarItemId>>
}): {
  nextLocalMapPinIndex: number
  pinIds: Array<MapPinId>
  pins: Array<CreatedLocalMapPin>
  unavailable: boolean
} {
  assertLocalCanMutate(canEdit)
  const map = catalog.getVisibleItemById(mapId)
  const existingPinnedItemIds = readWizardEditorGameMapPinnedItemIds(map)
  if (!existingPinnedItemIds) {
    return { nextLocalMapPinIndex, pinIds: [], pins: [], unavailable: true }
  }
  const mapKey = String(mapId)
  const sessionPinnedItemIds = sessionPinnedItemIdsByMapId.get(mapKey) ?? new Set<SidebarItemId>()
  sessionPinnedItemIdsByMapId.set(mapKey, sessionPinnedItemIds)
  const pinnedItemIds = [...existingPinnedItemIds, ...sessionPinnedItemIds]
  let nextIndex = nextLocalMapPinIndex

  const createdPins = planWizardEditorMapPinCreations({
    mapId,
    existingPinnedItemIds: pinnedItemIds,
    pins,
    canPinItem: (itemId) => Boolean(catalog.getVisibleItemById(itemId)),
    createPin: (pin) => {
      const created = createLocalMapPin({
        index: nextIndex,
        itemId: String(pin.itemId),
        x: pin.x,
        y: pin.y,
      })
      nextIndex += 1
      return created
    },
  })
  if (createdPins.length === 0) {
    return { nextLocalMapPinIndex, pinIds: [], pins: [], unavailable: false }
  }

  dispatch({
    type: 'createMapPins',
    mapId: mapKey,
    pins: createdPins,
    nextLocalMapPinIndex: nextIndex,
  })
  for (const pin of createdPins) {
    sessionPinnedItemIds.add(pin.itemId as SidebarItemId)
  }
  return {
    nextLocalMapPinIndex: nextIndex,
    pinIds: createdPins.map((created) => created.id as MapPinId),
    pins: createdPins,
    unavailable: false,
  }
}

function createLocalMapPin({
  index,
  itemId,
  x,
  y,
}: {
  index: number
  itemId: string
  x: number
  y: number
}): CreatedLocalMapPin {
  return {
    id: `local-map-pin-${index}`,
    itemId,
    layerId: null,
    x,
    y,
    visible: true,
    creationTime: Date.now(),
  }
}
