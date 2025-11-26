import type { Tag, TagCategory } from 'convex/tags/types'
import { getCategoryIcon } from '~/lib/category-icons'
import type { TagCategoryConfig } from '../base-tag-form/types'
import type { Id } from 'convex/_generated/dataModel'

export interface GenericTagFormProps {
  mode: 'create' | 'edit'
  tag?: Tag
  config: TagCategoryConfig
  parentId?: Id<'notes'>
  isOpen: boolean
  onClose: () => void
}

export const createConfig = (category: TagCategory): TagCategoryConfig => {
  return {
    singular: category.displayName,
    plural: category.pluralDisplayName,
    icon: getCategoryIcon(category.iconName),
    categorySlug: category.slug,
  }
}
