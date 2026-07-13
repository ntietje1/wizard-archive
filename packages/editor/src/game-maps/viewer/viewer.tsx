import { useRef, useState } from 'react'
import { ClientOnly } from '@wizard-archive/ui/components/client-only'
import type { MapItemWithContent } from '../../game-maps/item-contract'
import type { MapPinId, SidebarItemId } from '../../../../../shared/common/ids'
import type { ContextMenuHostRef } from '../../context-menu/components/host'
import { MAP_DROP_ZONE_TYPE } from '../../drag-drop/drop-target-data'
import { useDndDropTarget } from '../../drag-drop/use-drop-target'
import { useMergedRef } from '../../drag-drop/ref-utils'
import { MapViewProvider } from './map-view-context'
import { ZoomControls } from '@wizard-archive/ui/components/zoom/zoom-controls'
import { useDndStore } from '../../drag-drop/store'
import { useMapImageStatus } from './use-map-image-status'
import { useMapSidebarItemDropTarget } from './use-map-sidebar-item-drop-target'
import { MapCanvasStage } from './map-canvas-stage'
import { MapImageContextMenuWrapper } from './map-image-context-menu-wrapper'
import { MapModeBanners } from './map-mode-banners'
import { MapPinContextMenuWrapper } from './map-pin-context-menu-wrapper'
import { MapViewerSkeleton } from './map-viewer-skeleton'
import { MapImageUpload } from './map-image-upload'
import { createBrowserImportFile } from '../../filesystem/browser-import-file'
import { MapLayerSwitcher } from './map-layer-switcher'
import type { MapViewerSource } from './source'
import { useMapPinInteractions } from './use-map-pin-interactions'
import { useMapTransformControls } from './use-map-transform-controls'
import { resolveMapImage, withResolvedMapImage } from '../image-resolution'
import { filterMapPinsForLayer } from '../render-projection'

type MapViewerProps = {
  item: MapItemWithContent
  source: MapViewerSource
}

export function MapViewer({ item: map, source }: MapViewerProps) {
  return useMapViewerElement(map, source)
}

