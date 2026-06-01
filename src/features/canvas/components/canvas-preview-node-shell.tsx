import { useEffect, useRef } from 'react'
import {
  areCanvasPreviewNodeShellsEqual,
  selectCanvasPreviewNodeShell,
} from './canvas-read-only-preview-model'
import { readResizeObserverBorderBoxSize } from '../system/canvas-element-size'
import { useCanvasEngine } from '../react/canvas-engine-context-value'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import { cn } from '~/features/shadcn/lib/utils'
import type { CanvasDocumentNode } from '~/features/canvas/domain/validation'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'

export function CanvasPreviewNodeShell({
  children,
  interactive,
  nodeId,
  onNodeContextMenu,
}: {
  children: ReactNode
  interactive: boolean
  nodeId: string
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
}) {
  const shell = useCanvasEngineSelector(
    (snapshot) => selectCanvasPreviewNodeShell(snapshot.nodeLookup.get(nodeId)),
    areCanvasPreviewNodeShellsEqual,
  )
  const canvasEngine = useCanvasEngine()
  const nodeRef = useRef<HTMLDivElement | null>(null)
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
      if (!entry) {
        return
      }

      const size = readResizeObserverBorderBoxSize(entry)
      if (size.width <= 0 || size.height <= 0) {
        return
      }

      canvasEngine.measureNode(shellId, size)
    })
    observer.observe(nodeElement)
    return () => observer.disconnect()
  }, [canvasEngine, shellId])

  if (!shell) {
    return null
  }

  const getCurrentNode = () => canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node ?? null

  return (
    <section
      ref={nodeRef}
      className={cn(
        'canvas-node-shell absolute left-0 top-0 touch-none select-none',
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
        pointerEvents: interactive ? 'auto' : 'none',
      }}
      onContextMenu={(event) => {
        const node = getCurrentNode()
        if (node) {
          onNodeContextMenu(event, node)
        }
      }}
    >
      {children}
    </section>
  )
}
