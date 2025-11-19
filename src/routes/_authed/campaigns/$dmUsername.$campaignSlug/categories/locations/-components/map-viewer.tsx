import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { Button } from '~/components/shadcn/ui/button'
import { Plus, X, ChevronRight } from '~/lib/icons'
import { ChevronLeft, Minus, Search, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  convexQuery,
  useConvexMutation,
  useConvex,
} from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { useCampaign } from '~/contexts/CampaignContext'
import LocationTagDialog from '~/components/forms/category-tag-form/location-tag-form/location-tag-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import { SYSTEM_DEFAULT_CATEGORIES } from 'convex/tags/types'
import { getCategoryIcon } from '~/lib/category-icons'
import type { Location } from 'convex/locations/types'
import { Card, CardContent } from '~/components/shadcn/ui/card'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { Input } from '~/components/shadcn/ui/input'
import { getTagColor } from '~/hooks/useTags'
import { cn } from '~/lib/utils'
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch'
import { MapPin } from './map-pin'
import { MapViewerContextMenu } from '~/components/context-menu/map/map-viewer-context-menu'

interface MapViewerProps {
  mapId: Id<'maps'>
  onClose: () => void
}

interface PinPosition {
  x: number
  y: number
}

export function MapViewer({ mapId, onClose }: MapViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const imageRef = useRef<globalThis.HTMLImageElement>(null)
  const transformWrapperRef = useRef<ReactZoomPanPinchRef>(null)

  const [contextMenuPosition, setContextMenuPosition] =
    useState<PinPosition | null>(null)
  const [pendingPinPosition, setPendingPinPosition] =
    useState<PinPosition | null>(null)
  const [selectedPinId, setSelectedPinId] = useState<Id<'mapPins'> | null>(null)
  const [pinContextMenuPosition, setPinContextMenuPosition] =
    useState<PinPosition | null>(null)
  const [isCreatingLocation, setIsCreatingLocation] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'pinned' | 'notPinned'>('pinned')
  const [searchQuery, setSearchQuery] = useState('')
  const [draggingEnabledPinId, setDraggingEnabledPinId] =
    useState<Id<'mapPins'> | null>(null)
  const [pendingPinLocationId, setPendingPinLocationId] =
    useState<Id<'locations'> | null>(null)

  const optimisticPositions = useRef<Map<Id<'mapPins'>, PinPosition>>(new Map())

  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const convex = useConvex()

  const mapQuery = useQuery(
    convexQuery(api.locations.queries.getMap, { mapId }),
  )
  const pinsQuery = useQuery(
    convexQuery(api.locations.queries.getMapPins, { mapId }),
  )
  const locationsQuery = useQuery(
    convexQuery(
      api.locations.queries.getLocationsByCampaign,
      campaign?._id ? { campaignId: campaign._id } : 'skip',
    ),
  )

  const map = mapQuery.data
  const pins = pinsQuery.data || []
  const allLocations = locationsQuery.data || []

  const pinnedLocationIds = useMemo(
    () => new Set(pins.map((p) => p.locationId)),
    [pins],
  )

  const pinnedLocations = useMemo(
    () => allLocations.filter((loc) => pinnedLocationIds.has(loc.locationId)),
    [allLocations, pinnedLocationIds],
  )

  const nonPinnedLocations = useMemo(
    () => allLocations.filter((loc) => !pinnedLocationIds.has(loc.locationId)),
    [allLocations, pinnedLocationIds],
  )

  const filteredPinnedLocations = useMemo(
    () =>
      pinnedLocations.filter((loc) =>
        loc.displayName.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [pinnedLocations, searchQuery],
  )

  const filteredNonPinnedLocations = useMemo(
    () =>
      nonPinnedLocations.filter((loc) =>
        loc.displayName.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [nonPinnedLocations, searchQuery],
  )

  const updatePinMutation = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.updatePinCoordinates),
  })

  const setLocationPinMutation = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.setLocationPin),
  })

  const categoryConfig = useMemo<TagCategoryConfig | undefined>(() => {
    if (!campaign) return undefined
    return {
      categorySlug: SYSTEM_DEFAULT_CATEGORIES.Location.slug,
      singular: SYSTEM_DEFAULT_CATEGORIES.Location.displayName,
      plural: SYSTEM_DEFAULT_CATEGORIES.Location.pluralDisplayName,
      icon: getCategoryIcon(SYSTEM_DEFAULT_CATEGORIES.Location.iconName),
    }
  }, [campaign])

  useEffect(() => {
    if (!map?.imageStorageId) {
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
  }, [map?.imageStorageId, convex])

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && pendingPinLocationId) {
        setPendingPinLocationId(null)
        toast.info('Pin placement cancelled')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pendingPinLocationId])

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

  const handlePlacePin = useCallback(
    async (position: PinPosition) => {
      if (!pendingPinLocationId) return

      try {
        await setLocationPinMutation.mutateAsync({
          mapId,
          locationId: pendingPinLocationId,
          x: position.x,
          y: position.y,
        })
        toast.success('Pin placed on map')
        setPendingPinLocationId(null)
      } catch (error) {
        console.error('Failed to place pin:', error)
        toast.error('Failed to place pin')
      }
    },
    [pendingPinLocationId, mapId, setLocationPinMutation],
  )

  const handleMapClick = useCallback(
    (e: React.MouseEvent) => {
      if (!pendingPinLocationId) return

      e.preventDefault()
      e.stopPropagation()
      const position = getPercentageFromClick(e)
      handlePlacePin(position)
    },
    [pendingPinLocationId, getPercentageFromClick, handlePlacePin],
  )

  const handleMapContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (pendingPinLocationId) {
        const position = getPercentageFromClick(e)
        handlePlacePin(position)
        return
      }

      const position = getPercentageFromClick(e)
      setContextMenuPosition({ x: e.clientX, y: e.clientY })
      setPendingPinPosition(position)
    },
    [pendingPinLocationId, getPercentageFromClick, handlePlacePin],
  )

  const handleCreateLocation = useCallback(() => {
    if (!pendingPinPosition) return
    setIsCreatingLocation(true)
    setContextMenuPosition(null)
  }, [pendingPinPosition])

  const handleLocationCreated = useCallback(
    async (locationId: Id<'locations'>) => {
      if (!pendingPinPosition) return

      try {
        await setLocationPinMutation.mutateAsync({
          mapId,
          locationId,
          x: pendingPinPosition.x,
          y: pendingPinPosition.y,
        })
        toast.success('Location created and pinned to map')
        setIsCreatingLocation(false)
        setPendingPinPosition(null)
      } catch (error) {
        console.error('Failed to create pin:', error)
        toast.error('Failed to pin location to map')
      }
    },
    [pendingPinPosition, mapId, setLocationPinMutation],
  )

  const handlePinDragStart = useCallback(
    (pinId: Id<'mapPins'>) => {
      const pin = pins.find((p) => p._id === pinId)
      if (pin) {
        optimisticPositions.current.set(pinId, { x: pin.x, y: pin.y })
      }
    },
    [pins],
  )

  const handlePinDrag = useCallback(
    (pinId: Id<'mapPins'>, position: PinPosition) => {
      optimisticPositions.current.set(pinId, position)
    },
    [],
  )

  const handlePinDragEnd = useCallback(
    async (pinId: Id<'mapPins'>, position: PinPosition) => {
      try {
        await updatePinMutation.mutateAsync({
          pinId,
          x: position.x,
          y: position.y,
        })
        optimisticPositions.current.delete(pinId)
        setDraggingEnabledPinId(null)
      } catch (error) {
        console.error('Failed to update pin:', error)
        const pin = pins.find((p) => p._id === pinId)
        if (pin) {
          optimisticPositions.current.set(pinId, { x: pin.x, y: pin.y })
        }
        toast.error('Failed to update pin position')
      }
    },
    [updatePinMutation, pins],
  )

  const handlePinContextMenu = useCallback(
    (pinId: Id<'mapPins'>, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setSelectedPinId(pinId)
      setPinContextMenuPosition({ x: e.clientX, y: e.clientY })
    },
    [],
  )

  const handleEnableDragging = useCallback((pinId: Id<'mapPins'>) => {
    setDraggingEnabledPinId(pinId)
    setSelectedPinId(null)
    setPinContextMenuPosition(null)
  }, [])

  const handlePinnedLocationClick = useCallback(() => {
    // TODO: implement zoom/pan to pin here
  }, [])

  const handleNonPinnedLocationClick = useCallback(
    (locationId: Id<'locations'>) => {
      setPendingPinLocationId(locationId)
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

  if (!map) {
    return null
  }

  return (
    <>
      <div className="absolute inset-0 bg-background overflow-hidden">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 z-[1000] bg-white shadow-md"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>

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

        <div className="absolute inset-0">
          {imageUrl ? (
            <TransformWrapper
              ref={transformWrapperRef}
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              wheel={{ step: 0.1 }}
              doubleClick={{ disabled: false }}
              panning={{ disabled: !!pendingPinLocationId }}
              limitToBounds={false}
              centerOnInit={false}
            >
              <TransformComponent
                wrapperClass="w-full h-full"
                contentClass="w-full h-full flex items-center justify-center"
              >
                <div
                  className="relative"
                  onClick={pendingPinLocationId ? handleMapClick : undefined}
                  onContextMenu={handleMapContextMenu}
                >
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt={map.name || 'Map'}
                    className="select-none pointer-events-auto"
                    // onClick={handleMapClick}
                    onContextMenu={handleMapContextMenu}
                    draggable={false}
                    style={{
                      cursor: pendingPinLocationId ? 'crosshair' : 'default',
                      display: 'block',
                    }}
                  />

                  {pins.map((pin) => {
                    const optimisticPos = optimisticPositions.current.get(
                      pin._id,
                    )
                    const position = optimisticPos || { x: pin.x, y: pin.y }

                    return (
                      <MapPin
                        key={pin._id}
                        pin={{ ...pin, ...position }}
                        location={pin.location}
                        draggable={draggingEnabledPinId === pin._id}
                        onDragStart={() => handlePinDragStart(pin._id)}
                        onDrag={(x, y) => handlePinDrag(pin._id, { x, y })}
                        onDragEnd={(x, y) =>
                          handlePinDragEnd(pin._id, { x, y })
                        }
                        onContextMenu={(e) => handlePinContextMenu(pin._id, e)}
                        imageRef={imageRef}
                      />
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

        {contextMenuPosition && !pendingPinLocationId && (
          <MapViewerContextMenu
            position={contextMenuPosition}
            onClose={() => setContextMenuPosition(null)}
            onCreateLocation={handleCreateLocation}
          />
        )}

        {pendingPinLocationId && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg">
            <p className="text-sm font-medium">
              Click on map to place pin for{' '}
              {allLocations.find((l) => l.locationId === pendingPinLocationId)
                ?.displayName || 'location'}
            </p>
          </div>
        )}

        <LocationSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          pinnedLocations={filteredPinnedLocations}
          nonPinnedLocations={filteredNonPinnedLocations}
          onPinnedLocationClick={handlePinnedLocationClick}
          onNonPinnedLocationClick={handleNonPinnedLocationClick}
          pendingPinLocationId={pendingPinLocationId}
        />
      </div>

      {isCreatingLocation && categoryConfig && campaign && (
        <LocationTagDialog
          mode="create"
          isOpen={isCreatingLocation}
          onClose={() => {
            setIsCreatingLocation(false)
            setPendingPinPosition(null)
          }}
          config={categoryConfig}
          onLocationCreated={handleLocationCreated}
        />
      )}

      {selectedPinId && pinContextMenuPosition && (
        <PinContextMenu
          pinId={selectedPinId}
          mapId={mapId}
          position={pinContextMenuPosition}
          onClose={() => {
            setSelectedPinId(null)
            setPinContextMenuPosition(null)
          }}
          onEnableDragging={handleEnableDragging}
        />
      )}
    </>
  )
}

function PinContextMenu({
  pinId,
  mapId,
  position,
  onClose,
  onEnableDragging,
}: {
  pinId: Id<'mapPins'>
  mapId: Id<'maps'>
  position: PinPosition
  onClose: () => void
  onEnableDragging: (pinId: Id<'mapPins'>) => void
}) {
  const pinsQuery = useQuery(
    convexQuery(api.locations.queries.getMapPins, { mapId }),
  )
  const removePinMutation = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.removeLocationPin),
  })

  const pin = pinsQuery.data?.find((p) => p._id === pinId)

  const handleRemovePin = useCallback(async () => {
    if (!pin) return
    try {
      await removePinMutation.mutateAsync({
        mapId,
        locationId: pin.locationId,
      })
      onClose()
    } catch (error) {
      console.error('Failed to remove pin:', error)
      toast.error('Failed to remove pin')
    }
  }, [pin, mapId, removePinMutation, onClose])

  const handleEnableDragging = useCallback(() => {
    if (pin) {
      onEnableDragging(pin._id)
    }
  }, [pin, onEnableDragging])

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      const menu = document.getElementById(`pin-context-menu-${pinId}`)
      if (menu && !menu.contains(e.target as globalThis.Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [pinId, onClose])

  if (!pin) return null

  return (
    <div
      id={`pin-context-menu-${pinId}`}
      className="fixed bg-white border rounded-md shadow-lg p-1 z-[2000] min-w-[150px]"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <button
        onClick={handleEnableDragging}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-sm"
      >
        Enable Dragging
      </button>
      <button
        onClick={handleRemovePin}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-sm text-red-600"
      >
        Remove Pin
      </button>
    </div>
  )
}

function LocationSidebar({
  isOpen,
  onToggle,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  pinnedLocations,
  nonPinnedLocations,
  onPinnedLocationClick,
  onNonPinnedLocationClick,
  pendingPinLocationId,
}: {
  isOpen: boolean
  onToggle: () => void
  activeTab: 'pinned' | 'notPinned'
  onTabChange: (tab: 'pinned' | 'notPinned') => void
  searchQuery: string
  onSearchChange: (query: string) => void
  pinnedLocations: Location[]
  nonPinnedLocations: Location[]
  onPinnedLocationClick: () => void
  onNonPinnedLocationClick: (locationId: Id<'locations'>) => void
  pendingPinLocationId: Id<'locations'> | null
}) {
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={cn(
          'absolute top-20 right-4 z-[1000] bg-white shadow-md transition-transform',
          isOpen && 'right-[320px]',
        )}
        onClick={onToggle}
      >
        {isOpen ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </Button>

      {isOpen && (
        <Card className="absolute top-0 right-0 h-full w-80 z-[999] rounded-none border-l border-t-0 border-r-0 border-b-0 shadow-lg flex flex-col">
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            <div className="flex border-b">
              <button
                onClick={() => onTabChange('pinned')}
                className={cn(
                  'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                  activeTab === 'pinned'
                    ? 'bg-muted border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Pinned ({pinnedLocations.length})
              </button>
              <button
                onClick={() => onTabChange('notPinned')}
                className={cn(
                  'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                  activeTab === 'notPinned'
                    ? 'bg-muted border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Not Pinned ({nonPinnedLocations.length})
              </button>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search locations..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {activeTab === 'pinned' &&
                  pinnedLocations.map((location) => {
                    const Icon = getCategoryIcon(location.category?.iconName)
                    const color = getTagColor(location)
                    return (
                      <button
                        key={location.locationId}
                        onClick={onPinnedLocationClick}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <Icon
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color }}
                        />
                        <span className="truncate">{location.displayName}</span>
                      </button>
                    )
                  })}
                {activeTab === 'notPinned' &&
                  nonPinnedLocations.map((location) => {
                    const Icon = getCategoryIcon(location.category?.iconName)
                    const color = getTagColor(location)
                    const isPending =
                      pendingPinLocationId === location.locationId
                    return (
                      <button
                        key={location.locationId}
                        onClick={() =>
                          onNonPinnedLocationClick(location.locationId)
                        }
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center gap-2',
                          isPending && 'bg-blue-100 border border-blue-300',
                        )}
                      >
                        <Icon
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color }}
                        />
                        <span className="truncate">{location.displayName}</span>
                      </button>
                    )
                  })}
                {activeTab === 'pinned' && pinnedLocations.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {searchQuery
                      ? 'No pinned locations match your search'
                      : 'No pinned locations'}
                  </div>
                )}
                {activeTab === 'notPinned' &&
                  nonPinnedLocations.length === 0 && (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      {searchQuery
                        ? 'No locations match your search'
                        : 'All locations are pinned'}
                    </div>
                  )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </>
  )
}
