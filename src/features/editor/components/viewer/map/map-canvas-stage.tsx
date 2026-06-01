import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { MapPinsLayer } from './map-pins-layer'
import { MapDropFeedbackOverlay } from './map-drop-feedback-overlay'
import { MapImageUpload } from './map-image-upload'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import type { Id } from 'convex/_generated/dataModel'
import type { GameMapWithContent, MapPinWithItem } from 'convex/gameMaps/types'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import type { DropOutcome } from '~/features/dnd/utils/drop-outcome'

export function MapCanvasStage({
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
  savedTransform: { scale: number; positionX: number; positionY: number }
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
  const mapContent = (
    <>
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
    </>
  )

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
            {hasPinAction ? (
              <button
                type="button"
                aria-label="Map canvas"
                className="relative border-0 bg-transparent p-0 text-left"
                onClick={onMapClick}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onMapKeyboardAction()
                }}
                onContextMenu={onMapCanvasContextMenu}
              >
                {mapContent}
              </button>
            ) : (
              <div
                role="application"
                aria-label="Map canvas"
                className="relative"
                onContextMenu={onMapCanvasContextMenu}
              >
                {mapContent}
              </div>
            )}
          </TransformComponent>
        </TransformWrapper>
      ) : (
        <MapImageUpload mapId={map._id} />
      )}
    </div>
  )
}
