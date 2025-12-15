import { SYSTEM_DEFAULT_CATEGORIES } from 'convex/tags/types'
import { getCategoryIcon } from '~/lib/category-icons'
import type { TagCategoryConfig } from '../base-tag-form/types'

export const SESSION_CONFIG: TagCategoryConfig = {
  categorySlug: SYSTEM_DEFAULT_CATEGORIES.Session.slug,
  singular: SYSTEM_DEFAULT_CATEGORIES.Session.name,
  plural: SYSTEM_DEFAULT_CATEGORIES.Session.name,
  icon: getCategoryIcon(SYSTEM_DEFAULT_CATEGORIES.Session.iconName),
}
