import type { Id } from 'convex/_generated/dataModel'
import type {
  BaseTagFormValues,
  TagCategoryConfig,
} from '../base-tag-form/types'
import { SYSTEM_DEFAULT_CATEGORIES } from 'convex/tags/types'
import { getCategoryIcon } from '~/lib/category-icons'

export interface CharacterFormValues extends BaseTagFormValues {
  playerId?: Id<'campaignMembers'>
}

export const defaultCharacterFormValues: CharacterFormValues = {
  name: '',
  description: '',
  color: '#ef4444',
  playerId: undefined,
}

export const CHARACTER_CONFIG: TagCategoryConfig = {
  singular: SYSTEM_DEFAULT_CATEGORIES.Character.name,
  plural: SYSTEM_DEFAULT_CATEGORIES.Character.pluralName,
  icon: getCategoryIcon(SYSTEM_DEFAULT_CATEGORIES.Character.iconName),
  categorySlug: SYSTEM_DEFAULT_CATEGORIES.Character.slug,
}
