import type { Tag, TagCategory } from 'convex/tags/types'
import { getCategoryIcon } from '~/lib/category-icons'
import type { TagCategoryConfig } from '../base-tag-form/types'
import type { SidebarItemId } from 'convex/sidebarItems/types'

export interface GenericTagFormProps {
  mode: 'create' | 'edit'
  tag?: Tag
  config: TagCategoryConfig
  parentId?: SidebarItemId
  isOpen: boolean
  onClose: () => void
}

export const createConfig = (category: TagCategory): TagCategoryConfig => {
  return {
    singular: category.name || '',
    plural: category.name || '',
    icon: getCategoryIcon(category.iconName),
    categorySlug: category.slug,
  }
}
