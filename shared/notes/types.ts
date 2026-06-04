import type { SidebarItemId, CampaignMemberId } from '../common/ids'
import type { CustomBlock } from '../editor-blocks/types'
import type { ShareStatus } from '../editor-blocks/share-status'
import type { PermissionLevel } from '../permissions/types'
import type { SIDEBAR_ITEM_TYPES } from '../sidebar-items/types'
import type {
  SidebarItem,
  SidebarItemFromDb,
  SidebarItemWithContent,
} from '../sidebar-items/model-types'

export type NoteFromDb = SidebarItemFromDb<typeof SIDEBAR_ITEM_TYPES.notes>

export type Note = SidebarItem<typeof SIDEBAR_ITEM_TYPES.notes>

export type BlockMeta = {
  myPermissionLevel: PermissionLevel
  shareStatus: ShareStatus
  sharedWith: Array<CampaignMemberId>
  hiddenFrom?: Array<CampaignMemberId>
}

export type BlockShareAccessWarning = {
  campaignMemberId: CampaignMemberId
  blockCount: number
}

export type NoteWithContent = SidebarItemWithContent<typeof SIDEBAR_ITEM_TYPES.notes> & {
  _id: SidebarItemId
  content: Array<CustomBlock>
  blockMeta: Record<string, BlockMeta>
  blockShareAccessWarnings: Array<BlockShareAccessWarning>
}

export const NOTE_SNAPSHOT_TYPE = 'yjs_state' as const

export const NOTE_HISTORY_ACTION = {} as const

export type NoteHistoryMetadataMap = Record<string, never>
