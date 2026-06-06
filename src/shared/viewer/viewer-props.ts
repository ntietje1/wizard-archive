import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'

export interface ViewerProps<T extends AnySidebarItemWithContent> {
  item: T
}
