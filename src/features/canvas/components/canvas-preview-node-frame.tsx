import type { ReactNode } from 'react'
import type { CanvasDocumentNode } from '~/features/canvas/domain/canvas-document'

export function CanvasPreviewNodeFrame({
  children,
  dragging,
  nodeType,
}: {
  children: ReactNode
  dragging: boolean
  nodeType: CanvasDocumentNode['type']
}) {
  return (
    <div
      className="relative h-full w-full select-none"
      data-testid="canvas-node"
      data-node-type={nodeType}
      data-node-selected="false"
      data-node-visual-selected="false"
      data-node-pending-preview-active="false"
      data-node-pending-selected="false"
      data-node-editing="false"
      data-node-dragging={dragging ? 'true' : 'false'}
    >
      {children}
    </div>
  )
}
