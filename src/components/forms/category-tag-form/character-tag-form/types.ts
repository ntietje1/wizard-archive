import type { Id } from 'convex/_generated/dataModel'
import type { BaseTagFormValues } from '../base-tag-form/types'
import type { Character } from 'convex/characters/types'
import type { SidebarItemId } from 'convex/sidebarItems/types'

export interface CharacterFormValues extends BaseTagFormValues {
  playerId?: Id<'campaignMembers'>
}

export const defaultCharacterFormValues: CharacterFormValues = {
  name: '',
  description: '',
  color: '#ef4444',
  playerId: undefined,
}
export interface CharacterTagFormProps {
  mode: 'create' | 'edit'
  character: Character | null
  campaignId: Id<'campaigns'>
  categoryId: Id<'tagCategories'>
  parentId: SidebarItemId | undefined
  isOpen: boolean
  onClose: () => void
}
