import { CanvasPreviewNodeFrame } from './canvas-preview-node-frame'
import { normalizeEmbedNodeData } from '../nodes/embed/embed-node-data'
import {
  getCanvasNodeSurfaceStyle,
  getCanvasNodeTextStyle,
} from '../nodes/shared/canvas-node-surface-style'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { EmbedContent } from '~/features/embeds/components/embed-content'
import { useEmbedSidebarItemResolver } from '~/features/embeds/context/embed-sidebar-item-resolution'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { EmbedNodeData } from '../nodes/embed/embed-node-data'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'

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
  const SidebarItemResolver = useEmbedSidebarItemResolver()

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
        <SidebarItemResolver target={normalizedData.target}>
          {(itemState) => (
            <EmbedContent
              target={normalizedData.target}
              sourceItemId={sourceItemId}
              mode="readonly"
              SidebarItemRenderer={SidebarItemPreviewRenderer}
              resolvedSidebarItemState={itemState}
            />
          )}
        </SidebarItemResolver>
      </div>
    </CanvasPreviewNodeFrame>
  )
}

function SidebarItemPreviewRenderer({ item }: { item: AnySidebarItemWithContent }) {
  return <SidebarItemPreviewContent item={item} />
}
