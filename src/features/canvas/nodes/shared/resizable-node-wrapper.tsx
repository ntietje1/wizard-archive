import { CanvasNodeFrame } from './canvas-node-frame'
import { CanvasNodeResizeHandles } from './canvas-node-resize-handles'
import { useCanvasResizeSession } from './use-canvas-resize-session'

interface ResizableNodeWrapperProps {
  id: string
  nodeType: string
  dragging: boolean
  children: React.ReactNode
  chrome?: React.ReactNode
  minWidth?: number
  minHeight?: number
  editing?: boolean
}

export function ResizableNodeWrapper({
  id,
  nodeType,
  dragging,
  children,
  chrome,
  minWidth = 50,
  minHeight = 30,
  editing = false,
}: ResizableNodeWrapperProps) {
  const resizeHandles = useCanvasResizeSession({
    id,
    dragging,
    minWidth,
    minHeight,
  })

  return (
    <CanvasNodeFrame
      id={id}
      nodeType={nodeType}
      dragging={dragging}
      editing={editing}
      chrome={
        <>
          {chrome}
          {resizeHandles.length > 0 && <CanvasNodeResizeHandles handles={resizeHandles} />}
        </>
      }
    >
      {children}
    </CanvasNodeFrame>
  )
}
