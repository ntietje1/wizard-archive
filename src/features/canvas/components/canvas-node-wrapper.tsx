import { memo, useEffect, useRef } from 'react'
import { cn } from '~/features/shadcn/lib/utils'
import { CanvasNodeContent } from './canvas-node-content'
import { useCanvasEngine, useCanvasEngineSelector } from '../react/use-canvas-engine'
import { useCanvasRuntime } from '../runtime/providers/canvas-runtime'
import { useIsInteractiveCanvasRenderMode } from '../runtime/providers/use-canvas-render-mode'
import type { CanvasInternalNode } from '../system/canvas-engine'
import type { CanvasNode } from '../types/canvas-domain-types'
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
  onNodeClick?: (event: ReactMouseEvent, node: CanvasNode) => void
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasNode) => void
}) {
  const shell = useCanvasEngineSelector(
    (snapshot) => selectCanvasNodeShellSnapshot(snapshot.nodeLookup.get(nodeId)),
    areCanvasNodeShellSnapshotsEqual,
  )
  const canvasEngine = useCanvasEngine()
  const { canEdit, domRuntime, nodeDragController } = useCanvasRuntime()
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const nodeRef = useRef<HTMLDivElement | null>(null)
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

  useEffect(() => {
    const dragTarget = nodeRef.current
    if (!dragTarget || !canEdit || !interactiveRenderMode || !nodeDragController) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (isNodeDragBlocked(event.target)) {
        return
      }

      nodeDragController.handlePointerDown(nodeId, event)
    }
    const handleMouseDown = (event: MouseEvent) => {
      if (isNodeDragBlocked(event.target)) {
        return
      }

      nodeDragController.handlePointerDown(nodeId, event)
    }
    dragTarget.addEventListener('pointerdown', handlePointerDown, { capture: true })
    if (!window.PointerEvent) {
      dragTarget.addEventListener('mousedown', handleMouseDown, { capture: true })
    }
    return () => {
      dragTarget.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      dragTarget.removeEventListener('mousedown', handleMouseDown, { capture: true })
    }
  }, [canEdit, interactiveRenderMode, nodeDragController, nodeId, shellMounted])

  if (!shell || !shell.visible) {
    return null
  }

  const getCurrentNode = () => canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node ?? null
  const handleNodeKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (event.target !== event.currentTarget && isInteractiveKeyboardTarget(event.target)) {
        return
      }

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

function isInteractiveKeyboardTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        [
          'input',
          'textarea',
          'select',
          'button',
          'a[href]',
          '[contenteditable="true"]',
          '.canvas-rich-text-editor',
        ].join(','),
      ),
    )
  )
}

function isNodeDragBlocked(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(
    target.closest(
      [
        '[data-node-editing="true"]',
        '.canvas-node-resize-handle',
        '[data-canvas-node-handle="true"]',
        'input',
        'textarea',
        'select',
        'button',
        'a[href]',
        '[contenteditable="true"]',
        '.canvas-rich-text-editor',
      ].join(','),
    ),
  )
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
