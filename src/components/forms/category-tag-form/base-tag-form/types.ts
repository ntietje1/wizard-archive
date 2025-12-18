import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { Tag } from 'convex/tags/types'
import type { LucideIcon } from '~/lib/icons'

export const MAX_NAME_LENGTH = 50
export const MAX_DESCRIPTION_LENGTH = 1000

export interface TagCategoryConfig {
  singular: string
  plural: string
  icon: LucideIcon
  categorySlug: string
}

export interface BaseTagFormValues {
  name: string
  description: string
  color: string | null
}

export const defaultBaseFormValues: BaseTagFormValues = {
  name: '',
  description: '',
  color: null,
}

interface TagDialogBaseProps {
  isOpen: boolean
  onClose: () => void
  config: TagCategoryConfig
  parentId?: SidebarItemId
}

export type TagDialogProps<T extends Tag = Tag> =
  | (TagDialogBaseProps & {
      mode: 'create'
    })
  | (TagDialogBaseProps & {
      mode: 'edit'
      tag: T
    })
