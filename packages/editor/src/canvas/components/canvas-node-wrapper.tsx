import { useEffect, useRef } from 'react'
import {
  areNullableCanvasSnapshotsEqual,
  resolveCanvasNodeRenderSize,
} from './canvas-renderer-utils'
import { useCanvasEngine } from '../react/canvas-engine-context-value'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import { useCanvasViewportRuntime } from '../runtime/providers/canvas-runtime'
import type { CanvasInternalNode } from '../system/canvas-engine-types'
import type { ReactNode } from 'react'

type CanvasNodeShellSnapshot = {
  id: string
  type: string | undefined
  position: { x: number; y: number }
  width: number | undefined
  height: number | undefined
  zIndex: number
  visible: boolean
}

export function CanvasNodeWrapper({ children, nodeId }: { children: ReactNode; nodeId: string }) {
  const shell = useCanvasEngineSelector(
    (snapshot) => selectCanvasNodeShellSnapshot(snapshot.nodeLookup.get(nodeId)),
    areCanvasNodeShellSnapshotsEqual,
  )
  const canvasEngine = useCanvasEngine()
  const { domRuntime } = useCanvasViewportRuntime()
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const shellId = shell?.id
  const shellVisible = shell?.visible === true

  useEffect(() => {
    if (!shellId || !shellVisible) {
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
  }, [canvasEngine, shellId, shellVisible])

  useEffect(() => {
    if (!shellVisible) {
      return undefined
    }

    return domRuntime.registerNodeElement(nodeId, nodeRef.current)
  }, [domRuntime, nodeId, shellVisible])

  if (!shell || !shell.visible) {
    return null
  }

  return (
    <div
      ref={nodeRef}
      className="canvas-node-shell absolute left-0 top-0 inline-block touch-none select-none"
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
    >
      {children}
    </div>
  )
}

function selectCanvasNodeShellSnapshot(
  internalNode: CanvasInternalNode | undefined,
): CanvasNodeShellSnapshot | null {
  if (!internalNode) {
    return null
  }

  const node = internalNode.node
  const size = resolveCanvasNodeRenderSize(internalNode)
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    width: size.width,
    height: size.height,
    zIndex: internalNode.zIndex,
    visible: internalNode.visible,
  }
}

function areCanvasNodeShellSnapshotsEqual(
  left: CanvasNodeShellSnapshot | null,
  right: CanvasNodeShellSnapshot | null,
) {
  return areNullableCanvasSnapshotsEqual(
    left,
    right,
    (leftSnapshot, rightSnapshot) =>
      leftSnapshot.id === rightSnapshot.id &&
      leftSnapshot.type === rightSnapshot.type &&
      leftSnapshot.position.x === rightSnapshot.position.x &&
      leftSnapshot.position.y === rightSnapshot.position.y &&
      leftSnapshot.width === rightSnapshot.width &&
      leftSnapshot.height === rightSnapshot.height &&
      leftSnapshot.zIndex === rightSnapshot.zIndex &&
      leftSnapshot.visible === rightSnapshot.visible,
  )
}
