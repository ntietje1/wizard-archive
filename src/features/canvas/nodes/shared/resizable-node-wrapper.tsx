import { NodeResizeControl } from '@xyflow/react'
import type { ControlPosition, OnResize, OnResizeEnd } from '@xyflow/react'
import {
  useCanvasNodeActionsContext,
  useCanvasRemoteHighlightsContext,
} from '../../runtime/providers/canvas-runtime-context'
import { useCanvasNodeVisualSelection } from './use-canvas-node-visual-selection'
import { useShiftKeyPressed } from './use-shift-key-pressed'

const HANDLE_SIZE = 4

const CORNERS: Array<{
  position: ControlPosition
  style: React.CSSProperties
}> = [
  {
    position: 'top-left',
    style: { left: -HANDLE_SIZE / 2 + 1, top: -HANDLE_SIZE / 2 + 1 },
  },
  {
    position: 'top-right',
    style: { right: -HANDLE_SIZE / 2 + 1, top: -HANDLE_SIZE / 2 + 1 },
  },
  {
    position: 'bottom-left',
    style: { left: -HANDLE_SIZE / 2 + 1, bottom: -HANDLE_SIZE / 2 + 1 },
  },
  {
    position: 'bottom-right',
    style: { right: -HANDLE_SIZE / 2 + 1, bottom: -HANDLE_SIZE / 2 + 1 },
  },
]

const CONTROL_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  zIndex: 10,
}

interface ResizableNodeWrapperProps {
  id: string
  nodeType: string
  selected: boolean
  dragging: boolean
  children: React.ReactNode
  minWidth?: number
  minHeight?: number
}

export function ResizableNodeWrapper({
  id,
  nodeType,
  selected,
  dragging,
  children,
  minWidth = 50,
  minHeight = 30,
}: ResizableNodeWrapperProps) {
  const remoteHighlights = useCanvasRemoteHighlightsContext()
  const { onResize, onResizeEnd } = useCanvasNodeActionsContext()
  const { visuallySelected, pendingPreviewActive, pendingSelected } = useCanvasNodeVisualSelection(
    id,
    selected,
  )
  const highlight = remoteHighlights.get(id)
  const showHandles = selected && !dragging
  const keepAspectRatio = useShiftKeyPressed()

  const handleResize: OnResize = (_event, params) => {
    onResize(id, params.width, params.height, { x: params.x, y: params.y })
  }

  const handleResizeEnd: OnResizeEnd = (_event, params) => {
    onResizeEnd(id, params.width, params.height, { x: params.x, y: params.y })
  }

  return (
    <div
      className="relative h-full w-full"
      data-testid="canvas-node"
      data-node-id={id}
      data-node-type={nodeType}
      data-node-selected={selected ? 'true' : 'false'}
      data-node-visual-selected={visuallySelected ? 'true' : 'false'}
      data-node-pending-preview-active={pendingPreviewActive ? 'true' : 'false'}
      data-node-pending-selected={pendingSelected ? 'true' : 'false'}
    >
      {(visuallySelected || highlight) && (
        <div
          className="absolute -inset-0.5 rounded-sm pointer-events-none"
          style={{
            border: `1px solid ${highlight?.color ?? 'var(--primary)'}`,
            borderStyle: !highlight && pendingPreviewActive ? 'dashed' : 'solid',
            opacity: !highlight && pendingPreviewActive ? 0.85 : 1,
          }}
        />
      )}

      {showHandles &&
        CORNERS.map(({ position, style }) => (
          <NodeResizeControl
            key={position}
            position={position}
            style={CONTROL_STYLE}
            minWidth={minWidth}
            minHeight={minHeight}
            keepAspectRatio={keepAspectRatio}
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
          >
            <div
              data-testid={`canvas-node-resize-handle-${position}`}
              data-resize-handle-position={position}
              style={{
                position: 'absolute',
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                ...style,
              }}
              className="bg-background border border-primary rounded-[1px]"
            />
          </NodeResizeControl>
        ))}

      {children}
    </div>
  )
}
