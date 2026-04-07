import type { Id } from '../_generated/dataModel'
import type {
  SidebarItemId,
  SidebarItemType,
} from '../sidebarItems/types/baseTypes'

export const EDIT_HISTORY_ACTION = {
  created: 'created',
  renamed: 'renamed',
  moved: 'moved',
  trashed: 'trashed',
  restored: 'restored',
  icon_changed: 'icon_changed',
  color_changed: 'color_changed',
  content_edited: 'content_edited',
  image_changed: 'image_changed',
  image_removed: 'image_removed',
  file_replaced: 'file_replaced',
  file_removed: 'file_removed',
  pin_added: 'pin_added',
  pin_moved: 'pin_moved',
  pin_removed: 'pin_removed',
  pin_visibility_changed: 'pin_visibility_changed',
  shared: 'shared',
  unshared: 'unshared',
  permission_changed: 'permission_changed',
  block_share_changed: 'block_share_changed',
  inherit_shares_changed: 'inherit_shares_changed',
} as const

export type EditHistoryAction =
  (typeof EDIT_HISTORY_ACTION)[keyof typeof EDIT_HISTORY_ACTION]

export type EditHistoryEntry = {
  _id: Id<'editHistory'>
  _creationTime: number
  itemId: SidebarItemId
  itemType: SidebarItemType
  campaignId: Id<'campaigns'>
  campaignMemberId: Id<'campaignMembers'>
  action: EditHistoryAction
  metadata: Record<string, unknown> | null
}
