import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import { CanvasNodeConnectionHandles } from '../shared/canvas-node-connection-handles'
import { getCanvasNodeSurfaceStyle } from '../shared/canvas-node-surface-style'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import type { EmbedNodeData } from './embed-node-data'
import type { Node, NodeProps } from '@xyflow/react'

export function EmbeddedCanvasPreviewNode({ id, data, dragging }: NodeProps<Node<EmbedNodeData>>) {
  const { data: contentItem, isLoading, error } = useSidebarItemById(data.sidebarItemId)

  return (
    <ResizableNodeWrapper
      id={id}
      nodeType="embed"
      dragging={!!dragging}
      minWidth={240}
      minHeight={180}
      chrome={<CanvasNodeConnectionHandles selected={false} preserveAnchors />}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-lg shadow-sm"
        style={getCanvasNodeSurfaceStyle(data)}
      >
        {contentItem ? <SidebarItemPreviewContent item={contentItem} /> : null}
        {!contentItem && isLoading ? (
          <div
            className="flex h-full items-center justify-center opacity-50"
            role="status"
            aria-live="polite"
          >
            <div
              className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
              aria-hidden={true}
            />
            <span className="sr-only">Loading embedded item</span>
          </div>
        ) : null}
        {!contentItem && error ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            Failed to load embedded item
          </div>
        ) : null}
        {!contentItem && !isLoading && !error ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            Embedded item unavailable
          </div>
        ) : null}
      </div>
    </ResizableNodeWrapper>
  )
}
