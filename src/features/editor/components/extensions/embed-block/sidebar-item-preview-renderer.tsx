import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { FileMediaEmbedContent } from '~/features/previews/components/file-media-embed-content'
import type { EmbedMediaLayoutReporter } from '~/features/embeds/utils/embed-media'

type SidebarItemPreviewRendererProps = {
  item: AnySidebarItemWithContent
  allowInnerScroll?: boolean
  onMediaLayout?: EmbedMediaLayoutReporter
}

export function SidebarItemPreviewRenderer({
  item,
  allowInnerScroll = false,
  onMediaLayout,
}: SidebarItemPreviewRendererProps) {
  if (item.type === SIDEBAR_ITEM_TYPES.files) {
    return (
      <FileMediaEmbedContent
        downloadUrl={item.downloadUrl}
        contentType={item.contentType}
        previewUrl={item.previewUrl}
        name={item.name}
        allowInnerScroll={allowInnerScroll}
        onMediaLayout={onMediaLayout}
      />
    )
  }

  return (
    <SidebarItemPreviewContent
      item={item}
      allowInnerScroll={allowInnerScroll}
      fillAvailableHeight
    />
  )
}
