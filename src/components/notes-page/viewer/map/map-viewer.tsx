import { useCallback, useEffect, useRef, useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  convexQuery,
  useConvex,
  useConvexMutation,
} from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import type { GameMap, MapPinWithItem } from 'convex/gameMaps/types'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { MapViewContextMenuRef } from '~/components/context-menu/map-view/MapViewContextMenu'
import { Button } from '~/components/shadcn/ui/button'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { MapPinContextMenu } from '~/components/context-menu/map-view/MapPinContextMenu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/shadcn/ui/tooltip'
import { cn } from '~/lib/shadcn/utils'
import { MapViewContextMenu } from '~/components/context-menu/map-view/MapViewContextMenu'

interface PinPosition {
  x: number
  y: number
}

const DEFAULT_PIN_COLOR = '#808080'

export function MapViewer({ item: map }: EditorViewerProps<GameMap>) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const transformWrapperRef = useRef<ReactZoomPanPinchRef>(null)
  const [hoveredPinId, setHoveredPinId] = useState<Id<'mapPins'> | null>(null)
  const [pinContextMenu, setPinContextMenu] = useState<{
    pinId: Id<'mapPins'>
    position: PinPosition
  } | null>(null)
  const [pendingPinItem, setPendingPinItem] = useState<{
    itemId: Id<'notes'> | Id<'gameMaps'>
  } | null>(null)

  const convex = useConvex()

  // Query pins for rendering
  const pinsQuery = useQuery(
    convexQuery(api.gameMaps.queries.getMapPins, { mapId: map._id }),
  )

  const pins = pinsQuery.data || []

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

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && pendingPinItem) {
        setPendingPinItem(null)
        toast.info('Pin placement cancelled')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pendingPinItem])

  // Listen for pin placement requests from context menu
  useEffect(() => {
    const handlePinPlacementRequest = (
      event: CustomEvent<{
        itemId: Id<'notes'> | Id<'gameMaps'>
      }>,
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

  const createItemPinMutation = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.createItemPin),
  })

  const handlePlacePin = useCallback(
    async (position: PinPosition) => {
      if (!pendingPinItem || !map._id) return

      try {
        await createItemPinMutation.mutateAsync({
          mapId: map._id,
          x: position.x,
          y: position.y,
          itemId: pendingPinItem.itemId,
        })
        toast.success('Pin placed on map')
        setPendingPinItem(null)
      } catch (error) {
        console.error('Failed to place pin:', error)
        toast.error('Failed to place pin')
      }
    },
    [pendingPinItem, map._id, createItemPinMutation],
  )

  const handleMapClick = useCallback(
    (e: React.MouseEvent) => {
      if (!pendingPinItem) return

      e.preventDefault()
      e.stopPropagation()
      const position = getPercentageFromClick(e)
      handlePlacePin(position)
    },
    [pendingPinItem, getPercentageFromClick, handlePlacePin],
  )

  const handleMapContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (pendingPinItem) {
        const position = getPercentageFromClick(e)
        handlePlacePin(position)
      }
    },
    [pendingPinItem, getPercentageFromClick, handlePlacePin],
  )

  const handlePinClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toast.info('Pin click not implemented')
  }, [])

  const handlePinContextMenu = useCallback(
    (e: React.MouseEvent, pin: MapPinWithItem) => {
      e.preventDefault()
      e.stopPropagation()
      // Stop propagation at native level too
      e.nativeEvent.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()

      const rect = imageRef.current?.getBoundingClientRect()
      if (!rect) return

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

  const handleZoomIn = useCallback(() => {
    transformWrapperRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    transformWrapperRef.current?.zoomOut()
  }, [])

  const handleResetTransform = useCallback(() => {
    transformWrapperRef.current?.resetTransform()
  }, [])

  const getItemName = useCallback((pin: MapPinWithItem) => {
    return pin.item.name || defaultItemName(pin.item)
  }, [])

  const mapImageContextMenuRef = useRef<MapViewContextMenuRef>(null)

  const handleMapImageContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // Only show if not in pin placement mode and not clicking on a pin
      if (pendingPinItem) return

      e.preventDefault()
      e.stopPropagation()
      // Stop propagation at native level too
      e.nativeEvent.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()

      mapImageContextMenuRef.current?.open({
        x: e.clientX,
        y: e.clientY,
      })
    },
    [pendingPinItem],
  )

  return (
    <div className="relative w-full h-full min-h-0 bg-background overflow-hidden flex flex-col">
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
            panning={{ disabled: !!pendingPinItem }}
            limitToBounds={false}
            centerOnInit={false}
          >
            <TransformComponent
              wrapperClass="w-full h-full"
              contentClass="w-full h-full flex items-center justify-center"
            >
              <div
                className="relative"
                onClick={pendingPinItem ? handleMapClick : undefined}
                onContextMenu={(e) => {
                  // Stop propagation to prevent TransformWrapper from interfering
                  e.stopPropagation()
                  if (pendingPinItem) {
                    handleMapContextMenu(e)
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
                    cursor: pendingPinItem ? 'crosshair' : 'default',
                    display: 'block',
                  }}
                />

                {pins.map((pin: MapPinWithItem) => {
                  const Icon = getSidebarItemIcon(pin.item)
                  // Use color from item if available
                  const color = pin.item.color
                  const isHovered = hoveredPinId === pin._id

                  return (
                    <Tooltip key={pin._id} open={isHovered}>
                      <TooltipTrigger>
                        <div
                          className={cn(
                            'absolute pointer-events-auto cursor-pointer transition-transform',
                            isHovered && 'scale-125',
                          )}
                          style={{
                            left: `${pin.x}%`,
                            top: `${pin.y}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          onMouseEnter={() => setHoveredPinId(pin._id)}
                          onMouseLeave={() => setHoveredPinId(null)}
                          onClick={handlePinClick}
                          onContextMenu={(e) => handlePinContextMenu(e, pin)}
                        >
                          <div
                            className="rounded-full p-1.5 shadow-lg border-2 border-white"
                            style={{
                              backgroundColor: color ?? DEFAULT_PIN_COLOR,
                            }}
                          >
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{getItemName(pin)}</p>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </TransformComponent>
          </TransformWrapper>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <p>No map image available</p>
          </div>
        )}
      </div>

      {pendingPinItem && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg">
          <p className="text-sm font-medium">
            Click on map to place pin. Press Escape to cancel.
          </p>
        </div>
      )}

      {pinContextMenu && (
        <MapPinContextMenu
          pinId={pinContextMenu.pinId}
          mapId={map._id}
          position={pinContextMenu.position}
          onClose={() => setPinContextMenu(null)}
        />
      )}

      <MapViewContextMenu
        ref={mapImageContextMenuRef}
        item={map}
        className="absolute inset-0 pointer-events-none"
      >
        <div className="w-full h-full" />
      </MapViewContextMenu>
    </div>
  )
}
