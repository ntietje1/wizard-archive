import type {
  CampaignMemberId,
  CampaignId,
  FileSystemTransactionId,
  SessionId,
  SidebarItemId,
  SidebarItemShareId,
  StorageId,
  UserProfileId,
} from '../../common/ids'
import type { FileSystemCommand } from './commands'
import type { SidebarItemPatchRow } from './types'
import type { PermissionLevel } from '../../permissions/types'
import type { SidebarItemStatus, SidebarItemType } from '../types'

export const FILE_SYSTEM_EVENT_TYPE = {
  created: 'created',
  updated: 'updated',
  renamed: 'renamed',
  moved: 'moved',
  copied: 'copied',
  trashed: 'trashed',
  restored: 'restored',
  replaced: 'replaced',
  mergedFolder: 'mergedFolder',
  deletedForever: 'deletedForever',
  skipped: 'skipped',
  noop: 'noop',
} as const

export type FileSystemEvent =
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.created; itemId: SidebarItemId; slug: string }
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.updated; itemId: SidebarItemId }
  | {
      type: typeof FILE_SYSTEM_EVENT_TYPE.renamed
      itemId: SidebarItemId
      slug: string
      previousSlug: string
    }
  | {
      type: typeof FILE_SYSTEM_EVENT_TYPE.copied
      itemId: SidebarItemId
      sourceItemId: SidebarItemId
    }
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.moved; itemId: SidebarItemId }
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.trashed; itemId: SidebarItemId }
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.restored; itemId: SidebarItemId }
  | {
      type: typeof FILE_SYSTEM_EVENT_TYPE.replaced
      itemId: SidebarItemId
      sourceItemId: SidebarItemId
    }
  | {
      type: typeof FILE_SYSTEM_EVENT_TYPE.mergedFolder
      itemId: SidebarItemId
      sourceItemId: SidebarItemId
    }
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.deletedForever; itemId: SidebarItemId }
  | {
      type: typeof FILE_SYSTEM_EVENT_TYPE.skipped
      itemId: SidebarItemId
      sourceItemId: SidebarItemId
    }
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.noop; itemId: SidebarItemId }

export type FileSystemMessageKind =
  | 'created'
  | 'renamed'
  | 'copied'
  | 'moved'
  | 'restored'
  | 'trashed'
  | 'deletedForever'
  | 'shared'
  | 'noop'

export type FileSystemReceiptMessage = {
  kind: FileSystemMessageKind
  affectedCount: number
  createdCount: number
  mergedCount: number
  skippedCount: number
}

export type SidebarItemPatchFields = {
  name: string
  slug: string
  iconName: string | null
  color: string | null
  parentId: SidebarItemId | null
  status: SidebarItemStatus
  allPermissionLevel: PermissionLevel | null
  previewStorageId: StorageId | null
  previewLockedUntil: number | null
  previewClaimToken: string | null
  previewUpdatedAt: number | null
  updatedTime: number | null
  updatedBy: UserProfileId | null
  deletionTime: number | null
  deletedBy: UserProfileId | null
}
export type SidebarItemFieldPatch = Partial<SidebarItemPatchFields>
export type SidebarItemPatchPrecondition = SidebarItemFieldPatch &
  Partial<Pick<SidebarItemPatchRow, 'type' | 'createdBy'>>

export type SidebarItemSharePatchRow = {
  _id: SidebarItemShareId
  _creationTime: number
  campaignId: CampaignId
  sidebarItemId: SidebarItemId
  sidebarItemType: SidebarItemType
  campaignMemberId: CampaignMemberId
  sessionId: SessionId | null
  permissionLevel: PermissionLevel | null
}

type SidebarItemSharePatchFields = {
  permissionLevel: PermissionLevel | null
}
export type SidebarItemShareFieldPatch = Partial<SidebarItemSharePatchFields>
type SidebarItemSharePatchPrecondition = SidebarItemShareFieldPatch

export type FolderSharePatchRow = {
  folderId: SidebarItemId
  inheritShares: boolean
}

type FolderSharePatchFields = {
  inheritShares: boolean
}
export type FolderShareFieldPatch = Partial<FolderSharePatchFields>
type FolderSharePatchPrecondition = FolderShareFieldPatch

export type FileSystemPatch =
  | {
      type: 'upsertSidebarItem'
      item: SidebarItemPatchRow
    }
  | {
      type: 'updateSidebarItem'
      itemId: SidebarItemId
      before: SidebarItemPatchPrecondition
      fields: SidebarItemFieldPatch
    }
  | {
      type: 'removeSidebarItem'
      itemId: SidebarItemId
      snapshot: SidebarItemPatchRow
    }
  | {
      type: 'upsertSidebarItemShare'
      share: SidebarItemSharePatchRow
    }
  | {
      type: 'updateSidebarItemShare'
      sidebarItemId: SidebarItemId
      campaignMemberId: CampaignMemberId
      before: SidebarItemSharePatchPrecondition
      fields: SidebarItemShareFieldPatch
    }
  | {
      type: 'removeSidebarItemShare'
      share: SidebarItemSharePatchRow
    }
  | {
      type: 'updateFolderShare'
      folderId: SidebarItemId
      before: FolderSharePatchPrecondition
      fields: FolderShareFieldPatch
    }

