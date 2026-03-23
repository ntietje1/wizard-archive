import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { ClientOnly } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { Ban, Image } from 'lucide-react'
import { toast } from 'sonner'
import { DEFAULT_ITEM_COLOR } from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import { validatePinTarget } from 'convex/gameMaps/validation'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import type { GameMapWithContent, MapPinWithItem } from 'convex/gameMaps/types'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { EditorContextMenuRef } from '~/features/context-menu/components/editor-context-menu'
import {
  MAP_DROP_ZONE_TYPE,
  getDragItemId,
  rejectionReasonMessage,
} from '~/features/dnd/utils/dnd-registry'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAllSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useMapView } from '~/features/editor/hooks/useMapView'
import { MapViewProvider } from '~/features/editor/contexts/map-view-context'
import { ZoomControls } from '~/features/editor/components/viewer/zoom-controls'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { cn } from '~/features/shadcn/lib/utils'
import { validateHexColorOrDefault } from '~/features/sidebar/utils/sidebar-item-utils'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import usePersistedState from '~/shared/hooks/usePersistedState'
import { useFileWithPreview } from '~/features/file-upload/hooks/useFileWithPreview'
import { FileUploadSection } from '~/features/file-upload/components/file-upload-section'

interface PinPosition {
  x: number
  y: number
}

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
  const contextMenuRef = useRef<EditorContextMenuRef>(null)
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

  const handleDialogOpen = useCallback(() => {
    dialogOpenRef.current = true
  }, [])

  const handleMenuClose = useCallback(() => {
    setActivePinId(null)
    // Only clean up if no dialog was opened
    if (!dialogOpenRef.current) {
      onClose()
    }
  }, [setActivePinId, onClose])

  const handleDialogClose = useCallback(() => {
    dialogOpenRef.current = false
    onClose()
  }, [onClose])

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
      item={canViewItem ? pin.item : undefined}
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
  contextMenuRef: React.RefObject<EditorContextMenuRef | null>
  map: GameMapWithContent
}

