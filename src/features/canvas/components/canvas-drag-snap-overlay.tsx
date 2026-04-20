import { useCanvasDragSnapOverlayStore } from '../runtime/interaction/canvas-drag-snap-overlay'

export function CanvasDragSnapOverlay() {
  const guides = useCanvasDragSnapOverlayStore((state) => state.guides)

  if (guides.length === 0) {
    return null
  }

  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {guides.map((guide) =>
        guide.orientation === 'vertical' ? (
          <line
            key={`vertical-${guide.position}-${guide.start}-${guide.end}`}
            x1={guide.position}
            x2={guide.position}
            y1={guide.start}
            y2={guide.end}
            stroke="var(--primary)"
            strokeOpacity={0.35}
            strokeWidth={1}
          />
        ) : (
          <line
            key={`horizontal-${guide.position}-${guide.start}-${guide.end}`}
            x1={guide.start}
            x2={guide.end}
            y1={guide.position}
            y2={guide.position}
            stroke="var(--primary)"
            strokeOpacity={0.35}
            strokeWidth={1}
          />
        ),
      )}
    </svg>
  )
}
