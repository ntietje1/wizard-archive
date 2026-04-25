import { memo, useEffect, useRef } from 'react'
import { cn } from '~/features/shadcn/lib/utils'
import { CanvasNodeContent } from './canvas-node-content'
import { useCanvasEngine, useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { CanvasInternalNode } from '../system/canvas-engine'
import type { Node } from '@xyflow/react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'

type CanvasNodeShellSnapshot = {
  id: string
  type: string | undefined
  className: string | undefined
  position: { x: number; y: number }
  width: number | undefined
  height: number | undefined
  zIndex: number
  visible: boolean
}

export const CanvasNodeWrapper = memo(function CanvasNodeWrapper({
  nodeId,
  onNodeClick,
  onNodeContextMenu,
}: {
  nodeId: string
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void
  onNodeContextMenu: (event: ReactMouseEvent, node: Node) => void
}) {
  const shell = useCanvasEngineSelector(
    (snapshot) => selectCanvasNodeShellSnapshot(snapshot.nodeLookup.get(nodeId)),
    areCanvasNodeShellSnapshotsEqual,
  )
  const canvasEngine = useCanvasEngine()
  const nodeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!shell) {
      return undefined
    }

    const nodeElement = nodeRef.current
    if (!nodeElement || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      if (nodeElement.dataset.canvasCulled === 'true') return
      if (entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return
      canvasEngine.measureNode(shell.id, {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(nodeElement)
    return () => observer.disconnect()
  }, [canvasEngine, shell])

  useEffect(() => canvasEngine.registerNodeElement(nodeId, nodeRef.current), [canvasEngine, nodeId])

  if (!shell || !shell.visible) {
    return null
  }

  const getCurrentNode = () => canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node ?? null
  const handleNodeKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
    }
  }

  return (
    <div
      ref={nodeRef}
      className={cn(
        'canvas-node-shell absolute left-0 top-0 touch-none select-none',
        shell.className,
      )}
      data-node-id={shell.id}
      data-node-type={shell.type}
      role="group"
      aria-label={`${shell.type ?? 'canvas'} node`}
      tabIndex={-1}
      style={{
        contain: 'layout style',
        transform: `translate(${shell.position.x}px, ${shell.position.y}px)`,
        width: shell.width,
        height: shell.height,
        zIndex: shell.zIndex,
        pointerEvents: 'auto',
      }}
      onClick={(event) => {
        const node = getCurrentNode()
        if (node) {
          onNodeClick?.(event, node)
        }
      }}
      onContextMenu={(event) => {
        const node = getCurrentNode()
        if (node) {
          onNodeContextMenu(event, node)
        }
      }}
      onKeyDown={handleNodeKeyDown}
    >
      <CanvasNodeContent nodeId={nodeId} />
    </div>
  )
})

function selectCanvasNodeShellSnapshot(
  internalNode: CanvasInternalNode | undefined,
): CanvasNodeShellSnapshot | null {
  if (!internalNode) {
    return null
  }

  const node = internalNode.node
  return {
    id: node.id,
    type: node.type,
    className: node.className,
    position: node.position,
    width: node.width ?? internalNode.measured.width,
    height: node.height ?? internalNode.measured.height,
    zIndex: internalNode.zIndex,
    visible: internalNode.visible,
  }
}

function areCanvasNodeShellSnapshotsEqual(
  left: CanvasNodeShellSnapshot | null,
  right: CanvasNodeShellSnapshot | null,
) {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }

  return (
    left.id === right.id &&
    left.type === right.type &&
    left.className === right.className &&
    left.position === right.position &&
    left.width === right.width &&
    left.height === right.height &&
    left.zIndex === right.zIndex &&
    left.visible === right.visible
  )
}
