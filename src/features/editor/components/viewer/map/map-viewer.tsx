import { useEffect, useRef, useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { ClientOnly } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { Ban, Image } from 'lucide-react'
import { toast } from 'sonner'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import type { GameMapWithContent, MapPinWithItem } from 'convex/gameMaps/types'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { ContextMenuHostRef } from '~/features/context-menu/components/context-menu-host'
import { MAP_DROP_ZONE_TYPE } from '~/features/dnd/utils/drop-target-data'
import { rejectionReasonMessage } from '~/features/dnd/utils/drop-rejections'
import { handleError } from '~/shared/utils/logger'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useMapView } from '~/features/editor/hooks/useMapView'
import { MapViewProvider } from '~/features/editor/contexts/map-view-context'
import { ZoomControls } from '~/features/editor/components/viewer/zoom-controls'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { cn } from '~/features/shadcn/lib/utils'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import usePersistedState from '~/shared/hooks/usePersistedState'
import { useFileWithPreview } from '~/features/file-upload/hooks/useFileWithPreview'
import { FileUploadEmptyState } from '~/features/file-upload/components/file-upload-empty-state'
import { MapPinsLayer } from './map-pins-layer'
import { useMapImageStatus } from './use-map-image-status'
import { useMapRenderPins } from './use-map-render-pins'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { useMapSidebarItemDropTarget } from './use-map-sidebar-item-drop-target'
import { buildMapPinPlacementInputs, getImagePinPosition } from './map-pin-placement'
import type { PinPosition } from './map-pin-placement'
import type { DropOutcome } from '~/features/dnd/utils/drop-outcome'

interface MapPinContextMenuWrapperProps {
  pinId: Id<'mapPins'>
  pins: Array<MapPinWithItem>
  position: PinPosition
  onClose: () => void
}

function MapPinContextMenuWrapper({
  pinId,
  pins,
  position,
  onClose,
}: MapPinContextMenuWrapperProps) {
  const contextMenuRef = useRef<ContextMenuHostRef>(null)
  const { setActivePinId } = useMapView()
  const dialogOpenRef = useRef(false)

  const pin = pins.find((p) => p._id === pinId)

  useEffect(() => {
    if (pin) {
      setActivePinId(pinId)
      contextMenuRef.current?.open(position)
    }
    return () => {
      setActivePinId(null)
    }
  }, [pin, pinId, position, setActivePinId])

  const handleDialogOpen = () => {
    dialogOpenRef.current = true
  }

  const handleMenuClose = () => {
    setActivePinId(null)
    // Only clean up if no dialog was opened
    if (!dialogOpenRef.current) {
      onClose()
    }
  }

  const handleDialogClose = () => {
    dialogOpenRef.current = false
    onClose()
  }

  if (!pin) return null

  const canViewItem = pin.item
    ? hasAtLeastPermissionLevel(
        pin.item.myPermissionLevel ?? PERMISSION_LEVEL.NONE,
        PERMISSION_LEVEL.VIEW,
      )
    : false

  return (
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext="map-view"
      item={canViewItem ? (pin.item ?? undefined) : undefined}
      className="absolute inset-0 pointer-events-none"
      onClose={handleMenuClose}
      onDialogOpen={handleDialogOpen}
      onDialogClose={handleDialogClose}
    >
      <div className="w-full h-full" />
    </EditorContextMenu>
  )
}

interface MapImageContextMenuWrapperProps {
  contextMenuRef: React.RefObject<ContextMenuHostRef | null>
  map: GameMapWithContent
}

function MapImageContextMenuWrapper({ contextMenuRef, map }: MapImageContextMenuWrapperProps) {
  const { setActivePinId } = useMapView()

  return (
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext="map-view"
      item={map}
      className="absolute inset-0 pointer-events-none"
      onClose={() => {
        setActivePinId(null)
      }}
    />
  )
}

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