function useMapViewerElement(map: MapItemWithContent, source: MapViewerSource) {
  const imageRef = useRef<HTMLImageElement>(null)
  const pinsContainerRef = useRef<HTMLDivElement>(null)
  const canEditMap = source.canEditMap(map)
  const [hoveredPinId, setHoveredPinId] = useState<MapPinId | null>(null)
  const {
    activeLayerId,
    activeMap,
    activeMapImageAlt,
    activeMapImageUrl,
    mapLayers,
    setSelectedLayerId,
  } = useActiveMapView(map)
  const { imageLoaded, imageError, handleImageLoad, handleImageError } = useMapImageStatus(
    map.id,
    activeMapImageUrl,
  )

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const { mapDragOutcome, mapDropTargetRef } = useMapDropPreview({
    canEditMap,
    map,
  })
  const mapStageRef = useMergedRef(mapContainerRef, mapDropTargetRef)
  const renderPinState = source.resolveRenderPins(map)
  const pins =
    renderPinState.status === 'available'
      ? filterMapPinsForLayer(renderPinState.pins, activeLayerId, mapLayers)
      : []
  const isPinGhost = renderPinState.status === 'available' ? renderPinState.isPinGhost : () => false

  const {
    handleResetTransform,
    handleTransformChange,
    handleZoomIn,
    handleZoomOut,
    savedTransform,
    transformWrapperRef,
  } = useMapTransformControls({
    mapId: map.id,
    pinsContainerRef,
    transformStore: source.transformStore,
  })

  const {
    closePinContextMenu,
    draggingPin,
    handleMapClick,
    handleMapKeyboardAction,
    handleMapPinActionContextMenu,
    handlePinClick,
    handlePinContextMenu,
    handlePinDragStart,
    mapCursor,
    pendingPinItems,
    pendingPinMove,
    pinContextMenu,
    requestPinMove,
    requestPinPlacement,
    shouldDisablePanning,
  } = useMapPinInteractions({
    activeLayerId,
    canEditMap,
    imageError,
    imageRef,
    map,
    pinsContainerRef,
    source,
  })

  const { handleMapCanvasContextMenu, mapImageContextMenuRef } = useMapImageContextMenu({
    canEditMap,
    handleMapPinActionContextMenu,
    pendingPinItems,
  })

  useMapSidebarItemDropTarget({
    canPin: canEditMap,
    createMapPins: source.createMapPins,
    imageRef,
    layerId: activeLayerId,
    map,
  })

  const pinContextMenuPin = pinContextMenu
    ? (pins.find((pin) => pin.id === pinContextMenu.pinId) ?? null)
    : null

  return (
    <ClientOnly fallback={<MapViewerSkeleton />}>
      <MapViewProvider
        canEditMap={canEditMap}
        canViewPinItem={(pin) => source.canViewItem(pin.item)}
        map={map}
        pins={pins}
        pinOperations={source}
        requestPinMove={requestPinMove}
        requestPinPlacement={requestPinPlacement}
      >
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
          <ZoomControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleResetTransform}
            className="absolute top-4 right-4 z-[1000]"
          />
          <MapLayerSwitcher
            layers={mapLayers}
            activeLayerId={activeLayerId}
            onSelectLayer={setSelectedLayerId}
          />

          <MapCanvasStage
            map={activeMap}
            mapContainerRef={mapStageRef}
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
            draggingPinId={draggingPin?.pin.id ?? null}
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
            imageAlt={activeMapImageAlt}
            emptyImageContent={
              canEditMap ? (
                <MapImageUpload
                  onUpload={(file) =>
                    source.updateMapImage({ mapId: map.id, file: createBrowserImportFile(file) })
                  }
                />
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

          {pinContextMenu && pinContextMenuPin && (
            <MapPinContextMenuWrapper
              pin={pinContextMenuPin}
              position={pinContextMenu.position}
              onClose={closePinContextMenu}
            />
          )}

          <MapImageContextMenuWrapper
            contextMenuRef={mapImageContextMenuRef}
            map={map}
            selectedMap={activeMap}
          />
        </div>
      </MapViewProvider>
    </ClientOnly>
  )
}

function useActiveMapView(map: MapItemWithContent) {
  const mapLayers = map.layers ?? []
  const [selectedLayer, setSelectedLayer] = useState<{
    mapId: SidebarItemId
    layerId: string | null
  }>(() => ({
    mapId: map.id,
    layerId: mapLayers[0]?.id ?? null,
  }))
  const selectedLayerId =
    selectedLayer.mapId === map.id ? selectedLayer.layerId : (mapLayers[0]?.id ?? null)
  const setSelectedLayerId = (layerId: string | null) => {
    setSelectedLayer({ mapId: map.id, layerId })
  }
  const activeMapImage = resolveMapImage(map, selectedLayerId)
  const activeLayer = activeMapImage.layer
  const activeLayerId = activeLayer?.id ?? null
  const activeMapImageUrl = activeMapImage.imageUrl
  const activeMap = withResolvedMapImage(map, selectedLayerId)
  const activeMapImageAlt = activeLayer ? `${map.name} - ${activeLayer.name}` : map.name || 'Map'

  return {
    activeLayerId,
    activeMap,
    activeMapImageAlt,
    activeMapImageUrl,
    mapLayers,
    setSelectedLayerId,
  }
}

function useMapDropPreview({ canEditMap, map }: { canEditMap: boolean; map: MapItemWithContent }) {
  const mapDropData = {
    type: MAP_DROP_ZONE_TYPE,
    mapId: map.id,
    mapName: map.name,
    pinnedItemIds: map.pins.map((p) => p.itemId),
  }
  const { dropTargetRef, isDropTarget: isMapDropTarget } = useDndDropTarget({
    data: mapDropData,
    canDrop: canEditMap,
  })
  const mapDragOutcome = useDndStore((s) => (canEditMap && isMapDropTarget ? s.dragOutcome : null))

  return { mapDragOutcome, mapDropTargetRef: dropTargetRef }
}

function useMapImageContextMenu({
  canEditMap,
  handleMapPinActionContextMenu,
  pendingPinItems,
}: {
  canEditMap: boolean
  handleMapPinActionContextMenu: (e: React.MouseEvent) => boolean
  pendingPinItems: ReturnType<typeof useMapPinInteractions>['pendingPinItems']
}) {
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
    if (handleMapPinActionContextMenu(e)) {
      return
    }

    handleMapImageContextMenu(e)
  }

  return {
    handleMapCanvasContextMenu,
    mapImageContextMenuRef,
  }
}
