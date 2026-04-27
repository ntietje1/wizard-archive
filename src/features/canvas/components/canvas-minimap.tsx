import { useCanvasEngineSelector } from '../react/use-canvas-engine'

const MINIMAP_SCALE = 40
const MINIMAP_OFFSET_PERCENT = 48
const MINIMAP_MAX_PERCENT = 96
const MINIMAP_NODE_LIMIT = 250

export function CanvasMiniMap() {
  const nodes = useCanvasEngineSelector((snapshot) => snapshot.nodes)
  if (nodes.length === 0) {
    return null
  }

  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 h-28 w-40 overflow-hidden rounded border bg-background/80 shadow-sm backdrop-blur"
      data-testid="canvas-minimap"
      aria-hidden="true"
    >
      {nodes.slice(0, MINIMAP_NODE_LIMIT).map((node) => (
        <div
          key={node.id}
          className="absolute rounded-sm bg-muted-foreground/45"
          style={{
            left: `${Math.max(
              0,
              Math.min(
                MINIMAP_MAX_PERCENT,
                node.position.x / MINIMAP_SCALE + MINIMAP_OFFSET_PERCENT,
              ),
            )}%`,
            top: `${Math.max(
              0,
              Math.min(
                MINIMAP_MAX_PERCENT,
                node.position.y / MINIMAP_SCALE + MINIMAP_OFFSET_PERCENT,
              ),
            )}%`,
            width: 4,
            height: 4,
          }}
        />
      ))}
    </div>
  )
}
