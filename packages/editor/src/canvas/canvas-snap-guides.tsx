import type { CanvasInteractionSnapshot } from './interaction-controller'

export function CanvasSnapGuides({ interaction }: { interaction: CanvasInteractionSnapshot }) {
  const active = interaction.interaction
  const guides = active.type === 'dragging' || active.type === 'resizing' ? active.guides : []
  if (guides.length === 0) return null
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-[2147483645] overflow-visible"
      width="1"
      height="1"
    >
      {guides.map((guide) => (
        <line
          key={`${guide.orientation}-${guide.position}-${guide.start}-${guide.end}`}
          data-testid="canvas-drag-snap-guide"
          x1={guide.orientation === 'vertical' ? guide.position : guide.start}
          y1={guide.orientation === 'vertical' ? guide.start : guide.position}
          x2={guide.orientation === 'vertical' ? guide.position : guide.end}
          y2={guide.orientation === 'vertical' ? guide.end : guide.position}
          stroke="var(--canvas-snap-guide)"
          strokeOpacity="var(--canvas-snap-guide-opacity)"
          strokeWidth={1.5 / interaction.viewport.zoom}
        />
      ))}
    </svg>
  )
}
