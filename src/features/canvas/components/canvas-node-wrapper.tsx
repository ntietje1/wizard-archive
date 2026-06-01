import { useEffect, useRef } from 'react'
import { cn } from '~/features/shadcn/lib/utils'
import { useCanvasEngine } from '../react/canvas-engine-context-value'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import { isCanvasInteractiveKeyboardTarget } from '../runtime/interaction/canvas-keyboard-targets'
import { useCanvasViewportRuntime } from '../runtime/providers/canvas-runtime'
import type { CanvasInternalNode } from '../system/canvas-engine-types'
import type { CanvasDocumentNode } from '~/features/canvas/domain/validation'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react'

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

function handleCanvasNodeKeyDown(event: ReactKeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }
  if (event.target !== event.currentTarget && isCanvasInteractiveKeyboardTarget(event.target)) {
    return
  }

  event.preventDefault()
}

export function CanvasNodeWrapper({
  children,
  nodeId,
  onNodeClick,
  onNodeContextMenu,
}: {
  children: ReactNode
  nodeId: string
  onNodeClick?: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
}) {
  const shell = useCanvasEngineSelector(
    (snapshot) => selectCanvasNodeShellSnapshot(snapshot.nodeLookup.get(nodeId)),
    areCanvasNodeShellSnapshotsEqual,
  )
  const canvasEngine = useCanvasEngine()
  const { domRuntime } = useCanvasViewportRuntime()
  const nodeRef = useRef<HTMLButtonElement | null>(null)
  const shellMounted = shell !== null
  const shellId = shell?.id

  useEffect(() => {
    if (!shellId) {
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
      canvasEngine.measureNode(shellId, {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(nodeElement)
    return () => observer.disconnect()
  }, [canvasEngine, shellId])

  useEffect(
    () => domRuntime.registerNodeElement(nodeId, nodeRef.current),
    [domRuntime, nodeId, shellMounted],
  )

  if (!shell || !shell.visible) {
    return null
  }

  const getCurrentNode = () => canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node ?? null
  return (
    <button
      type="button"
      ref={nodeRef}
      className={cn(
        'canvas-node-shell absolute left-0 top-0 touch-none select-none appearance-none border-0 bg-transparent p-0 text-inherit',
        shell.className,
      )}
      data-node-id={shell.id}
      data-node-type={shell.type}
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
      onKeyDown={handleCanvasNodeKeyDown}
    >
      {children}
    </button>
  )
}

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
    left.position.x === right.position.x &&
    left.position.y === right.position.y &&
    left.width === right.width &&
    left.height === right.height &&
    left.zIndex === right.zIndex &&
    left.visible === right.visible
  )
}
