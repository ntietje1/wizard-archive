import { useEffect, useReducer, useRef, useState } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import type { GameMapWithContent, MapPinWithItem } from 'shared/game-maps/types'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { ContextMenuHostRef } from '~/features/context-menu/components/context-menu-host'
import { MAP_DROP_ZONE_TYPE } from '~/features/dnd/utils/drop-target-data'
import { handleError } from '~/shared/utils/logger'
import { assertNever } from '~/shared/utils/utils'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { MapViewProvider } from '~/features/editor/contexts/map-view-context'
import { ZoomControls } from '~/features/editor/components/viewer/zoom-controls'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import usePersistedState from '~/shared/hooks/usePersistedState'
import { useMapImageStatus } from './use-map-image-status'
import { useMapRenderPins } from './use-map-render-pins'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { useMapSidebarItemDropTarget } from './use-map-sidebar-item-drop-target'
import { buildMapPinPlacementInputs, getImagePinPosition } from './map-pin-placement'
import type { PinPosition } from './map-pin-placement'
import { MapCanvasStage } from './map-canvas-stage'
import { MapImageContextMenuWrapper } from './map-image-context-menu-wrapper'
import { MapModeBanners } from './map-mode-banners'
import { MapPinContextMenuWrapper } from './map-pin-context-menu-wrapper'
import { MapViewerSkeleton } from './map-viewer-skeleton'
import { MapImageUpload } from './map-image-upload'
import { useCampaignActorPermissions } from '~/features/campaigns/hooks/useCampaignActorPermissions'

interface MapTransformState {
  scale: number
  positionX: number
  positionY: number
}

const DEFAULT_TRANSFORM: MapTransformState = {
  scale: 1,
  positionX: 0,
  positionY: 0,
}

type PendingPinItems = { itemIds: Array<Id<'sidebarItems'>> }
type PendingPinMove = { pinId: Id<'mapPins'> }
type DraggingPin = { pin: MapPinWithItem }
type PinContextMenuState = {
  pinId: Id<'mapPins'>
  position: PinPosition
}

type MapPinInteractionState = {
  pinContextMenu: PinContextMenuState | null
  pendingPinItems: PendingPinItems | null
  pendingPinMove: PendingPinMove | null
  draggingPin: DraggingPin | null
}

type MapPinInteractionAction =
  | { type: 'openPinContextMenu'; value: PinContextMenuState }
  | { type: 'closePinContextMenu' }
  | { type: 'setPendingPinItems'; value: PendingPinItems | null }
  | { type: 'setPendingPinMove'; value: PendingPinMove | null }
  | { type: 'startDraggingPin'; value: DraggingPin }
  | { type: 'stopDraggingPin' }
  | { type: 'cancelActivePinAction' }

const EMPTY_PIN_INTERACTION_STATE: MapPinInteractionState = {
  pinContextMenu: null,
  pendingPinItems: null,
  pendingPinMove: null,
  draggingPin: null,
}

function mapPinInteractionReducer(
  state: MapPinInteractionState,
  action: MapPinInteractionAction,
): MapPinInteractionState {
  switch (action.type) {
    case 'openPinContextMenu':
      return { ...state, pinContextMenu: action.value }
    case 'closePinContextMenu':
      return { ...state, pinContextMenu: null }
    case 'setPendingPinItems':
      return { ...state, pendingPinItems: action.value }
    case 'setPendingPinMove':
      return { ...state, pendingPinMove: action.value }
    case 'startDraggingPin':
      return { ...state, draggingPin: action.value }
    case 'stopDraggingPin':
      return { ...state, draggingPin: null }
    case 'cancelActivePinAction':
      return { ...state, pendingPinItems: null, pendingPinMove: null, draggingPin: null }
    default:
      return assertNever(action)
  }
}

function setPinElementPosition(pinEl: HTMLElement, position: PinPosition) {
  Object.assign(pinEl.style, {
    left: `${position.x}%`,
    top: `${position.y}%`,
  })
}

export function MapViewer({ item: map }: EditorViewerProps<GameMapWithContent>) {
  return useMapViewerElement(map)
}

