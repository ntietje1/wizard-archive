import { CanvasPreviewNodeFrame } from './canvas-preview-node-frame'
import { normalizeStrokeNodeData } from '../nodes/stroke/stroke-node-model'
import { StrokeVisual } from '../nodes/stroke/stroke-node'
import { resolveCanvasScreenMinimumStrokeWidth } from '../utils/canvas-screen-stroke-width'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { StrokeNodeData } from '../nodes/stroke/stroke-node-model'

export function CanvasPreviewStrokeNode({
  id,
  data,
  dragging,
  width,
  height,
}: CanvasNodeComponentProps<StrokeNodeData>) {
  const normalizedData = normalizeStrokeNodeData(data)
  const detailSize = resolveCanvasScreenMinimumStrokeWidth(normalizedData.size, 1)

  return (
    <CanvasPreviewNodeFrame nodeType="stroke" dragging={!!dragging}>
      <StrokeVisual
        id={id}
        data={normalizedData}
        width={width}
        height={height}
        detailSize={detailSize}
        highlightD={null}
      />
    </CanvasPreviewNodeFrame>
  )
}
