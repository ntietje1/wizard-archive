import { CategoryFolderButton } from '../generic-category-folder/category-folder-button'
import type { TagCategoryConfig } from '~/components/forms/category-tag-dialogs/base-tag-dialog/types'
import { SYSTEM_DEFAULT_CATEGORIES } from 'convex/tags/types'
import { getCategoryIcon } from '~/lib/category-icons'

export const SESSION_CONFIG: TagCategoryConfig = {
  categoryName: SYSTEM_DEFAULT_CATEGORIES.Session.name,
  singular: SYSTEM_DEFAULT_CATEGORIES.Session.displayName,
  plural: SYSTEM_DEFAULT_CATEGORIES.Session.pluralDisplayName,
  icon: getCategoryIcon(SYSTEM_DEFAULT_CATEGORIES.Session.iconName),
}

export const SessionSystemFolder = () => {
  return <CategoryFolderButton categoryConfig={SESSION_CONFIG} />
}
