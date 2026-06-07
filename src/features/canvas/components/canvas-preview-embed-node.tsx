import { CanvasPreviewNodeFrame } from './canvas-preview-node-frame'
import { normalizeEmbedNodeData } from '../nodes/embed/embed-node-data'
import {
  getCanvasNodeSurfaceStyle,
  getCanvasNodeTextStyle,
} from '../nodes/shared/canvas-node-surface-style'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { EmbedContent } from '~/features/embeds/components/embed-content'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { EmbedNodeData } from '../nodes/embed/embed-node-data'
import type { Id } from 'convex/_generated/dataModel'

const DEFAULT_EMBED_MIN_WIDTH = 240
const DEFAULT_EMBED_MIN_HEIGHT = 180

export function CanvasPreviewEmbedNode({
  data,
  dragging,
  sourceItemId = null,
}: CanvasNodeComponentProps<EmbedNodeData> & {
  sourceItemId?: Id<'sidebarItems'> | null
}) {
  const normalizedData = normalizeEmbedNodeData(data)

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
        <EmbedContent
          target={normalizedData.target}
          sourceItemId={sourceItemId}
          mode="readonly"
          renderSidebarItem={(item) => <SidebarItemPreviewContent item={item} />}
        />
      </div>
    </CanvasPreviewNodeFrame>
  )
}
