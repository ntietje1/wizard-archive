import { useLayoutEffect, useRef } from 'react'
import type * as Y from 'yjs'
import { canvasEdgePath } from './canvas-edge-geometry'
import { fitCanvasContent, canvasNodeSize } from './canvas-layout'
import { CanvasNodeVisual } from './canvas-node-visual'
import { parseCanvasDocumentContent } from './document-contract'
import type { CanvasDocumentNode } from './document-contract'
import type { CanvasNodeId } from '../resources/domain-id'

const ignore = () => {}

export function CanvasReadonlyPreview({ document }: { document: Y.Doc }) {
  const surface = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const content = parseCanvasDocumentContent(document)

  useLayoutEffect(() => {
    const surfaceElement = surface.current
    const viewportElement = viewport.current
    if (!surfaceElement || !viewportElement || !content) return
    const update = () => {
      const bounds = surfaceElement.getBoundingClientRect()
      const fitted = fitCanvasContent(content.nodes, bounds.width, bounds.height)
      viewportElement.style.transform = fitted
        ? `translate(${fitted.x}px, ${fitted.y}px) scale(${fitted.zoom})`
        : ''
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(surfaceElement)
    return () => observer.disconnect()
  }, [content])

  if (!content) return <span className="text-xs text-muted-foreground">Preview unavailable</span>
  const nodes = content.nodes.map((node, index) => ({
    ...node,
    zIndex: node.zIndex ?? index + 1,
  }))
  const nodeById = new Map<CanvasNodeId, CanvasDocumentNode>(nodes.map((node) => [node.id, node]))

  return (
    <div
      ref={surface}
      aria-label="Canvas preview"
      className="pointer-events-none relative size-full min-h-0 min-w-0 overflow-hidden bg-background"
      data-testid="canvas-readonly-preview"
    >
      <div ref={viewport} className="absolute left-0 top-0 size-0 origin-top-left">
        {content.edges.map((edge) => {
          if (edge.hidden) return null
          const path = canvasEdgePath(edge, nodeById)
          if (!path) return null
          return (
            <svg
              key={edge.id}
              className="absolute left-0 top-0 overflow-visible"
              style={{ zIndex: edge.zIndex ?? 0 }}
              width="1"
              height="1"
            >
              <path
                d={path}
                fill="none"
                stroke={edge.style?.stroke ?? 'var(--foreground)'}
                strokeOpacity={edge.style?.opacity ?? 0.75}
                strokeWidth={edge.style?.strokeWidth ?? 2}
              />
            </svg>
          )
        })}
        {nodes.map((node) => {
          if (node.hidden) return null
          const size = canvasNodeSize(node)
          return (
            <div
              key={node.id}
              className="absolute rounded-md"
              data-node-id={node.id}
              data-node-type={node.type}
              data-testid="canvas-preview-node"
              style={{
                width: size.width,
                height: size.height,
                transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                zIndex: node.zIndex ?? 0,
              }}
            >
              <CanvasNodeVisual
                editing={false}
                node={node}
                onFinishEditing={ignore}
                onSaveContent={ignore}
                selected={false}
                zoom={1}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
