import { useCanvasNodeVisualSelection } from './use-canvas-node-visual-selection'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasRuntime } from '../../runtime/providers/canvas-runtime'
import {
  CANVAS_SELECTION_CHROME_OUTSET_PX,
  CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'
import { useCanvasEngineSelector } from '../../react/use-canvas-engine'
import type { CanvasEngineSnapshot } from '../../system/canvas-engine'

const CANVAS_NODE_SELECTION_INDICATOR_OPACITY = 0.55
const CANVAS_SELECTION_CHROME_RADIUS_PX = 2

interface CanvasNodeFrameProps {
  id: string
  nodeType: string
  dragging: boolean
  editing?: boolean
  chrome?: React.ReactNode
  children: React.ReactNode
}

export function CanvasNodeFrame({
  id,
  nodeType,
  dragging,
  editing = false,
  chrome,
  children,
}: CanvasNodeFrameProps) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const { remoteHighlights } = useCanvasRuntime()
  const { visuallySelected, pendingPreviewActive, pendingSelected, selected } =
    useCanvasNodeVisualSelection(id)
  const { zoom } = useCanvasScreenSpaceViewport()
  const visualSelectedNodeCount = useCanvasEngineSelector(getVisualSelectedNodeCount)
  const highlight = interactiveRenderMode ? remoteHighlights.get(id) : undefined
  const showSelectionChrome = interactiveRenderMode && Boolean(highlight)
  const showSelectionIndicator =
    interactiveRenderMode &&
    visuallySelected &&
    !highlight &&
    (pendingPreviewActive || dragging || visualSelectedNodeCount > 1)

  return (
    <div
      className="relative h-full w-full select-none"
      data-testid="canvas-node"
      data-node-id={id}
      data-node-type={nodeType}
      data-node-selected={selected ? 'true' : 'false'}
      data-node-visual-selected={visuallySelected ? 'true' : 'false'}
      data-node-pending-preview-active={pendingPreviewActive ? 'true' : 'false'}
      data-node-pending-selected={pendingSelected ? 'true' : 'false'}
      data-node-editing={editing ? 'true' : 'false'}
      data-node-dragging={dragging ? 'true' : 'false'}
    >
      {children}
      {showSelectionChrome && <CanvasSelectionChrome color={highlight?.color} zoom={zoom} />}
      {showSelectionIndicator && <CanvasNodeSelectionIndicator zoom={zoom} />}
      {chrome}
    </div>
  )
}

function CanvasNodeSelectionIndicator({ zoom }: { zoom: number }) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return (
    <div
      data-testid="canvas-node-selection-indicator"
      className="absolute pointer-events-none"
      style={{
        borderColor: 'var(--primary)',
        borderRadius: CANVAS_SELECTION_CHROME_RADIUS_PX / safeZoom,
        borderStyle: 'solid',
        borderWidth: CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX / safeZoom,
        inset: -CANVAS_SELECTION_CHROME_OUTSET_PX / safeZoom,
        opacity: CANVAS_NODE_SELECTION_INDICATOR_OPACITY,
      }}
    />
  )
}

function CanvasSelectionChrome({ color, zoom }: { color: string | undefined; zoom: number }) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return (
    <div
      data-testid="selection-border"
      className="absolute pointer-events-none"
      style={{
        borderColor: color ?? 'var(--primary)',
        borderRadius: CANVAS_SELECTION_CHROME_RADIUS_PX / safeZoom,
        borderStyle: 'solid',
        borderWidth: CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX / safeZoom,
        inset: -CANVAS_SELECTION_CHROME_OUTSET_PX / safeZoom,
        opacity: 1,
      }}
    />
  )
}

function getVisualSelectedNodeCount(snapshot: CanvasEngineSnapshot) {
  const { pendingPreview } = snapshot.selection
  return pendingPreview.kind === 'active'
    ? pendingPreview.nodeIds.size
    : snapshot.selection.nodeIds.size
}