function MapDropFeedbackOverlay({ outcome }: { outcome: DropOutcome | null }) {
  if (!outcome) return null

  return (
    <>
      <div
        className={cn(
          'absolute inset-0 z-[998] ring-2 ring-offset-2 pointer-events-none',
          outcome.type === 'operation' ? 'ring-ring' : 'ring-destructive',
        )}
      />
      <div
        className={cn(
          'absolute top-4 left-1/2 -translate-x-1/2 z-[2000] px-4 py-2 rounded-md shadow-lg',
          outcome.type === 'operation'
            ? 'bg-primary text-primary-foreground'
            : 'bg-destructive text-destructive-foreground',
        )}
      >
        <p className="text-sm font-medium flex items-center gap-1.5">
          {outcome.type === 'rejection' && <Ban className="size-4 shrink-0" />}
          {outcome.type === 'operation'
            ? 'Release to place pin here'
            : rejectionReasonMessage(outcome.reason)}
        </p>
      </div>
    </>
  )
}

function MapModeBanners({
  pendingPinItems,
  pendingPinMove,
  draggingPin,
}: {
  pendingPinItems: { itemIds: Array<Id<'sidebarItems'>> } | null
  pendingPinMove: { pinId: Id<'mapPins'> } | null
  draggingPin: { pin: MapPinWithItem } | null
}) {
  if (pendingPinItems) {
    return (
      <MapModeBanner>
        {pendingPinItems.itemIds.length === 1
          ? 'Click on map to place pin. Press Escape to cancel.'
          : `Click on map to place ${pendingPinItems.itemIds.length} pins. Press Escape to cancel.`}
      </MapModeBanner>
    )
  }
  if (pendingPinMove) {
    return <MapModeBanner>Click on map or drag to move pin. Press Escape to cancel.</MapModeBanner>
  }
  if (draggingPin) {
    return <MapModeBanner>Release to move pin. Press Escape to cancel.</MapModeBanner>
  }
  return null
}

function MapModeBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
      <p className="text-sm font-medium">{children}</p>
    </div>
  )
}

function setPinElementPosition(pinEl: HTMLElement, position: PinPosition) {
  Object.assign(pinEl.style, {
    left: `${position.x}%`,
    top: `${position.y}%`,
  })
}