export type FileSystemChange =
  | {
      type: 'insertSidebarItem'
      itemId: SidebarItemId
      after: SidebarItemPatchRow
    }
  | {
      type: 'updateSidebarItem'
      itemId: SidebarItemId
      before: SidebarItemPatchRow
      after: SidebarItemPatchRow
    }
  | {
      type: 'removeSidebarItem'
      itemId: SidebarItemId
      before: SidebarItemPatchRow
    }
  | {
      type: 'insertSidebarItemShare'
      after: SidebarItemSharePatchRow
    }
  | {
      type: 'updateSidebarItemShare'
      before: SidebarItemSharePatchRow
      after: SidebarItemSharePatchRow
    }
  | {
      type: 'removeSidebarItemShare'
      before: SidebarItemSharePatchRow
    }
  | {
      type: 'updateFolderShare'
      before: FolderSharePatchRow
      after: FolderSharePatchRow
    }

export type FileSystemDelta = {
  command: FileSystemCommand
  events: Array<FileSystemEvent>
  changes: Array<FileSystemChange>
  undoable: boolean
}

export function fileSystemSelfEvents(
  type:
    | typeof FILE_SYSTEM_EVENT_TYPE.moved
    | typeof FILE_SYSTEM_EVENT_TYPE.trashed
    | typeof FILE_SYSTEM_EVENT_TYPE.restored
    | typeof FILE_SYSTEM_EVENT_TYPE.deletedForever
    | typeof FILE_SYSTEM_EVENT_TYPE.noop,
  itemIds: Array<SidebarItemId>,
): Array<FileSystemEvent> {
  return itemIds.map((itemId) => ({ type, itemId }))
}

function summarizeFileSystemEvents(
  kind: FileSystemMessageKind,
  events: Array<FileSystemEvent>,
): FileSystemReceiptMessage {
  // Copy success counts only copied roots that still point at a source item. Replacement
  // events are bookkeeping for overwritten destinations, not additional affected roots.
  const createdCount = events.filter(
    (event) =>
      event.type === FILE_SYSTEM_EVENT_TYPE.created || event.type === FILE_SYSTEM_EVENT_TYPE.copied,
  ).length
  const mergedCount = events.filter(
    (event) => event.type === FILE_SYSTEM_EVENT_TYPE.mergedFolder,
  ).length
  const skippedCount = events.filter(
    (event) => event.type === FILE_SYSTEM_EVENT_TYPE.skipped,
  ).length
  const affectedCount =
    kind === 'copied'
      ? createdCount + mergedCount
      : events.filter(
          (event) =>
            event.type !== FILE_SYSTEM_EVENT_TYPE.skipped &&
            event.type !== FILE_SYSTEM_EVENT_TYPE.noop &&
            event.type !== FILE_SYSTEM_EVENT_TYPE.replaced,
        ).length

  return {
    kind,
    affectedCount,
    createdCount,
    mergedCount,
    skippedCount,
  }
}

function messageKindForFileSystemCommand(
  command: FileSystemCommand,
  events: Array<FileSystemEvent>,
): FileSystemMessageKind {
  if (events.length > 0 && events.every((event) => event.type === FILE_SYSTEM_EVENT_TYPE.noop)) {
    return 'noop'
  }

  switch (command.type) {
    case 'create':
      return 'created'
    case 'rename':
      return events.some(
        (event) =>
          event.type === FILE_SYSTEM_EVENT_TYPE.renamed ||
          event.type === FILE_SYSTEM_EVENT_TYPE.updated,
      )
        ? 'renamed'
        : 'noop'
    case 'copy':
      return 'copied'
    case 'move':
      return 'moved'
    case 'restore':
      return 'restored'
    case 'trash':
      return 'trashed'
    case 'deleteForever':
    case 'emptyTrash':
      return 'deletedForever'
    case 'setAllPlayersPermission':
    case 'setSidebarItemsMemberPermission':
    case 'clearSidebarItemsMemberPermission':
    case 'setFolderInheritShares':
      return events.some((event) => event.type === FILE_SYSTEM_EVENT_TYPE.updated)
        ? 'shared'
        : 'noop'
  }
}

export function summarizeFileSystemReceipt(
  command: FileSystemCommand,
  events: Array<FileSystemEvent>,
): FileSystemReceiptMessage {
  return summarizeFileSystemEvents(messageKindForFileSystemCommand(command, events), events)
}

export type FileSystemTransactionDirection = 'forward' | 'undo' | 'redo'

export type FileSystemTransactionReceipt = {
  transactionId: FileSystemTransactionId | null
  direction: FileSystemTransactionDirection
  command: FileSystemCommand
  events: Array<FileSystemEvent>
  patches: Array<FileSystemPatch>
  summary: FileSystemReceiptMessage
  undoable: boolean
}
