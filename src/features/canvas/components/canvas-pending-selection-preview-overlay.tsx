import { CanvasSelectionBoundsOverlay } from './canvas-selection-bounds-overlay'
import { getCanvasNodeBounds } from '../nodes/shared/canvas-node-bounds'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import { useIsInteractiveCanvasRenderMode } from '../runtime/providers/use-canvas-render-mode'
import type { CanvasEngineSnapshot } from '../system/canvas-engine-types'
import { boundsUnion } from '../utils/canvas-geometry-utils'
import type { Bounds } from '../utils/canvas-geometry-utils'

export function CanvasPendingSelectionPreviewOverlay() {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const bounds = useCanvasEngineSelector(getPendingSelectionPreviewBounds, areBoundsEqual)

  if (!interactiveRenderMode || !bounds) {
    return null
  }

  return (
    <CanvasSelectionBoundsOverlay bounds={bounds} testIdPrefix="canvas-pending-selection-preview" />
  )
}

function getPendingSelectionPreviewBounds(snapshot: CanvasEngineSnapshot): Bounds | null {
  const { pendingPreview } = snapshot.selection
  if (pendingPreview.kind !== 'active' || pendingPreview.nodeIds.size === 0) {
    return null
  }

  const nodeBounds = Array.from(pendingPreview.nodeIds).flatMap((nodeId) => {
    const node = snapshot.nodeLookup.get(nodeId)?.node
    const bounds = node ? getCanvasNodeBounds(node) : null
    return bounds ? [bounds] : []
  })

  return boundsUnion(nodeBounds)
}

function areBoundsEqual(left: Bounds | null, right: Bounds | null) {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  )
}