function MapCanvasStage({
  map,
  mapContainerRef,
  transformWrapperRef,
  imageRef,
  pinsContainerRef,
  imageLoaded,
  imageError,
  savedTransform,
  mapCursor,
  shouldDisablePanning,
  mapDragOutcome,
  pins,
  isPinGhost,
  hoveredPinId,
  draggingPinId,
  moveModePinId,
  hasPinAction,
  onTransformChange,
  onImageLoad,
  onImageError,
  onMapClick,
  onMapKeyboardAction,
  onMapCanvasContextMenu,
  onPinHover,
  onPinClick,
  onPinContextMenu,
  onPinDragStart,
}: {
  map: GameMapWithContent
  mapContainerRef: React.RefObject<HTMLDivElement | null>
  transformWrapperRef: React.RefObject<ReactZoomPanPinchRef | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  pinsContainerRef: React.RefObject<HTMLDivElement | null>
  imageLoaded: boolean
  imageError: boolean
  savedTransform: MapTransformState
  mapCursor: string
  shouldDisablePanning: boolean
  mapDragOutcome: DropOutcome | null
  pins: Array<MapPinWithItem>
  isPinGhost: (pin: MapPinWithItem) => boolean
  hoveredPinId: Id<'mapPins'> | null
  draggingPinId: Id<'mapPins'> | null
  moveModePinId: Id<'mapPins'> | null
  hasPinAction: boolean
  onTransformChange: (
    ref: unknown,
    state: { scale: number; positionX: number; positionY: number },
  ) => void
  onImageLoad: () => void
  onImageError: () => void
  onMapClick: (event: React.MouseEvent) => void
  onMapKeyboardAction: () => void
  onMapCanvasContextMenu: (event: React.MouseEvent) => void
  onPinHover: (pinId: Id<'mapPins'> | null) => void
  onPinClick: (event: React.MouseEvent | React.KeyboardEvent, pin: MapPinWithItem) => void
  onPinContextMenu: (event: React.MouseEvent, pin: MapPinWithItem) => void
  onPinDragStart: (event: React.MouseEvent, pin: MapPinWithItem) => void
}) {
  return (
    <div ref={mapContainerRef} className="flex-1 relative min-h-0">
      <MapDropFeedbackOverlay outcome={mapDragOutcome} />
      {map.imageUrl && !imageLoaded && !imageError && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}
      {map.imageUrl ? (
        <TransformWrapper
          ref={transformWrapperRef}
          initialScale={savedTransform.scale}
          initialPositionX={savedTransform.positionX}
          initialPositionY={savedTransform.positionY}
          minScale={0.5}
          maxScale={4}
          wheel={{ step: 0.1 }}
          doubleClick={{ disabled: false }}
          panning={{ disabled: shouldDisablePanning }}
          limitToBounds={false}
          centerOnInit={false}
          onTransformed={onTransformChange}
        >
          <TransformComponent
            wrapperClass="!w-full !h-full"
            contentClass="!w-full !h-full flex items-center justify-center"
          >
            <div
              role="application"
              aria-label="Map canvas"
              tabIndex={hasPinAction ? 0 : undefined}
              className="relative"
              onClick={hasPinAction ? onMapClick : undefined}
              onKeyDown={(event) => {
                if (!hasPinAction) return
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onMapKeyboardAction()
              }}
              onContextMenu={onMapCanvasContextMenu}
            >
              <img
                ref={imageRef}
                src={map.imageUrl ?? undefined}
                alt={map.name || 'Map'}
                className="select-none pointer-events-auto"
                draggable={false}
                onLoad={onImageLoad}
                onError={onImageError}
                style={{
                  cursor: mapCursor,
                  display: 'block',
                }}
              />

              {imageLoaded && (
                <MapPinsLayer
                  ref={pinsContainerRef}
                  pins={pins}
                  isPinGhost={isPinGhost}
                  hoveredPinId={hoveredPinId}
                  draggingPinId={draggingPinId}
                  moveModePinId={moveModePinId}
                  interactive
                  onHover={onPinHover}
                  onClick={onPinClick}
                  onContextMenu={onPinContextMenu}
                  onDragStart={onPinDragStart}
                />
              )}
            </div>
          </TransformComponent>
        </TransformWrapper>
      ) : (
        <MapImageUpload mapId={map._id} />
      )}
    </div>
  )
}

