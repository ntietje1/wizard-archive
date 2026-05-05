import { CanvasNodeFrame } from './canvas-node-frame'
import { CANVAS_NODE_MIN_SIZE } from './canvas-node-resize-constants'
import { useRegisterCanvasNodeResizeMetadata } from './canvas-node-resize-metadata'

interface ResizableNodeWrapperProps {
  id: string
  nodeType: string
  dragging: boolean
  children: React.ReactNode
  chrome?: React.ReactNode
  minWidth?: number
  minHeight?: number
  lockedAspectRatio?: number
  editing?: boolean
}

export function ResizableNodeWrapper({
  id,
  nodeType,
  dragging,
  children,
  chrome,
  minWidth = CANVAS_NODE_MIN_SIZE,
  minHeight = CANVAS_NODE_MIN_SIZE,
  lockedAspectRatio,
  editing = false,
}: ResizableNodeWrapperProps) {
  useRegisterCanvasNodeResizeMetadata(id, {
    dragging,
    lockedAspectRatio,
    minHeight,
    minWidth,
  })

  return (
    <CanvasNodeFrame
      id={id}
      nodeType={nodeType}
      dragging={dragging}
      editing={editing}
      chrome={chrome}
    >
      {children}
    </CanvasNodeFrame>
  )
}
