import type { CustomBlock } from './editorSpecs'
import type {
  SIDEBAR_ITEM_TYPES,
  SidebarItem,
  SidebarItemFromDb,
  SidebarItemWithContent,
} from '../sidebarItems/types/baseTypes'
import type { PermissionLevel } from '../permissions/types'
import type { ShareStatus } from '../blockShares/types'
import type { Id } from '../_generated/dataModel'

export type NoteFromDb = SidebarItemFromDb<typeof SIDEBAR_ITEM_TYPES.notes>

export type Note = SidebarItem<typeof SIDEBAR_ITEM_TYPES.notes>

export type BlockMeta = {
  myPermissionLevel: PermissionLevel
  shareStatus: ShareStatus
  sharedWith: Array<Id<'campaignMembers'>>
}

export type NoteWithContent = SidebarItemWithContent<
  typeof SIDEBAR_ITEM_TYPES.notes
> & {
  content: Array<CustomBlock>
  blockMeta: Record<string, BlockMeta>
}

export const NOTE_SNAPSHOT_TYPE = 'yjs_state' as const

export const NOTE_HISTORY_ACTION = {} as const

export type NoteHistoryMetadataMap = {}
