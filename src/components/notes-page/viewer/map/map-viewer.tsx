import { useCallback, useEffect, useRef, useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useDndMonitor, useDroppable } from '@dnd-kit/core'
import {
  convexQuery,
  useConvex,
  useConvexMutation,
} from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { DEFAULT_ITEM_COLOR } from 'convex/sidebarItems/types'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import type { GameMap, MapPinWithItem } from 'convex/gameMaps/types'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { EditorContextMenuRef } from '~/components/context-menu/components/EditorContextMenu'
import type { SidebarDragData } from '~/lib/dnd-utils'
import { MAP_DROP_ZONE_TYPE } from '~/lib/dnd-utils'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { useMapView } from '~/hooks/useMapView'
import { Button } from '~/components/shadcn/ui/button'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { cn } from '~/lib/shadcn/utils'
import { validateHexColorOrDefault } from '~/lib/sidebar-item-utils'

interface PinPosition {
  x: number
  y: number
}

const MAP_DROP_ZONE_ID = 'map-drop-zone'

interface MapPinContextMenuWrapperProps {
  pinId: Id<'mapPins'>
  mapId: Id<'gameMaps'>
  position: PinPosition
  onClose: () => void
}

function MapPinContextMenuWrapper({
  pinId,
  mapId,
  position,
  onClose,
}: MapPinContextMenuWrapperProps) {
  const contextMenuRef = useRef<EditorContextMenuRef>(null)
  const { setPinId } = useMapView()
  const dialogOpenRef = useRef(false)

  const pinsQuery = useQuery(
    convexQuery(api.gameMaps.queries.getMapPins, { mapId }),
  )
  const pin = pinsQuery.data?.find((p) => p._id === pinId)

  useEffect(() => {
    if (pin) {
      setPinId(pinId)
      contextMenuRef.current?.open(position)
    }
    return () => {
      setPinId(null)
    }
  }, [pin, pinId, position, setPinId])

  const handleDialogOpen = useCallback(() => {
    dialogOpenRef.current = true
  }, [])

  const handleMenuClose = useCallback(() => {
    setPinId(null)
    // Only clean up if no dialog was opened
    if (!dialogOpenRef.current) {
      onClose()
    }
  }, [setPinId, onClose])

  const handleDialogClose = useCallback(() => {
    dialogOpenRef.current = false
    onClose()
  }, [onClose])

  if (!pin) return null

  return (
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext="map-view"
      item={pin.item}
      className="absolute inset-0 pointer-events-none"
      onClose={handleMenuClose}
      onDialogOpen={handleDialogOpen}
      onDialogClose={handleDialogClose}
    >
      <div className="w-full h-full" />
    </EditorContextMenu>
  )
}

