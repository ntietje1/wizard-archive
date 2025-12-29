import type { Tag } from 'convex/tags/types'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'

export interface GenericTagFormProps {
  mode: 'create' | 'edit'
  tag: Tag | null
  campaignId: Id<'campaigns'>
  categoryId: Id<'tagCategories'>
  parentId: SidebarItemId | undefined
  isOpen: boolean
  onClose: () => void
}
