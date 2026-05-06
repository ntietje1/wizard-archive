import { CanvasScreenSpaceSvg } from './canvas-screen-space-overlay'
import {
  CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX,
  canvasPointToScreenPoint,
  useCanvasScreenSpaceViewport,
} from './canvas-screen-space-overlay-utils'
import { useCanvasDragSnapOverlayStore } from '../runtime/interaction/canvas-drag-snap-overlay'

export function CanvasDragSnapOverlay() {
  const guides = useCanvasDragSnapOverlayStore((state) => state.guides)
  const viewport = useCanvasScreenSpaceViewport()

  if (guides.length === 0) {
    return null
  }

  return (
    <CanvasScreenSpaceSvg>
      {guides.map((guide) =>
        guide.orientation === 'vertical'
          ? renderGuideLine({
              key: `vertical-${guide.position}-${guide.start}-${guide.end}`,
              start: canvasPointToScreenPoint({ x: guide.position, y: guide.start }, viewport),
              end: canvasPointToScreenPoint({ x: guide.position, y: guide.end }, viewport),
            })
          : renderGuideLine({
              key: `horizontal-${guide.position}-${guide.start}-${guide.end}`,
              start: canvasPointToScreenPoint({ x: guide.start, y: guide.position }, viewport),
              end: canvasPointToScreenPoint({ x: guide.end, y: guide.position }, viewport),
            }),
      )}
    </CanvasScreenSpaceSvg>
  )
}

function renderGuideLine({
  key,
  start,
  end,
}: {
  key: string
  start: { x: number; y: number }
  end: { x: number; y: number }
}) {
  return (
    <line
      key={key}
      data-testid="canvas-drag-snap-guide"
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke="var(--primary)"
      strokeOpacity={0.35}
      strokeWidth={CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX}
    />
  )
}
