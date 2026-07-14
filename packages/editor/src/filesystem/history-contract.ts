import type { CampaignId, CampaignMemberId, HistoryEntryId } from '../resources/domain-id'
import type { ResourceId, ResourceKind } from '../workspace/resource-contract'

const SHARED_HISTORY_ACTION = {
  created: 'created',
  copied: 'copied',
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

const MAP_HISTORY_ACTION = {
  map_image_changed: 'map_image_changed',
  map_image_removed: 'map_image_removed',
  map_pin_added: 'map_pin_added',
  map_pin_moved: 'map_pin_moved',
  map_pin_removed: 'map_pin_removed',
  map_pin_visibility_changed: 'map_pin_visibility_changed',
} as const

const FILE_HISTORY_ACTION = {
  file_replaced: 'file_replaced',
  file_removed: 'file_removed',
} as const

export const EDIT_HISTORY_ACTION = {
  ...SHARED_HISTORY_ACTION,
  ...MAP_HISTORY_ACTION,
  ...FILE_HISTORY_ACTION,
} as const

export const HISTORY_ROLLBACK_REJECTION_REASON = {
  contentChanged: 'content_changed',
  historyEntryUnavailable: 'history_entry_unavailable',
  itemUnavailable: 'item_unavailable',
  snapshotIncompatible: 'snapshot_incompatible',
  snapshotUnavailable: 'snapshot_unavailable',
  unsupportedItemType: 'unsupported_item_type',
  workspaceUnavailable: 'workspace_unavailable',
} as const

export type HistoryRollbackRejectionReason =
  (typeof HISTORY_ROLLBACK_REJECTION_REASON)[keyof typeof HISTORY_ROLLBACK_REJECTION_REASON]

export type HistoryRollbackResult =
  | {
      status: 'restored'
      historyEntryId: HistoryEntryId
      preservedHistoryEntryId: HistoryEntryId
      restoredFromHistoryEntryId: HistoryEntryId
      restoredItemId: ResourceId
    }
  | { status: 'rejected'; reason: HistoryRollbackRejectionReason }
  | { status: 'already_running' }
  | { status: 'failed' }

type EditHistoryAction = (typeof EDIT_HISTORY_ACTION)[keyof typeof EDIT_HISTORY_ACTION]

type SharedHistoryMetadataMap = {
  created: null
  copied: { copiedFromItemId: ResourceId; copiedFromName: string }
  renamed: { from: string; to: string }
  moved: { from: string | null; to: string | null }
  trashed: null
  restored: null
  icon_changed: { from: string | null; to: string | null }
  color_changed: { from: string | null; to: string | null }
  content_edited: null
  rolled_back: { restoredFromHistoryEntryId: HistoryEntryId }
  updated: { changes: Array<EditHistoryChange> }
  permission_changed: {
    memberName: string | null
    level: string | null
    previousLevel: string | null
  }
  block_share_changed: {
    status: string
    memberId?: CampaignMemberId
    blockCount?: number
  }
  inherit_shares_changed: {
    inheritShares: boolean
    previousInheritShares: boolean
  }
}

type MapHistoryMetadataMap = {
  [MAP_HISTORY_ACTION.map_image_changed]: null
  [MAP_HISTORY_ACTION.map_image_removed]: null
  [MAP_HISTORY_ACTION.map_pin_added]: { pinItemName: string }
  [MAP_HISTORY_ACTION.map_pin_moved]: { pinItemName: string }
  [MAP_HISTORY_ACTION.map_pin_removed]: { pinItemName: string }
  [MAP_HISTORY_ACTION.map_pin_visibility_changed]: {
    pinItemName: string
    visible: boolean
  }
}

type FileHistoryMetadataMap = {
  [K in (typeof FILE_HISTORY_ACTION)[keyof typeof FILE_HISTORY_ACTION]]: null
}

export type EditHistoryMetadataMap = SharedHistoryMetadataMap &
  MapHistoryMetadataMap &
  FileHistoryMetadataMap

export type EditHistoryChange = {
  [K in Exclude<EditHistoryAction, 'updated'>]: {
    action: K
    metadata: EditHistoryMetadataMap[K]
  }
}[Exclude<EditHistoryAction, 'updated'>]

export type EditHistoryEntry = {
  [K in EditHistoryAction]: {
    id: HistoryEntryId
    createdAt: number
    itemId: ResourceId
    itemType: ResourceKind
    workspaceId: CampaignId
    memberId: CampaignMemberId
    action: K
    metadata: EditHistoryMetadataMap[K]
    hasSnapshot: boolean
  }
}[EditHistoryAction]

export type LogEditHistoryArgs = {
  [K in EditHistoryAction]: {
    itemId: ResourceId
    itemType: ResourceKind
    action: K
  } & (EditHistoryMetadataMap[K] extends null
    ? { metadata?: null }
    : { metadata: EditHistoryMetadataMap[K] })
}[EditHistoryAction]
