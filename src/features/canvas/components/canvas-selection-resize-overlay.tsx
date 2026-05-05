import { CanvasSelectionBoundsOverlay } from './canvas-selection-bounds-overlay'
import { useCanvasResizeSession } from '../nodes/shared/use-canvas-resize-session'
import type { CanvasSelectionResizeZoneDescriptor } from '../nodes/shared/use-canvas-resize-session'

export function CanvasSelectionResizeOverlay() {
  const resizeSession = useCanvasResizeSession()

  if (!resizeSession) {
    return null
  }

  const { bounds, overlayRef, zones } = resizeSession

  return (
    <CanvasSelectionBoundsOverlay
      bounds={bounds}
      testIdPrefix="canvas-selection-resize"
      wrapperRef={overlayRef}
    >
      <CanvasSelectionResizeZones zones={zones} />
    </CanvasSelectionBoundsOverlay>
  )
}

function CanvasSelectionResizeZones({
  zones,
}: {
  zones: ReadonlyArray<CanvasSelectionResizeZoneDescriptor>
}) {
  return (
    <>
      {zones.map(({ position, cursorClassName, onPointerDown, style }) => {
        const handleKind = position.includes('-') ? 'corner' : 'edge'

        return (
          <button
            key={position}
            type="button"
            aria-label={`Resize ${position} selection ${handleKind}`}
            tabIndex={-1}
            data-testid={`canvas-selection-resize-zone-${position}`}
            data-resize-zone-position={position}
            className={`canvas-selection-resize-zone nodrag nopan pointer-events-auto absolute border-none bg-transparent p-0 touch-none z-[2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 ${cursorClassName}`}
            style={style}
            onPointerDown={onPointerDown}
          />
        )
      })}
    </>
  )
}
