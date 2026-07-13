import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { MapPinsLayer } from './map-pins-layer'
import { MapDropFeedbackOverlay } from './map-drop-feedback-overlay'
import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'
import type { MapPinId } from '../../../../../shared/common/ids'
import type { MapItemWithContent, MapPinWithItem } from '../../game-maps/item-contract'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import type { ReactNode, SyntheticEvent } from 'react'
import type { DropOutcome } from '../../drag-drop/outcome'
import type { MapTransformState } from './transform-state'

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
  emptyImageContent,
  imageAlt = map.name || 'Map',
}: {
  map: MapItemWithContent
  mapContainerRef: React.Ref<HTMLDivElement>
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
  hoveredPinId: MapPinId | null
  draggingPinId: MapPinId | null
  moveModePinId: MapPinId | null
  hasPinAction: boolean
  onTransformChange: (
    ref: unknown,
    state: { scale: number; positionX: number; positionY: number },
  ) => void
  onImageLoad: (event: SyntheticEvent<HTMLImageElement>) => void
  onImageError: (event: SyntheticEvent<HTMLImageElement>) => void
  onMapClick: (event: React.MouseEvent) => void
  onMapKeyboardAction: () => void
  onMapCanvasContextMenu: (event: React.MouseEvent) => void
  onPinHover: (pinId: MapPinId | null) => void
  onPinClick: (event: React.MouseEvent | React.KeyboardEvent, pin: MapPinWithItem) => void
  onPinContextMenu: (event: React.MouseEvent | React.KeyboardEvent, pin: MapPinWithItem) => void
  onPinDragStart: (event: React.PointerEvent, pin: MapPinWithItem) => void
  emptyImageContent: ReactNode
  imageAlt?: string
}) {
  const mapPinsLayer = imageLoaded ? (
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
      className={hasPinAction ? 'z-20' : undefined}
    />
  ) : null

  const mapContent = (
    <div className="relative" onContextMenu={hasPinAction ? undefined : onMapCanvasContextMenu}>
      <img
        key={map.imageUrl ?? 'no-image'}
        ref={imageRef}
        src={map.imageUrl ?? undefined}
        alt={imageAlt}
        className="select-none pointer-events-auto"
        draggable={false}
        onLoad={onImageLoad}
        onError={onImageError}
        style={{ cursor: mapCursor, display: 'block' }}
      />

      {hasPinAction && (
        <button
          type="button"
          aria-label="Map canvas"
          className="absolute inset-0 z-10 border-0 bg-transparent p-0 text-left"
          style={{ cursor: mapCursor }}
          onClick={onMapClick}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            onMapKeyboardAction()
          }}
          onContextMenu={onMapCanvasContextMenu}
        />
      )}
      {mapPinsLayer}
    </div>
  )

  return (
    <div ref={mapContainerRef} className="flex-1 relative min-h-0">
      <MapDropFeedbackOverlay outcome={mapDragOutcome} />
      {map.imageUrl && !imageLoaded && !imageError && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}
      {map.imageUrl && imageError ? (
        <div
          role="alert"
          className="flex h-full items-center justify-center text-sm text-muted-foreground"
          onContextMenu={onMapCanvasContextMenu}
        >
          Failed to load map image.
        </div>
      ) : map.imageUrl ? (
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
            {mapContent}
          </TransformComponent>
        </TransformWrapper>
      ) : (
        emptyImageContent
      )}
    </div>
  )
}
