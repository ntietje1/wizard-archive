import { CANVAS_HISTORY_ACTION } from '../canvases/types'
import { FILE_HISTORY_ACTION } from '../files/types'
import { FOLDER_HISTORY_ACTION } from '../folders/types'
import { MAP_HISTORY_ACTION } from '../gameMaps/types'
import { NOTE_HISTORY_ACTION } from '../notes/types'
import type { CanvasHistoryMetadataMap } from '../canvases/types'
import type { FileHistoryMetadataMap } from '../files/types'
import type { FolderHistoryMetadataMap } from '../folders/types'
import type { Id } from '../_generated/dataModel'
import type { MapHistoryMetadataMap } from '../gameMaps/types'
import type { NoteHistoryMetadataMap } from '../notes/types'
import type { SidebarItemId, SidebarItemType } from '../sidebarItems/types/baseTypes'

export const SHARED_HISTORY_ACTION = {
  created: 'created',
  renamed: 'renamed',
  moved: 'moved',
  trashed: 'trashed',
  restored: 'restored',
  icon_changed: 'icon_changed',
  color_changed: 'color_changed',
  content_edited: 'content_edited',
  rolled_back: 'rolled_back',
  updated: 'updated',
  permission_changed: 'permission_changed',
  block_share_changed: 'block_share_changed',
  inherit_shares_changed: 'inherit_shares_changed',
} as const

export type SharedHistoryMetadataMap = {
  created: null
  renamed: { from: string; to: string }
  moved: { from: string | null; to: string | null }
  trashed: null
  restored: null
  icon_changed: { from: string | null; to: string | null }
  color_changed: { from: string | null; to: string | null }
  content_edited: null
  rolled_back: { restoredFromHistoryEntryId: Id<'editHistory'> }
  updated: { changes: Array<EditHistoryChange> }
  permission_changed: {
    memberName: string | null
    level: string | null
    previousLevel: string | null
  }
  block_share_changed: {
    status: string
    campaignMemberId?: Id<'campaignMembers'>
    blockCount?: number
  }
  inherit_shares_changed: {
    inheritShares: boolean
    previousInheritShares: boolean
  }
}

export const EDIT_HISTORY_ACTION = {
  ...SHARED_HISTORY_ACTION,
  ...NOTE_HISTORY_ACTION,
  ...FOLDER_HISTORY_ACTION,
  ...MAP_HISTORY_ACTION,
  ...FILE_HISTORY_ACTION,
  ...CANVAS_HISTORY_ACTION,
} as const

export type EditHistoryMetadataMap = SharedHistoryMetadataMap &
  NoteHistoryMetadataMap &
  FolderHistoryMetadataMap &
  MapHistoryMetadataMap &
  FileHistoryMetadataMap &
  CanvasHistoryMetadataMap

export type EditHistoryAction = (typeof EDIT_HISTORY_ACTION)[keyof typeof EDIT_HISTORY_ACTION]

export type EditHistoryChange = {
  [K in Exclude<EditHistoryAction, 'updated'>]: {
    action: K
    metadata: EditHistoryMetadataMap[K]
  }
}[Exclude<EditHistoryAction, 'updated'>]

export type EditHistoryEntry = {
  [K in EditHistoryAction]: {
    _id: Id<'editHistory'>
    _creationTime: number
    itemId: SidebarItemId
    itemType: SidebarItemType
    campaignId: Id<'campaigns'>
    campaignMemberId: Id<'campaignMembers'>
    action: K
    metadata: EditHistoryMetadataMap[K]
    hasSnapshot: boolean
  }
}[EditHistoryAction]

export type LogEditHistoryArgs = {
  [K in EditHistoryAction]: {
    itemId: SidebarItemId
    itemType: SidebarItemType
    campaignId: Id<'campaigns'>
    action: K
  } & (EditHistoryMetadataMap[K] extends null
    ? { metadata?: null }
    : { metadata: EditHistoryMetadataMap[K] })
}[EditHistoryAction]
