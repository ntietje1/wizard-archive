import { CanvasSelectionBoundsOverlay } from './canvas-selection-bounds-overlay'
import { useCanvasResizeSession } from '../nodes/shared/use-canvas-resize-session'
import type { CanvasSelectionResizeZoneDescriptor } from '../nodes/shared/use-canvas-resize-session'

export function CanvasSelectionResizeOverlay() {
  const resizeSession = useCanvasResizeSession()

  if (!resizeSession) {
    return null
  }

  const { bounds, zones } = resizeSession

  return (
    <CanvasSelectionBoundsOverlay bounds={bounds} testIdPrefix="canvas-selection-resize">
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
      {zones.map(({ position, cursorClassName, onPointerDown, style }) => (
        <button
          key={position}
          type="button"
          aria-label={`Resize ${position} selection edge`}
          data-testid={`canvas-selection-resize-zone-${position}`}
          data-resize-zone-position={position}
          className={`canvas-selection-resize-zone nodrag nopan pointer-events-auto absolute border-none bg-transparent p-0 touch-none z-[2] ${cursorClassName}`}
          style={style}
          onPointerDown={onPointerDown}
        />
      ))}
    </>
  )
}