export function MapViewer({ item: map }: EditorViewerProps<GameMapWithContent>) {
  const imageRef = useRef<HTMLImageElement>(null)
  const pinsContainerRef = useRef<HTMLDivElement>(null)
  const transformWrapperRef = useRef<ReactZoomPanPinchRef>(null)
  const { itemsMap } = useActiveSidebarItems()
  const { itemsMap: trashedItemsMap } = useTrashSidebarItems()
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
  })
  const mapDragOutcome = useDndStore((s) => (isMapDropTarget ? s.dragOutcome : null))
  const { pins, isPinGhost } = useMapRenderPins(map)

  const [savedTransform, setSavedTransform] = usePersistedState<MapTransformState>(
    `map-transform-${map._id}`,
    DEFAULT_TRANSFORM,
  )
  const transformDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (transformDebounceRef.current) {
        clearTimeout(transformDebounceRef.current)
      }
    }
  }, [])

  const [pinContextMenu, setPinContextMenu] = useState<{
    pinId: Id<'mapPins'>
    position: PinPosition
  } | null>(null)
  const [pendingPinItems, setPendingPinItems] = useState<{
    itemIds: Array<Id<'sidebarItems'>>
  } | null>(null)
  const [pendingPinMove, setPendingPinMove] = useState<{
    pinId: Id<'mapPins'>
  } | null>(null)

  const [draggingPin, setDraggingPin] = useState<{
    pin: MapPinWithItem
  } | null>(null)
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
          setPendingPinItems(null)
          toast.info('Pin placement cancelled')
        }
        if (pendingPinMove) {
          setPendingPinMove(null)
          toast.info('Pin move cancelled')
        }
        if (draggingPin) {
          const pinEl = pinsContainerRef.current?.querySelector(
            `[data-pin-id="${draggingPin.pin._id}"]`,
          ) as HTMLElement | null
          if (pinEl) {
            setPinElementPosition(pinEl, draggingPin.pin)
          }
          setDraggingPin(null)
          draggedPinPositionRef.current = null
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pendingPinItems, pendingPinMove, draggingPin])

  useEffect(() => {
    const handlePinPlacementRequest = (
      event: CustomEvent<{ itemIds: Array<Id<'sidebarItems'>> }>,
    ) => {
      if (imageError) {
        toast.error('Cannot place pin: map image failed to load')
        return
      }
      if (event.detail.itemIds.length === 0) return
      setPendingPinItems(event.detail)
    }

    window.addEventListener('map-pin-placement-request', handlePinPlacementRequest as EventListener)
    return () => {
      window.removeEventListener(
        'map-pin-placement-request',
        handlePinPlacementRequest as EventListener,
      )
    }
  }, [imageError])

  useEffect(() => {
    const handlePinMoveRequest = (event: CustomEvent<{ pinId: Id<'mapPins'> }>) => {
      setPendingPinMove(event.detail)
    }

    window.addEventListener('map-pin-move-request', handlePinMoveRequest as EventListener)
    return () => {
      window.removeEventListener('map-pin-move-request', handlePinMoveRequest as EventListener)
    }
  }, [])

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
      setDraggingPin(null)
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
  useMapSidebarItemDropTarget({ map, imageRef, itemsMap, trashedItemsMap })

  const handlePlacePin = async (position: PinPosition) => {
    if (!pendingPinItems || !map._id) return

    await createPinsAtPosition(pendingPinItems.itemIds, position)
    setPendingPinItems(null)
  }

  const handleMovePin = async (position: PinPosition) => {
    if (!pendingPinMove) return

    try {
      await updateItemPinMutation.mutateAsync({
        mapPinId: pendingPinMove.pinId,
        x: position.x,
        y: position.y,
      })
      toast.success('Pin moved')
      setPendingPinMove(null)
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
    const canView = pin.item
      ? hasAtLeastPermissionLevel(
          pin.item.myPermissionLevel ?? PERMISSION_LEVEL.NONE,
          PERMISSION_LEVEL.VIEW,
        )
      : false
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

    setPinContextMenu({
      pinId: pin._id,
      position: {
        x: e.clientX,
        y: e.clientY,
      },
    })
  }

  const handlePinDragStart = (_event: React.MouseEvent, pin: MapPinWithItem) => {
    if (pendingPinMove?.pinId === pin._id) {
      setPendingPinMove(null)
    }
    setDraggingPin({ pin })
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
              onClose={() => setPinContextMenu(null)}
            />
          )}

          <MapImageContextMenuWrapper contextMenuRef={mapImageContextMenuRef} map={map} />
        </div>
      </MapViewProvider>
    </ClientOnly>
  )
}

function MapImageUpload({ mapId }: { mapId: Id<'sidebarItems'> }) {
  const updateMapImage = useCampaignMutation(api.gameMaps.mutations.updateMapImage)

  const fileUpload = useFileWithPreview({
    isOpen: true,
    uploadOnSelect: true,
    fileTypeValidator: (file: globalThis.File) => {
      if (!file.type.startsWith('image/')) {
        return {
          valid: false,
          error: 'Only image files are allowed for maps',
        }
      }
      return { valid: true }
    },
    onUploadComplete: async (storageId) => {
      try {
        await updateMapImage.mutateAsync({
          mapId,
          imageStorageId: storageId,
        })
        toast.success('Map image uploaded')
      } catch (error) {
        handleError(error, 'Failed to update map')
      }
    },
  })

  return (
    <FileUploadEmptyState
      fileUpload={fileUpload}
      icon={Image}
      title="Upload Map Image"
      description="Upload an image to create your map. You can pin items to it later."
      isSubmitting={false}
      acceptPattern="image/*"
      dragDropText="Drag an image here or click to browse"
    />
  )
}

function MapViewerSkeleton() {
  return (
    <div className="relative w-full h-full min-h-0 bg-background overflow-hidden flex flex-col">
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <div className="bg-muted rounded-md size-8" />
        <div className="bg-muted rounded-md size-8" />
        <div className="bg-muted rounded-md size-8" />
      </div>
    </div>
  )
}