interface MapPinProps {
  pin: MapPinWithItem
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
  isHovered,
  isDragging,
  isInMoveMode,
  onHover,
  onClick,
  onContextMenu,
  onDragStart,
}: MapPinProps) {
  const Icon = getSidebarItemIcon(pin.item)
  const color = validateHexColorOrDefault(pin.item.color, DEFAULT_ITEM_COLOR)
  const itemName = pin.item.name || defaultItemName(pin.item)

  const hoverScale = isHovered && !isDragging ? 1.2 : 1

  return (
    <div
      className={cn(
        'absolute pointer-events-auto cursor-pointer',
        isHovered && !isDragging && 'z-20',
        isDragging && 'z-30 opacity-70',
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
        className="transition-transform duration-150 ease-out"
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
          className={cn('drop-shadow-lg', isHovered && 'drop-shadow-xl')}
        >
          {/* Teardrop path */}
          <path
            d="M16 0C7.163 0 0 7.163 0 16C0 24.837 16 44 16 44C16 44 32 24.837 32 16C32 7.163 24.837 0 16 0Z"
            fill={color}
          />
          {/* White border effect */}
          <path
            d="M16 2C8.268 2 2 8.268 2 16C2 22.5 14.5 39 16 41C17.5 39 30 22.5 30 16C30 8.268 23.732 2 16 2Z"
            stroke="white"
            strokeWidth="2"
            fill="none"
          />
        </svg>
        {/* Icon */}
        <div className="absolute top-[8px] left-1/2 -translate-x-1/2 w-[18px] h-[18px] flex items-center justify-center">
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Tooltip */}
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 bottom-full mb-1',
          'bg-popover text-popover-foreground px-2 py-1 rounded-md shadow-md',
          'text-xs font-medium whitespace-nowrap',
          'transition-all duration-150 pointer-events-none',
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

export function MapViewer({ item: map }: EditorViewerProps<GameMap>) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const pinsContainerRef = useRef<HTMLDivElement>(null)
  const transformWrapperRef = useRef<ReactZoomPanPinchRef>(null)
  const [hoveredPinId, setHoveredPinId] = useState<Id<'mapPins'> | null>(null)
  const [pinContextMenu, setPinContextMenu] = useState<{
    pinId: Id<'mapPins'>
    position: PinPosition
  } | null>(null)
  const [pendingPinItem, setPendingPinItem] = useState<{
    itemId: SidebarItemId
  } | null>(null)
  // Track pending pin move
  const [pendingPinMove, setPendingPinMove] = useState<{
    pinId: Id<'mapPins'>
  } | null>(null)

  // Track mouse position for drag-drop pin placement
  const lastMousePositionRef = useRef<{
    clientX: number
    clientY: number
  } | null>(null)

  // Track dragging pin state
  const [draggingPin, setDraggingPin] = useState<{
    pin: MapPinWithItem
    startX: number
    startY: number
  } | null>(null)
  const [draggedPinPosition, setDraggedPinPosition] =
    useState<PinPosition | null>(null)
  // Track if a drag just ended to prevent click firing
  const justFinishedDraggingRef = useRef<Id<'mapPins'> | null>(null)

  const convex = useConvex()
  const { setPinId, pinnedItemIds } = useMapView()

  // Query pins for rendering
  const pinsQuery = useQuery(
    convexQuery(api.gameMaps.queries.getMapPins, { mapId: map._id }),
  )
  const pins = pinsQuery.data || []

  const createItemPinMutation = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.createItemPin),
  })

  const updateItemPinMutation = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.updateItemPin),
  })

  // Update CSS variable for pin counter-scaling when transform changes
  const handleTransformChange = useCallback(
    (_: unknown, state: { scale: number }) => {
      if (pinsContainerRef.current) {
        pinsContainerRef.current.style.setProperty(
          '--pin-scale',
          String(1 / state.scale),
        )
      }
    },
    [],
  )

  // Setup drop zone for sidebar items
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: MAP_DROP_ZONE_ID,
    data: {
      type: MAP_DROP_ZONE_TYPE,
      mapId: map._id,
      mapName: map.name || defaultItemName(map),
    },
  })

  // Listen for drag end events from dnd-kit
  useDndMonitor({
    onDragEnd: (event) => {
      const { active, over } = event
      if (!over || over.id !== MAP_DROP_ZONE_ID) return
      if (!active.data.current) return

      const draggedItem = active.data.current as SidebarDragData
      const itemId = draggedItem._id

      // Check if already pinned
      if (pinnedItemIds.has(itemId)) {
        toast.error('Item is already pinned on this map')
        // TODO: add highlight of pin here
        return
      }

      // Calculate position from last mouse position
      if (lastMousePositionRef.current && imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect()
        const x =
          ((lastMousePositionRef.current.clientX - rect.left) / rect.width) *
          100
        const y =
          ((lastMousePositionRef.current.clientY - rect.top) / rect.height) *
          100

        const position = {
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y)),
        }

        createPinAtPosition(itemId, position)
      }
    },
  })

  useEffect(() => {
    if (!map.imageStorageId) {
      setImageUrl(null)
      return
    }

    convex
      .query(api.storage.queries.getDownloadUrl, {
        storageId: map.imageStorageId,
      })
      .then((url) => {
        setImageUrl(url || null)
      })
      .catch(() => {
        setImageUrl(null)
      })
  }, [map.imageStorageId, convex])

  // Handle escape key for canceling pin placement, move, or dragging
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
          setDraggingPin(null)
          setDraggedPinPosition(null)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pendingPinItem, pendingPinMove, draggingPin])

  // Listen for pin placement requests from context menu
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

  // Listen for pin move requests from context menu
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

  // Handle pin dragging
  useEffect(() => {
    if (!draggingPin) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!imageRef.current) return

      const rect = imageRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      setDraggedPinPosition({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      })
    }

    const handleMouseUp = async () => {
      const pinId = draggingPin.pin._id
      // Mark that this pin just finished dragging to prevent click
      justFinishedDraggingRef.current = pinId
      setTimeout(() => {
        if (justFinishedDraggingRef.current === pinId) {
          justFinishedDraggingRef.current = null
        }
      }, 100)

      if (draggedPinPosition) {
        try {
          await updateItemPinMutation.mutateAsync({
            mapPinId: pinId,
            x: draggedPinPosition.x,
            y: draggedPinPosition.y,
          })
          toast.success('Pin moved')
        } catch (error) {
          console.error('Failed to move pin:', error)
          toast.error('Failed to move pin')
        }
      }
      setDraggingPin(null)
      setDraggedPinPosition(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingPin, draggedPinPosition, updateItemPinMutation])

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
        toast.error('Failed to place pin')
      }
    },
    [map._id, createItemPinMutation],
  )

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
        toast.error('Failed to move pin')
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
      setDraggedPinPosition({ x: pin.x, y: pin.y })
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
  }, [])

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
    <div className="relative w-full h-full min-h-0 bg-background overflow-hidden flex flex-col">
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomIn}
          className="bg-white shadow-md"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomOut}
          className="bg-white shadow-md"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleResetTransform}
          className="bg-white shadow-md"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 relative min-h-0">
        {imageUrl ? (
          <TransformWrapper
            ref={transformWrapperRef}
            initialScale={1}
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
                ref={setDropRef}
                className={cn(
                  'relative',
                  isDropOver && 'ring-2 ring-primary ring-offset-2',
                )}
                onClick={
                  pendingPinItem || pendingPinMove ? handleMapClick : undefined
                }
                onMouseMove={handleMouseMove}
                onContextMenu={(e) => {
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
                  src={imageUrl}
                  alt={map.name || 'Map'}
                  className="select-none pointer-events-auto"
                  draggable={false}
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

                {/* Pins container */}
                <div
                  ref={pinsContainerRef}
                  className="absolute inset-0 pointer-events-none"
                >
                  {pins.map((pin: MapPinWithItem) => {
                    const isDraggingThis = draggingPin?.pin._id === pin._id
                    const isInMoveMode = pendingPinMove?.pinId === pin._id
                    const displayPosition =
                      isDraggingThis && draggedPinPosition
                        ? draggedPinPosition
                        : { x: pin.x, y: pin.y }

                    return (
                      <MapPin
                        key={pin._id}
                        pin={{
                          ...pin,
                          x: displayPosition.x,
                          y: displayPosition.y,
                        }}
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
              </div>
            </TransformComponent>
          </TransformWrapper>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <p>No map image available</p>
          </div>
        )}
      </div>

      {/* Pin placement mode banner */}
      {pendingPinItem && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg">
          <p className="text-sm font-medium">
            Click on map to place pin. Press Escape to cancel.
          </p>
        </div>
      )}

      {/* Pin move mode banner */}
      {pendingPinMove && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-amber-600 text-white px-4 py-2 rounded-md shadow-lg">
          <p className="text-sm font-medium">
            Click on map or drag to move pin. Press Escape to cancel.
          </p>
        </div>
      )}

      {/* Drag-drop mode banner */}
      {isDropOver && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-green-600 text-white px-4 py-2 rounded-md shadow-lg">
          <p className="text-sm font-medium">Release to place pin here</p>
        </div>
      )}

      {/* Pin dragging mode banner */}
      {draggingPin && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-amber-600 text-white px-4 py-2 rounded-md shadow-lg">
          <p className="text-sm font-medium">
            Release to move pin. Press Escape to cancel.
          </p>
        </div>
      )}

      {pinContextMenu && (
        <MapPinContextMenuWrapper
          pinId={pinContextMenu.pinId}
          mapId={map._id}
          position={pinContextMenu.position}
          onClose={() => setPinContextMenu(null)}
        />
      )}

      <EditorContextMenu
        ref={mapImageContextMenuRef}
        viewContext="map-view"
        item={map}
        className="absolute inset-0 pointer-events-none"
        onClose={() => {
          setPinId(null)
        }}
      >
        <div className="w-full h-full" />
      </EditorContextMenu>
    </div>
  )
}
