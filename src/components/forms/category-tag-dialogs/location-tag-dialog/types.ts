import type {
  BaseTagFormValues,
  TagCategoryConfig,
} from '../base-tag-dialog/types'
import { SYSTEM_DEFAULT_CATEGORIES } from 'convex/tags/types'
import { getCategoryIcon } from '~/lib/category-icons'

export interface LocationFormValues extends BaseTagFormValues {}

export const defaultLocationFormValues: LocationFormValues = {
  name: '',
  description: '',
  color: '#ef4444',
}

export const LOCATION_CONFIG: TagCategoryConfig = {
  singular: SYSTEM_DEFAULT_CATEGORIES.Location.displayName,
  plural: SYSTEM_DEFAULT_CATEGORIES.Location.pluralDisplayName,
  icon: getCategoryIcon(SYSTEM_DEFAULT_CATEGORIES.Location.iconName),
  categoryName: SYSTEM_DEFAULT_CATEGORIES.Location.name,
}
