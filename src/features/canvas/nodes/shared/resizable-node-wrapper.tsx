import { NodeResizeControl } from '@xyflow/react'
import type { ControlPosition, OnResize, OnResizeEnd } from '@xyflow/react'
import { useCanvasRuntimeContext } from '../../hooks/canvas-runtime-context'
import { useShiftKeyPressed } from './useShiftKeyPressed'

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
  selected: boolean
  dragging: boolean
  children: React.ReactNode
  minWidth?: number
  minHeight?: number
  isRectDeselected?: boolean
}

export function ResizableNodeWrapper({
  id,
  selected,
  dragging,
  children,
  minWidth = 50,
  minHeight = 30,
  isRectDeselected = false,
}: ResizableNodeWrapperProps) {
  const { remoteHighlights, nodeActions } = useCanvasRuntimeContext()
  const { onResize, onResizeEnd } = nodeActions
  const highlight = remoteHighlights.get(id)
  const showHandles = selected && !dragging && !isRectDeselected
  const keepAspectRatio = useShiftKeyPressed()

  const handleResize: OnResize = (_event, params) => {
    onResize(id, params.width, params.height, { x: params.x, y: params.y })
  }

  const handleResizeEnd: OnResizeEnd = (_event, params) => {
    onResizeEnd(id, params.width, params.height, { x: params.x, y: params.y })
  }

  return (
    <div className="relative h-full w-full">
      {((selected && !isRectDeselected) || highlight) && (
        <div
          className="absolute -inset-0.5 rounded-sm pointer-events-none"
          style={{
            border: `1px solid ${highlight?.color ?? 'var(--primary)'}`,
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
