import type { Id } from '../_generated/dataModel'
import type { CustomBlock } from '../notes/editorSpecs'
import type { SidebarItemId, SidebarItemType } from '../sidebarItems/types'

export const BLOCK_SHARE_STATUS = {
  ALL_SHARED: 'all_shared',
  NOT_SHARED: 'not_shared',
  INDIVIDUALLY_SHARED: 'individually_shared',
} as const

export type BlockShareStatus =
  (typeof BLOCK_SHARE_STATUS)[keyof typeof BLOCK_SHARE_STATUS]

export type Block = {
  _id: Id<'blocks'>
  _creationTime: number
  noteId: Id<'notes'>
  blockId: string
  position?: number
  content: CustomBlock
  isTopLevel: boolean
  campaignId: Id<'campaigns'>
  updatedAt: number
  shareStatus?: BlockShareStatus
}
