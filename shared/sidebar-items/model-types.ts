import type { PermissionLevel } from '../permissions/types'
import type { SidebarItemColor } from './color'
import type { SidebarItemIconName } from './icon'
import type { SidebarItemName } from './name'
import type { SidebarItemSlug } from './slug'
import type {
  SIDEBAR_ITEM_TYPES,
  SidebarItemLocation,
  SidebarItemStatus,
  SidebarItemType,
} from './types'
import type { CampaignId, SidebarItemId, StorageId, UserProfileId } from '../common/ids'
import type { Canvas, CanvasFromDb, CanvasWithContent } from '../canvases/types'
import type { SidebarFile, FileFromDb, FileWithContent } from '../files/types'
import type { Folder, FolderFromDb, FolderWithContent } from '../folders/types'
import type { GameMap, GameMapFromDb, GameMapWithContent } from '../game-maps/types'
import type { Note, NoteFromDb, NoteWithContent } from '../notes/types'
import type { SidebarItemShare } from '../sidebar-shares/types'

type SidebarItemNormalizedFields = {
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

type SidebarItemRow<T extends SidebarItemType = SidebarItemType> = {
  _id: SidebarItemId
  _creationTime: number
  name: string
  iconName: string | null
  color: string | null
  slug: string
  campaignId: CampaignId
  parentId: SidebarItemId | null
  type: T
  allPermissionLevel: PermissionLevel | null
  location: SidebarItemLocation
  status: SidebarItemStatus
  previewStorageId: StorageId | null
  previewLockedUntil: number | null
  previewClaimToken: string | null
  previewUpdatedAt: number | null
  updatedTime: number | null
  updatedBy: UserProfileId | null
  createdBy: UserProfileId
  deletionTime: number | null
  deletedBy: UserProfileId | null
}

export type SidebarItemFromDb<T extends SidebarItemType = SidebarItemType> = SidebarItemRow<T>

export type SidebarItem<T extends SidebarItemType = SidebarItemType> = EnhanceSidebarItem<
  SidebarItemFromDb<T>
>

type FolderAncestor = SidebarItem<typeof SIDEBAR_ITEM_TYPES.folders> & {
  inheritShares: boolean
}

export type SidebarItemWithContent<T extends SidebarItemType = SidebarItemType> = SidebarItem<T> & {
  ancestors: Array<FolderAncestor>
}

export type SidebarItemTypeKey = keyof typeof SIDEBAR_ITEM_TYPES

type CompleteSidebarItemTypeMap<T extends Record<SidebarItemTypeKey, unknown>> = T

type RowByType = CompleteSidebarItemTypeMap<{
  notes: SidebarItemRow<typeof SIDEBAR_ITEM_TYPES.notes>
  folders: SidebarItemRow<typeof SIDEBAR_ITEM_TYPES.folders>
  gameMaps: SidebarItemRow<typeof SIDEBAR_ITEM_TYPES.gameMaps>
  files: SidebarItemRow<typeof SIDEBAR_ITEM_TYPES.files>
  canvases: SidebarItemRow<typeof SIDEBAR_ITEM_TYPES.canvases>
}>

export type FromDbByType = CompleteSidebarItemTypeMap<{
  notes: NoteFromDb
  folders: FolderFromDb
  gameMaps: GameMapFromDb
  files: FileFromDb
  canvases: CanvasFromDb
}>

type EnhancedByType = CompleteSidebarItemTypeMap<{
  notes: Note
  folders: Folder
  gameMaps: GameMap
  files: SidebarFile
  canvases: Canvas
}>

type WithContentByType = CompleteSidebarItemTypeMap<{
  notes: NoteWithContent
  folders: FolderWithContent
  gameMaps: GameMapWithContent
  files: FileWithContent
  canvases: CanvasWithContent
}>

export type AnySidebarItemRow = RowByType[SidebarItemTypeKey]

export type AnySidebarItemFromDb = FromDbByType[SidebarItemTypeKey]

export type AnySidebarItem = EnhancedByType[SidebarItemTypeKey]

export type AnySidebarItemWithContent = WithContentByType[SidebarItemTypeKey]

export type WithContentBySidebarItemType<T extends SidebarItemType> = Extract<
  AnySidebarItemWithContent,
  { type: T }
>

export type EnhancedSidebarItem<T extends AnySidebarItemFromDb> = Extract<
  EnhancedByType[SidebarItemTypeKey],
  { type: T['type'] }
>

export type WithContentSidebarItem<T extends AnySidebarItem> = Extract<
  WithContentByType[SidebarItemTypeKey],
  { type: T['type'] }
>