function useMapViewerElement(map: GameMapWithContent) {
  const imageRef = useRef<HTMLImageElement>(null)
  const pinsContainerRef = useRef<HTMLDivElement>(null)
  const transformWrapperRef = useRef<ReactZoomPanPinchRef>(null)
  const { itemsMap } = useActiveSidebarItems()
  const { itemsMap: trashedItemsMap } = useTrashSidebarItems()
  const actorPermissions = useCampaignActorPermissions()
  const canEditMap = actorPermissions.canMutate(map, PERMISSION_LEVEL.EDIT)
  const [hoveredPinId, setHoveredPinId] = useState<Id<'mapPins'> | null>(null)
  const { imageLoaded, imageError, handleImageLoad, handleImageError } = useMapImageStatus(
    map._id,
    map.imageUrl,
  )

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapDropData = {
    type: MAP_DROP_ZONE_TYPE,
    mapId: map._id,
    mapName: map.name,
    pinnedItemIds: map.pins.map((p) => p.itemId),
  }
  const { isDropTarget: isMapDropTarget } = useDndDropTarget({
    ref: mapContainerRef,
    data: mapDropData,
    highlightId: `map:${map._id}`,
    canDrop: canEditMap,
  })
  const mapDragOutcome = useDndStore((s) => (canEditMap && isMapDropTarget ? s.dragOutcome : null))
  const { pins, isPinGhost } = useMapRenderPins(map)

  const [savedTransform, setSavedTransform] = usePersistedState<MapTransformState>(
    `map-transform-${map._id}`,
    DEFAULT_TRANSFORM,
  )
  const transformDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timeoutRef = transformDebounceRef
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [transformDebounceRef])

  const [pinInteractionState, dispatchPinInteraction] = useReducer(
    mapPinInteractionReducer,
    EMPTY_PIN_INTERACTION_STATE,
  )
  const { pinContextMenu, pendingPinItems, pendingPinMove, draggingPin } = pinInteractionState
  const draggedPinPositionRef = useRef<PinPosition | null>(null)
  const justFinishedDraggingRef = useRef<Id<'mapPins'> | null>(null)

  const createItemPinsMutation = useCampaignMutation(api.gameMaps.mutations.createItemPins)
  const updateItemPinMutation = useCampaignMutation(api.gameMaps.mutations.updateItemPin)

  const handleTransformChange = (
    _: unknown,
    state: { scale: number; positionX: number; positionY: number },
  ) => {
    if (pinsContainerRef.current) {
      pinsContainerRef.current.style.setProperty('--pin-scale', String(1 / state.scale))
    }

    if (transformDebounceRef.current) {
      clearTimeout(transformDebounceRef.current)
    }
    transformDebounceRef.current = setTimeout(() => {
      setSavedTransform({
        scale: state.scale,
        positionX: state.positionX,
        positionY: state.positionY,
      })
    }, 300)
  }

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingPinItems) {
          toast.info('Pin placement cancelled')
        }
        if (pendingPinMove) {
          toast.info('Pin move cancelled')
        }
        if (draggingPin) {
          const pinEl = pinsContainerRef.current?.querySelector(
            `[data-pin-id="${draggingPin.pin._id}"]`,
          ) as HTMLElement | null
          if (pinEl) {
            setPinElementPosition(pinEl, draggingPin.pin)
          }
          draggedPinPositionRef.current = null
        }
        dispatchPinInteraction({ type: 'cancelActivePinAction' })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pendingPinItems, pendingPinMove, draggingPin])

  useEffect(() => {
    if (canEditMap) return
    if (pendingPinItems || pendingPinMove || draggingPin) {
      if (draggingPin) {
        const pinEl = pinsContainerRef.current?.querySelector(
          `[data-pin-id="${draggingPin.pin._id}"]`,
        ) as HTMLElement | null
        if (pinEl) {
          setPinElementPosition(pinEl, draggingPin.pin)
        }
        draggedPinPositionRef.current = null
      }
      dispatchPinInteraction({ type: 'cancelActivePinAction' })
    }
  }, [canEditMap, pendingPinItems, pendingPinMove, draggingPin])

  useEffect(() => {
    const handlePinPlacementRequest = (
      event: CustomEvent<{ itemIds: Array<Id<'sidebarItems'>> }>,
    ) => {
      if (!canEditMap) return
      if (imageError) {
        toast.error('Cannot place pin: map image failed to load')
        return
      }
      if (event.detail.itemIds.length === 0) return
      dispatchPinInteraction({ type: 'setPendingPinItems', value: event.detail })
    }

    window.addEventListener('map-pin-placement-request', handlePinPlacementRequest as EventListener)
    return () => {
      window.removeEventListener(
        'map-pin-placement-request',
        handlePinPlacementRequest as EventListener,
      )
    }
  }, [canEditMap, imageError])

  useEffect(() => {
    const handlePinMoveRequest = (event: CustomEvent<{ pinId: Id<'mapPins'> }>) => {
      if (!canEditMap) return
      dispatchPinInteraction({ type: 'setPendingPinMove', value: event.detail })
    }

    window.addEventListener('map-pin-move-request', handlePinMoveRequest as EventListener)
    return () => {
      window.removeEventListener('map-pin-move-request', handlePinMoveRequest as EventListener)
    }
  }, [canEditMap])

  useEffect(() => {
    if (!draggingPin) return

    const pinEl = pinsContainerRef.current?.querySelector(
      `[data-pin-id="${draggingPin.pin._id}"]`,
    ) as HTMLElement | null

    const handleMouseMove = (e: MouseEvent) => {
      if (!imageRef.current) return

      const rect = imageRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      const newPos = {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      }
      draggedPinPositionRef.current = newPos
      if (pinEl) {
        setPinElementPosition(pinEl, newPos)
      }
    }

    const handleMouseUp = async () => {
      const pinId = draggingPin.pin._id
      justFinishedDraggingRef.current = pinId
      setTimeout(() => {
        if (justFinishedDraggingRef.current === pinId) {
          justFinishedDraggingRef.current = null
        }
      }, 100)

      if (draggedPinPositionRef.current) {
        try {
          await updateItemPinMutation.mutateAsync({
            mapPinId: pinId,
            x: draggedPinPositionRef.current.x,
            y: draggedPinPositionRef.current.y,
          })
          toast.success('Pin moved')
        } catch (error) {
          handleError(error, 'Failed to move pin')
        }
      }
      dispatchPinInteraction({ type: 'stopDraggingPin' })
      draggedPinPositionRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingPin, updateItemPinMutation])

  const getPercentageFromClick = (e: React.MouseEvent): PinPosition | null =>
    getImagePinPosition(imageRef.current, e)

  const createPinsAtPosition = async (
    itemIds: Array<Id<'sidebarItems'>>,
    position: PinPosition,
  ) => {
    try {
      const pinIds = await createItemPinsMutation.mutateAsync({
        mapId: map._id,
        pins: buildMapPinPlacementInputs(itemIds, position),
      })
      if (!Array.isArray(pinIds)) {
        throw new Error('Map pin creation returned an invalid result')
      }
      if (pinIds.length === 0) {
        toast.error(itemIds.length === 1 ? 'Pin was not placed' : 'No pins were placed')
        return false
      }
      if (pinIds.length < itemIds.length) {
        toast.success(
          `${pinIds.length} pins placed on map, ${itemIds.length - pinIds.length} skipped`,
        )
        return true
      }
      toast.success(
        pinIds.length === 1 ? 'Pin placed on map' : `${pinIds.length} pins placed on map`,
      )
      return true
    } catch (error) {
      handleError(error, itemIds.length === 1 ? 'Failed to place pin' : 'Failed to place pins')
      return false
    }
  }
  useMapSidebarItemDropTarget({ map, imageRef, itemsMap, trashedItemsMap, canPin: canEditMap })

  const handlePlacePin = async (position: PinPosition) => {
    if (!pendingPinItems || !map._id) return
    if (!canEditMap) return

    await createPinsAtPosition(pendingPinItems.itemIds, position)
    dispatchPinInteraction({ type: 'setPendingPinItems', value: null })
  }

  const handleMovePin = async (position: PinPosition) => {
    if (!pendingPinMove) return
    if (!canEditMap) return

    try {
      await updateItemPinMutation.mutateAsync({
        mapPinId: pendingPinMove.pinId,
        x: position.x,
        y: position.y,
      })
      toast.success('Pin moved')
      dispatchPinInteraction({ type: 'setPendingPinMove', value: null })
    } catch (error) {
      handleError(error, 'Failed to move pin')
    }
  }

  const handleMapClick = (e: React.MouseEvent) => {
    if (!pendingPinItems && !pendingPinMove) return

    e.preventDefault()
    e.stopPropagation()
    const position = getPercentageFromClick(e)
    if (!position) {
      toast.error('No image loaded - cannot place pin')
      return
    }

    if (pendingPinItems) {
      void handlePlacePin(position)
    } else if (pendingPinMove) {
      void handleMovePin(position)
    }
  }

  const handleMapKeyboardAction = () => {
    if (pendingPinItems) {
      void handlePlacePin({ x: 50, y: 50 })
    } else if (pendingPinMove) {
      void handleMovePin({ x: 50, y: 50 })
    }
  }

  const handlePinClick = (e: React.MouseEvent | React.KeyboardEvent, pin: MapPinWithItem) => {
    e.preventDefault()
    e.stopPropagation()
    if (justFinishedDraggingRef.current === pin._id) {
      return
    }
    const canView = pin.item ? actorPermissions.canView(pin.item) : false
    if (!pin.item || !canView) {
      toast.error('You do not have permission to view this item')
      return
    }
    toast.info(`Pin clicked: ${pin.item.name}`)
    // TODO: add action here
  }

  const handlePinContextMenu = (e: React.MouseEvent, pin: MapPinWithItem) => {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()

    dispatchPinInteraction({
      type: 'openPinContextMenu',
      value: {
        pinId: pin._id,
        position: {
          x: e.clientX,
          y: e.clientY,
        },
      },
    })
  }

  const handlePinDragStart = (_event: React.MouseEvent, pin: MapPinWithItem) => {
    if (!canEditMap) return
    if (pendingPinMove?.pinId === pin._id) {
      dispatchPinInteraction({ type: 'setPendingPinMove', value: null })
    }
    dispatchPinInteraction({ type: 'startDraggingPin', value: { pin } })
    draggedPinPositionRef.current = { x: pin.x, y: pin.y }
  }

  const handleZoomIn = () => {
    transformWrapperRef.current?.zoomIn()
  }

  const handleZoomOut = () => {
    transformWrapperRef.current?.zoomOut()
  }

  const handleResetTransform = () => {
    transformWrapperRef.current?.resetTransform()
    setSavedTransform(DEFAULT_TRANSFORM)
  }

  const mapImageContextMenuRef = useRef<ContextMenuHostRef>(null)

  const handleMapImageContextMenu = (e: React.MouseEvent) => {
    if (pendingPinItems) return
    if (!canEditMap) return

    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()

    mapImageContextMenuRef.current?.open({
      x: e.clientX,
      y: e.clientY,
    })
  }

  const handleMapCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (pendingPinItems || pendingPinMove) {
      if (!canEditMap) return
      const position = getPercentageFromClick(e)
      if (!position) {
        toast.error(
          pendingPinItems
            ? 'No image loaded - cannot place pin'
            : 'No image loaded - cannot move pin',
        )
        return
      }
      if (pendingPinItems) {
        void handlePlacePin(position)
      } else {
        void handleMovePin(position)
      }
      return
    }

    handleMapImageContextMenu(e)
  }

  const mapCursor =
    pendingPinItems || pendingPinMove ? 'crosshair' : draggingPin ? 'grabbing' : 'default'
  const shouldDisablePanning = !!pendingPinItems || !!pendingPinMove || !!draggingPin

  return (
    <ClientOnly fallback={<MapViewerSkeleton />}>
      <MapViewProvider map={map} pins={pins}>
        <div
          role="presentation"
          className="relative w-full h-full min-h-0 bg-background overflow-hidden flex flex-col"
          onMouseDown={() => {
            // Blur any focused element (e.g. breadcrumb input) since
            // TransformWrapper intercepts events and prevents default blur
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
          }}
        >
          {/* Zoom controls */}
          <ZoomControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleResetTransform}
          />

          <MapCanvasStage
            map={map}
            mapContainerRef={mapContainerRef}
            transformWrapperRef={transformWrapperRef}
            imageRef={imageRef}
            pinsContainerRef={pinsContainerRef}
            imageLoaded={imageLoaded}
            imageError={imageError}
            savedTransform={savedTransform}
            mapCursor={mapCursor}
            shouldDisablePanning={shouldDisablePanning}
            mapDragOutcome={mapDragOutcome}
            pins={pins}
            isPinGhost={isPinGhost}
            hoveredPinId={hoveredPinId}
            draggingPinId={draggingPin?.pin._id ?? null}
            moveModePinId={pendingPinMove?.pinId ?? null}
            hasPinAction={Boolean(pendingPinItems || pendingPinMove)}
            onTransformChange={handleTransformChange}
            onImageLoad={handleImageLoad}
            onImageError={handleImageError}
            onMapClick={handleMapClick}
            onMapKeyboardAction={handleMapKeyboardAction}
            onMapCanvasContextMenu={handleMapCanvasContextMenu}
            onPinHover={setHoveredPinId}
            onPinClick={handlePinClick}
            onPinContextMenu={handlePinContextMenu}
            onPinDragStart={handlePinDragStart}
            emptyImageContent={
              canEditMap ? (
                <MapImageUpload mapId={map._id} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No map image has been uploaded.
                </div>
              )
            }
          />

          <MapModeBanners
            pendingPinItems={pendingPinItems}
            pendingPinMove={pendingPinMove}
            draggingPin={draggingPin}
          />

          {pinContextMenu && (
            <MapPinContextMenuWrapper
              pinId={pinContextMenu.pinId}
              pins={pins}
              position={pinContextMenu.position}
              onClose={() => dispatchPinInteraction({ type: 'closePinContextMenu' })}
            />
          )}

          <MapImageContextMenuWrapper contextMenuRef={mapImageContextMenuRef} map={map} />
        </div>
      </MapViewProvider>
    </ClientOnly>
  )
}
