import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'

export function SidebarItemPreviewRenderer({ item }: { item: AnySidebarItemWithContent }) {
  return <SidebarItemPreviewContent item={item} />
}