function MapImageContextMenuWrapper({
  contextMenuRef,
  map,
}: MapImageContextMenuWrapperProps) {
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

interface MapPinProps {
  pin: MapPinWithItem
  isGhost: boolean
  isHovered: boolean
  isDragging: boolean
  isInMoveMode: boolean
  onHover: (pinId: Id<'mapPins'> | null) => void
  onClick: (e: React.MouseEvent, pin: MapPinWithItem) => void
  onContextMenu: (e: React.MouseEvent, pin: MapPinWithItem) => void
  onDragStart: (e: React.MouseEvent, pin: MapPinWithItem) => void
}

function MapPin({
  pin,
  isGhost,
  isHovered,
  isDragging,
  isInMoveMode,
  onHover,
  onClick,
  onContextMenu,
  onDragStart,
}: MapPinProps) {
  const ghost = isGhost
  const visibleItem = ghost ? undefined : pin.item
  const Icon = getSidebarItemIcon(visibleItem)
  const color = ghost
    ? getComputedStyle(document.documentElement)
        .getPropertyValue('--muted-foreground')
        .trim()
    : validateHexColorOrDefault(visibleItem?.color, DEFAULT_ITEM_COLOR)
  const isHidden = pin.visible !== true
  const baseName = ghost ? '???' : (visibleItem?.name ?? '')
  const itemName = isHidden ? `${baseName} (hidden)` : baseName

  const hoverScale = isHovered && !isDragging ? 1.2 : 1

  return (
    <div
      data-pin-id={pin._id}
      className={cn(
        'absolute pointer-events-auto cursor-pointer',
        isHovered && !isDragging && 'z-20',
        isDragging && 'z-30 opacity-70',
        isHidden && !isDragging && 'opacity-60',
      )}
      style={{
        left: `${pin.x}%`,
        top: `${pin.y}%`,
        transform: 'translate(-50%, -100%) scale(var(--pin-scale, 1))',
        transformOrigin: 'bottom center',
      }}
      onMouseEnter={() => onHover(pin._id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => onClick(e, pin)}
      onContextMenu={(e) => onContextMenu(e, pin)}
      onMouseDown={(e) => {
        if (e.ctrlKey || e.metaKey || isInMoveMode) {
          e.preventDefault()
          e.stopPropagation()
          onDragStart(e, pin)
        }
      }}
    >
      {/* Teardrop pin marker */}
      <div
        className="transition-transform duration-100 ease-out"
        style={{
          transform: `scale(${hoverScale})`,
          transformOrigin: 'bottom center',
        }}
      >
        <svg
          width="32"
          height="44"
          viewBox="0 0 32 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-primary-foreground"
        >
          {/* Teardrop path */}
          <path
            d="M16 0C7.163 0 0 7.163 0 16C0 24.837 16 44 16 44C16 44 32 24.837 32 16C32 7.163 24.837 0 16 0Z"
            fill={color}
          />
          {/* White border effect */}
          <path
            d="M16 2C8.268 2 2 8.268 2 16C2 22.5 14.5 39 16 41C17.5 39 30 22.5 30 16C30 8.268 23.732 2 16 2Z"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
        </svg>
        {/* Icon */}
        <div className="absolute top-[8px] left-1/2 -translate-x-1/2 w-[18px] h-[18px] flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary-foreground" />
        </div>
      </div>

      {/* Tooltip */}
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 bottom-full mb-1',
          'bg-popover text-popover-foreground px-2 py-1 rounded-md shadow-md',
          'text-xs font-medium whitespace-nowrap',
          'transition-all duration-100 ease-out pointer-events-none',
          isHovered && !isDragging
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-1',
        )}
      >
        {itemName}
        {/* Tooltip arrow */}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-popover" />
      </div>
    </div>
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

export function MapViewer({
  item: map,
}: EditorViewerProps<GameMapWithContent>) {
  const imageRef = useRef<HTMLImageElement>(null)
  const pinsContainerRef = useRef<HTMLDivElement>(null)
  const transformWrapperRef = useRef<ReactZoomPanPinchRef>(null)
  // Keep a ref to `map` so the monitorForElements closure doesn't go stale
  // when pins are added/removed (which would otherwise re-register the monitor).
  const mapRef = useRef(map)
  mapRef.current = map
  const [hoveredPinId, setHoveredPinId] = useState<Id<'mapPins'> | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    setImageLoaded(false)
  }, [map.imageUrl])

  const { isDm } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const { itemsMap: allItemsMap } = useAllSidebarItems()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapDropData = useMemo(
    () => ({
      type: MAP_DROP_ZONE_TYPE,
      mapId: map._id,
      mapName: map.name,
      pinnedItemIds: map.pins.map((p) => p.itemId),
    }),
    [map._id, map.name, map.pins],
  )
  const { isDropTarget: isMapDropTarget } = useDndDropTarget({
    ref: mapContainerRef,
    data: mapDropData,
    highlightId: `map:${map._id}`,
  })
  const mapDragOutcome = useSidebarUIStore((s) =>
    isMapDropTarget ? s.dragOutcome : null,
  )

  const permOpts = useMemo(
    () => ({ isDm, viewAsPlayerId, allItemsMap }),
    [isDm, viewAsPlayerId, allItemsMap],
  )

  // Users with edit access see all pins (hidden ones are dimmed); view-only users only see visible pins
  const canEditMap = effectiveHasAtLeastPermission(
    map,
    PERMISSION_LEVEL.EDIT,
    permOpts,
  )

  const pins = useMemo(
    () =>
      canEditMap ? map.pins : map.pins.filter((pin) => pin.visible === true),
    [map.pins, canEditMap],
  )

  const isPinGhost = useCallback(
    (pin: MapPinWithItem): boolean => {
      if (!pin.item) return true
      return !effectiveHasAtLeastPermission(
        pin.item,
        PERMISSION_LEVEL.VIEW,
        permOpts,
      )
    },
    [permOpts],
  )

  const [savedTransform, setSavedTransform] =
    usePersistedState<MapTransformState>(
      `map-transform-${map._id}`,
      DEFAULT_TRANSFORM,
    )
  const transformDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

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
  const [pendingPinItem, setPendingPinItem] = useState<{
    itemId: SidebarItemId
  } | null>(null)
  const [pendingPinMove, setPendingPinMove] = useState<{
    pinId: Id<'mapPins'>
  } | null>(null)

  const lastMousePositionRef = useRef<{
    clientX: number
    clientY: number
  } | null>(null)

  const [draggingPin, setDraggingPin] = useState<{
    pin: MapPinWithItem
    startX: number
    startY: number
  } | null>(null)
  const draggedPinPositionRef = useRef<PinPosition | null>(null)
  const justFinishedDraggingRef = useRef<Id<'mapPins'> | null>(null)

  const createItemPinMutation = useAppMutation(
    api.gameMaps.mutations.createItemPin,
    { errorMessage: 'Failed to place pin' },
  )

  const updateItemPinMutation = useAppMutation(
    api.gameMaps.mutations.updateItemPin,
    { errorMessage: 'Failed to move pin' },
  )

  const handleTransformChange = useCallback(
    (
      _: unknown,
      state: { scale: number; positionX: number; positionY: number },
    ) => {
      if (pinsContainerRef.current) {
        pinsContainerRef.current.style.setProperty(
          '--pin-scale',
          String(1 / state.scale),
        )
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
    },
    [setSavedTransform],
  )

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingPinItem) {
          setPendingPinItem(null)
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
            pinEl.style.left = `${draggingPin.pin.x}%`
            pinEl.style.top = `${draggingPin.pin.y}%`
          }
          setDraggingPin(null)
          draggedPinPositionRef.current = null
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pendingPinItem, pendingPinMove, draggingPin])

  useEffect(() => {
    const handlePinPlacementRequest = (
      event: CustomEvent<{ itemId: SidebarItemId }>,
    ) => {
      setPendingPinItem(event.detail)
    }

    window.addEventListener(
      'map-pin-placement-request',
      handlePinPlacementRequest as EventListener,
    )
    return () => {
      window.removeEventListener(
        'map-pin-placement-request',
        handlePinPlacementRequest as EventListener,
      )
    }
  }, [])

  useEffect(() => {
    const handlePinMoveRequest = (
      event: CustomEvent<{ pinId: Id<'mapPins'> }>,
    ) => {
      setPendingPinMove(event.detail)
    }

    window.addEventListener(
      'map-pin-move-request',
      handlePinMoveRequest as EventListener,
    )
    return () => {
      window.removeEventListener(
        'map-pin-move-request',
        handlePinMoveRequest as EventListener,
      )
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
        pinEl.style.left = `${newPos.x}%`
        pinEl.style.top = `${newPos.y}%`
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
          console.error('Failed to move pin:', error)
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

  const getPercentageFromClick = useCallback(
    (e: React.MouseEvent): PinPosition => {
      if (!imageRef.current) return { x: 0, y: 0 }

      const rect = imageRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      }
    },
    [],
  )

  const createPinAtPosition = useCallback(
    async (itemId: SidebarItemId, position: PinPosition) => {
      try {
        await createItemPinMutation.mutateAsync({
          mapId: map._id,
          x: position.x,
          y: position.y,
          itemId,
        })
        toast.success('Pin placed on map')
      } catch (error) {
        console.error('Failed to place pin:', error)
      }
    },
    [map._id, createItemPinMutation],
  )
  const createPinAtPositionRef = useRef(createPinAtPosition)
  createPinAtPositionRef.current = createPinAtPosition

  useEffect(() => {
    return monitorForElements({
      onDrop: ({ source, location }) => {
        const topTarget = location.current.dropTargets[0]
        if (!topTarget) return

        const targetData = topTarget.data
        if (targetData.type !== MAP_DROP_ZONE_TYPE) return
        if (targetData.mapId !== mapRef.current._id) return
        const itemId = getDragItemId(source.data)
        if (!itemId) return

        const existingPinItemIds = mapRef.current.pins.map((pin) => pin.itemId)
        const pinError = validatePinTarget(
          mapRef.current._id,
          itemId,
          existingPinItemIds,
        )
        if (pinError) {
          toast.error(pinError)
          return
        }

        const { clientX, clientY } = location.current.input
        if (!imageRef.current) {
          toast.error('No image loaded — cannot place pin')
          return
        }

        const rect = imageRef.current.getBoundingClientRect()
        const x = ((clientX - rect.left) / rect.width) * 100
        const y = ((clientY - rect.top) / rect.height) * 100

        const position = {
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y)),
        }

        createPinAtPositionRef.current(itemId, position)
      },
    })
  }, [])

  const handlePlacePin = useCallback(
    async (position: PinPosition) => {
      if (!pendingPinItem || !map._id) return

      await createPinAtPosition(pendingPinItem.itemId, position)
      setPendingPinItem(null)
    },
    [pendingPinItem, map._id, createPinAtPosition],
  )

  const handleMovePin = useCallback(
    async (position: PinPosition) => {
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
        console.error('Failed to move pin:', error)
      }
    },
    [pendingPinMove, updateItemPinMutation],
  )

  const handleMapClick = useCallback(
    (e: React.MouseEvent) => {
      if (!pendingPinItem && !pendingPinMove) return

      e.preventDefault()
      e.stopPropagation()
      const position = getPercentageFromClick(e)

      if (pendingPinItem) {
        handlePlacePin(position)
      } else if (pendingPinMove) {
        handleMovePin(position)
      }
    },
    [
      pendingPinItem,
      pendingPinMove,
      getPercentageFromClick,
      handlePlacePin,
      handleMovePin,
    ],
  )

  const handlePinClick = useCallback(
    (e: React.MouseEvent, pin: MapPinWithItem) => {
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
    },
    [],
  )

  const handlePinContextMenu = useCallback(
    (e: React.MouseEvent, pin: MapPinWithItem) => {
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
    },
    [],
  )

  const handlePinDragStart = useCallback(
    (e: React.MouseEvent, pin: MapPinWithItem) => {
      if (pendingPinMove?.pinId === pin._id) {
        setPendingPinMove(null)
      }
      setDraggingPin({
        pin,
        startX: e.clientX,
        startY: e.clientY,
      })
      draggedPinPositionRef.current = { x: pin.x, y: pin.y }
    },
    [pendingPinMove],
  )

  const handleZoomIn = useCallback(() => {
    transformWrapperRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    transformWrapperRef.current?.zoomOut()
  }, [])

  const handleResetTransform = useCallback(() => {
    transformWrapperRef.current?.resetTransform()
    setSavedTransform(DEFAULT_TRANSFORM)
  }, [setSavedTransform])

  const mapImageContextMenuRef = useRef<EditorContextMenuRef>(null)

  const handleMapImageContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (pendingPinItem) return

      e.preventDefault()
      e.stopPropagation()
      e.nativeEvent.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()

      mapImageContextMenuRef.current?.open({
        x: e.clientX,
        y: e.clientY,
      })
    },
    [pendingPinItem],
  )

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    lastMousePositionRef.current = { clientX: e.clientX, clientY: e.clientY }
  }, [])

  const shouldDisablePanning =
    !!pendingPinItem || !!pendingPinMove || !!draggingPin

  return (
    <ClientOnly fallback={<MapViewerSkeleton />}>
      <MapViewProvider map={map} pins={pins}>
        <div
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

          <div ref={mapContainerRef} className="flex-1 relative min-h-0">
            {/* Ring + banner while a sidebar item is dragged over the map */}
            {mapDragOutcome && (
              <>
                <div
                  className={cn(
                    'absolute inset-0 z-[998] ring-2 ring-offset-2 pointer-events-none',
                    mapDragOutcome.type === 'operation'
                      ? 'ring-ring'
                      : 'ring-destructive',
                  )}
                />
                <div
                  className={cn(
                    'absolute top-4 left-1/2 -translate-x-1/2 z-[2000] px-4 py-2 rounded-md shadow-lg',
                    mapDragOutcome.type === 'operation'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-destructive text-destructive-foreground',
                  )}
                >
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {mapDragOutcome.type === 'rejection' && (
                      <Ban className="w-4 h-4 shrink-0" />
                    )}
                    {mapDragOutcome.type === 'operation'
                      ? 'Release to place pin here'
                      : rejectionReasonMessage(mapDragOutcome.reason)}
                  </p>
                </div>
              </>
            )}
            {/* Loading spinner while map image is loading */}
            {map.imageUrl && !imageLoaded && (
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
                onTransformed={handleTransformChange}
              >
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!w-full !h-full flex items-center justify-center"
                >
                  <div
                    className="relative"
                    onClick={
                      pendingPinItem || pendingPinMove
                        ? handleMapClick
                        : undefined
                    }
                    onMouseMove={handleMouseMove}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (pendingPinItem) {
                        const position = getPercentageFromClick(e)
                        handlePlacePin(position)
                      } else if (pendingPinMove) {
                        const position = getPercentageFromClick(e)
                        handleMovePin(position)
                      } else {
                        handleMapImageContextMenu(e)
                      }
                    }}
                  >
                    <img
                      ref={imageRef}
                      src={map.imageUrl ?? undefined}
                      alt={map.name || 'Map'}
                      className="select-none pointer-events-auto"
                      draggable={false}
                      onLoad={() => setImageLoaded(true)}
                      style={{
                        cursor:
                          pendingPinItem || pendingPinMove
                            ? 'crosshair'
                            : draggingPin
                              ? 'grabbing'
                              : 'default',
                        display: 'block',
                      }}
                    />

                    {/* Pins container — only render after the image has loaded so
                        percentage-based positions resolve correctly */}
                    {imageLoaded && (
                      <div
                        ref={pinsContainerRef}
                        className="absolute inset-0 pointer-events-none"
                      >
                        {pins.map((pin) => {
                          const isDraggingThis =
                            draggingPin?.pin._id === pin._id
                          const isInMoveMode = pendingPinMove?.pinId === pin._id

                          return (
                            <MapPin
                              key={pin._id}
                              pin={pin}
                              isGhost={isPinGhost(pin)}
                              isHovered={hoveredPinId === pin._id}
                              isDragging={isDraggingThis}
                              isInMoveMode={isInMoveMode}
                              onHover={setHoveredPinId}
                              onClick={handlePinClick}
                              onContextMenu={handlePinContextMenu}
                              onDragStart={handlePinDragStart}
                            />
                          )
                        })}
                      </div>
                    )}
                  </div>
                </TransformComponent>
              </TransformWrapper>
            ) : (
              <MapImageUpload mapId={map._id} />
            )}
          </div>

          {/* Pin placement mode banner */}
          {pendingPinItem && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
              <p className="text-sm font-medium">
                Click on map to place pin. Press Escape to cancel.
              </p>
            </div>
          )}

          {/* Pin move mode banner */}
          {pendingPinMove && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
              <p className="text-sm font-medium">
                Click on map or drag to move pin. Press Escape to cancel.
              </p>
            </div>
          )}

          {/* Pin dragging mode banner */}
          {draggingPin && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
              <p className="text-sm font-medium">
                Release to move pin. Press Escape to cancel.
              </p>
            </div>
          )}

          {pinContextMenu && (
            <MapPinContextMenuWrapper
              pinId={pinContextMenu.pinId}
              pins={pins}
              position={pinContextMenu.position}
              onClose={() => setPinContextMenu(null)}
            />
          )}

          <MapImageContextMenuWrapper
            contextMenuRef={mapImageContextMenuRef}
            map={map}
          />
        </div>
      </MapViewProvider>
    </ClientOnly>
  )
}

