import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'

export function SidebarItemPreviewRenderer({
  item,
  allowInnerScroll = false,
}: {
  item: AnySidebarItemWithContent
  allowInnerScroll?: boolean
}) {
  return (
    <SidebarItemPreviewContent
      item={item}
      allowInnerScroll={allowInnerScroll}
      fillAvailableHeight
    />
  )
}
