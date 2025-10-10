import type { Id } from 'convex/_generated/dataModel'
import type {
  BaseTagFormValues,
  TagCategoryConfig,
} from '../base-tag-dialog/types'
import { SYSTEM_DEFAULT_CATEGORIES } from 'convex/tags/types'
import { getCategoryIcon } from '~/lib/category-icons'

export interface CharacterFormValues extends BaseTagFormValues {
  playerId?: Id<'campaignMembers'> | ''
}

export const defaultCharacterFormValues: CharacterFormValues = {
  name: '',
  description: '',
  color: '#ef4444',
  playerId: '',
}

export const CHARACTER_CONFIG: TagCategoryConfig = {
  singular: SYSTEM_DEFAULT_CATEGORIES.Character.displayName,
  plural: SYSTEM_DEFAULT_CATEGORIES.Character.pluralDisplayName,
  icon: getCategoryIcon(SYSTEM_DEFAULT_CATEGORIES.Character.iconName),
  categorySlug: SYSTEM_DEFAULT_CATEGORIES.Character.slug,
}