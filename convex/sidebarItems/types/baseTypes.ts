import type { Folder } from '../../folders/types'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../permissions/types'
import type { SidebarItemShare } from '../../sidebarShares/types'
import type { SidebarItemColor } from '../validation/color'
import type { SidebarItemIconName } from '../validation/icon'
import type { SidebarItemName } from '../validation/name'
import type { SidebarItemSlug } from '../validation/slug'
import type { ConvexValidatorFields } from '../../common/types'

export const SIDEBAR_ITEM_LOCATION = {
  sidebar: 'sidebar',
  trash: 'trash',
} as const

export type SidebarItemLocation = (typeof SIDEBAR_ITEM_LOCATION)[keyof typeof SIDEBAR_ITEM_LOCATION]

export const SIDEBAR_ITEM_TYPES = {
  notes: 'note',
  folders: 'folder',
  gameMaps: 'gameMap',
  files: 'file',
  canvases: 'canvas',
} as const

export type SidebarItemType = (typeof SIDEBAR_ITEM_TYPES)[keyof typeof SIDEBAR_ITEM_TYPES]

export type SidebarItemNormalizedFields = {
  name: SidebarItemName
  iconName: SidebarItemIconName | null
  color: SidebarItemColor | null
  slug: SidebarItemSlug
}

type SidebarItemPersistedStringFields = {
  name: string
  iconName: string | null
  color: string | null
  slug: string
}

type SidebarItemEnhancementFields = {
  shares: Array<SidebarItemShare>
  isBookmarked: boolean
  myPermissionLevel: PermissionLevel
  previewUrl: string | null
}

export type NormalizeSidebarItem<T extends SidebarItemPersistedStringFields> = Omit<
  T,
  keyof SidebarItemNormalizedFields
> &
  SidebarItemNormalizedFields

export type EnhanceSidebarItem<T extends SidebarItemPersistedStringFields> =
  NormalizeSidebarItem<T> & SidebarItemEnhancementFields

export type SidebarItemRow<T extends SidebarItemType> = ConvexValidatorFields<'sidebarItems'> & {
  name: string
  iconName: string | null
  color: string | null
  slug: string
  campaignId: Id<'campaigns'>
  parentId: Id<'sidebarItems'> | null
  type: T
  allPermissionLevel: PermissionLevel | null
  location: SidebarItemLocation
  previewStorageId: Id<'_storage'> | null
  previewLockedUntil: number | null
  previewClaimToken: string | null
  previewUpdatedAt: number | null
  updatedTime: number | null
  updatedBy: Id<'userProfiles'> | null
  createdBy: Id<'userProfiles'>
  deletionTime: number | null
  deletedBy: Id<'userProfiles'> | null
}

export type SidebarItemFromDb<T extends SidebarItemType> = SidebarItemRow<T>

export type SidebarItem<T extends SidebarItemType> = EnhanceSidebarItem<SidebarItemFromDb<T>>

export type SidebarItemWithContent<T extends SidebarItemType> = SidebarItem<T> & {
  ancestors: Array<Folder>
}
