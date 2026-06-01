import type { Folder } from '../../folders/types'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { SidebarItemShare } from '../../sidebarShares/types'
import type { SidebarItemColor } from '../../../shared/sidebar-items/color'
import type { SidebarItemIconName } from '../../../shared/sidebar-items/icon'
import type { SidebarItemName } from '../../../shared/sidebar-items/name'
import type { SidebarItemSlug } from '../../../shared/sidebar-items/slug'
import type { ConvexValidatorFields } from '../../common/types'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import type {
  SidebarItemLocation,
  SidebarItemStatus,
  SidebarItemType,
} from '../../../shared/sidebar-items/types'

/**
 * Lifecycle visibility for a sidebar item.
 *
 * `location` is retained for future true storage locations; filesystem writes keep it as
 * `sidebar`. Trash visibility is represented by `status: 'trashed'`, with
 * `deletionTime`/`deletedBy` recording the deletion metadata. `undoHidden` is an internal state for
 * rows hidden by local undo while preserving row IDs for deterministic redo.
 */

export function assertSidebarItemType(type: string): SidebarItemType {
  if ((Object.values(SIDEBAR_ITEM_TYPES) as Array<string>).includes(type)) {
    return type as SidebarItemType
  }
  throw new Error(`Invalid sidebar item type: ${type}`)
}

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
  isActive: boolean
  isTrashed: boolean
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
  // Currently only "sidebar"; kept as the future true placement field.
  location: SidebarItemLocation
  status: SidebarItemStatus
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
