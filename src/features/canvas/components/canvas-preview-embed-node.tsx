import { CanvasPreviewNodeFrame } from './canvas-preview-node-frame'
import { EmbeddedSidebarItemUnavailable } from '../nodes/embed/embedded-sidebar-item-unavailable'
import { normalizeEmbedNodeData } from '../nodes/embed/embed-node-data'
import {
  getCanvasNodeSurfaceStyle,
  getCanvasNodeTextStyle,
} from '../nodes/shared/canvas-node-surface-style'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { useSidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { EmbedNodeData } from '../nodes/embed/embed-node-data'

const DEFAULT_EMBED_MIN_WIDTH = 240
const DEFAULT_EMBED_MIN_HEIGHT = 180

export function CanvasPreviewEmbedNode({
  data,
  dragging,
}: CanvasNodeComponentProps<EmbedNodeData>) {
  const normalizedData = normalizeEmbedNodeData(data)
  const contentQuery = useSidebarItemById(normalizedData.sidebarItemId)
  const itemState = useSidebarItemAvailabilityState({
    lookup: { kind: 'id', id: normalizedData.sidebarItemId },
    readableItem: contentQuery.data,
    readableItemLoading: contentQuery.isLoading,
    readableItemError: contentQuery.error,
    canView: contentQuery.data !== undefined,
    subject: 'item',
    fallbackLabel: 'Embedded item',
  })

  return (
    <CanvasPreviewNodeFrame nodeType="embed" dragging={!!dragging}>
      <div
        className="relative h-full w-full overflow-hidden rounded-lg"
        style={{
          ...getCanvasNodeSurfaceStyle(normalizedData),
          ...getCanvasNodeTextStyle(normalizedData),
          minHeight: DEFAULT_EMBED_MIN_HEIGHT,
          minWidth: DEFAULT_EMBED_MIN_WIDTH,
        }}
      >
        {itemState.status === 'available' ? (
          <SidebarItemPreviewContent item={itemState.item} />
        ) : (
          <EmbeddedSidebarItemUnavailable state={itemState} />
        )}
      </div>
    </CanvasPreviewNodeFrame>
  )
}