function MapImageUpload({ mapId }: { mapId: Id<'gameMaps'> }) {
  const updateMap = useAppMutation(api.gameMaps.mutations.updateMap, {
    errorMessage: 'Failed to update map',
  })

  const fileUpload = useFileWithPreview({
    isOpen: true,
    uploadOnSelect: true,
    fileTypeValidator: (file: globalThis.File) => {
      if (!file.type.startsWith('image/')) {
        return {
          success: false,
          error: 'Only image files are allowed for maps',
        }
      }
      return { success: true }
    },
    onUploadComplete: async (storageId) => {
      try {
        await updateMap.mutateAsync({
          mapId,
          imageStorageId: storageId,
        })
        toast.success('Map image uploaded')
      } catch (error) {
        console.error('Failed to set map image:', error)
      }
    },
  })

  const handleFileSelected = useCallback(
    (file: globalThis.File) => {
      fileUpload.handleFileSelect(file)
    },
    [fileUpload],
  )

  return (
    <div
      className="w-full h-full flex items-center justify-center p-8"
      onDragEnter={fileUpload.handleDrag}
      onDragLeave={fileUpload.handleDrag}
      onDragOver={fileUpload.handleDrag}
      onDrop={fileUpload.handleDrop}
    >
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Image className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-medium">Upload Map Image</h2>
          <p className="text-sm text-muted-foreground">
            Upload an image to create your map. You can pin items to it later.
          </p>
        </div>

        <div className="space-y-4">
          <FileUploadSection
            fileUpload={fileUpload}
            handleFileSelect={handleFileSelected}
            isSubmitting={false}
            acceptPattern="image/*"
            dragDropText="Drag an image here or click to browse"
          />

          {fileUpload.uploadError && (
            <p className="text-sm text-destructive text-center">
              {fileUpload.uploadError}
            </p>
          )}
        </div>
      </div>
    </div>
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
