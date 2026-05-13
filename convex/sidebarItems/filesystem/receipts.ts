import type { Doc, Id } from '../../_generated/dataModel'
import type { FileSystemCommand } from './commands'
import type { SidebarItemColor } from '../validation/color'
import type { SidebarItemIconName } from '../validation/icon'
import type { SidebarItemName } from '../validation/name'
import type { SidebarItemSlug } from '../validation/slug'
import type { SidebarItemLocation, SidebarItemStatus } from '../types/baseTypes'

export const FILE_SYSTEM_EVENT_TYPE = {
  created: 'created',
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

export type FileSystemEventType =
  (typeof FILE_SYSTEM_EVENT_TYPE)[keyof typeof FILE_SYSTEM_EVENT_TYPE]

export type FileSystemEvent =
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.created; itemId: Id<'sidebarItems'>; slug: string }
  | {
      type: typeof FILE_SYSTEM_EVENT_TYPE.renamed
      itemId: Id<'sidebarItems'>
      slug: string
      previousSlug: string
    }
  | {
      type: typeof FILE_SYSTEM_EVENT_TYPE.copied
      itemId: Id<'sidebarItems'>
      sourceItemId: Id<'sidebarItems'>
    }
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.moved; itemId: Id<'sidebarItems'> }
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.trashed; itemId: Id<'sidebarItems'> }
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.restored; itemId: Id<'sidebarItems'> }
  | {
      type: typeof FILE_SYSTEM_EVENT_TYPE.replaced
      itemId: Id<'sidebarItems'>
      sourceItemId: Id<'sidebarItems'>
    }
  | {
      type: typeof FILE_SYSTEM_EVENT_TYPE.mergedFolder
      itemId: Id<'sidebarItems'>
      sourceItemId: Id<'sidebarItems'>
    }
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.deletedForever; itemId: Id<'sidebarItems'> }
  | {
      type: typeof FILE_SYSTEM_EVENT_TYPE.skipped
      itemId: Id<'sidebarItems'>
      sourceItemId: Id<'sidebarItems'>
    }
  | { type: typeof FILE_SYSTEM_EVENT_TYPE.noop; itemId: Id<'sidebarItems'> }

export type FileSystemMessageKind =
  | 'created'
  | 'renamed'
  | 'copied'
  | 'moved'
  | 'restored'
  | 'trashed'
  | 'deletedForever'
  | 'noop'

export type FileSystemReceiptMessage = {
  kind: FileSystemMessageKind
  affectedCount: number
  createdCount: number
  mergedCount: number
  skippedCount: number
}

export type SidebarItemPatchFields = {
  name: SidebarItemName
  slug: SidebarItemSlug
  iconName: SidebarItemIconName | null
  color: SidebarItemColor | null
  parentId: Id<'sidebarItems'> | null
  location: SidebarItemLocation
  status: SidebarItemStatus
  previewStorageId: Id<'_storage'> | null
  previewLockedUntil: number | null
  previewClaimToken: string | null
  previewUpdatedAt: number | null
  updatedTime: number | null
  updatedBy: Id<'userProfiles'> | null
  deletionTime: number | null
  deletedBy: Id<'userProfiles'> | null
}
export type SidebarItemFieldPatch = Partial<SidebarItemPatchFields>

export type FileSystemPatch =
  | {
      type: 'upsertSidebarItem'
      item: Doc<'sidebarItems'>
    }
  | {
      type: 'updateSidebarItem'
      itemId: Id<'sidebarItems'>
      before: SidebarItemFieldPatch
      fields: SidebarItemFieldPatch
    }
  | {
      type: 'removeSidebarItem'
      itemId: Id<'sidebarItems'>
      snapshot?: Doc<'sidebarItems'>
    }

export type FileSystemDelta = {
  command: FileSystemCommand
  events: Array<FileSystemEvent>
  receiptPatches: Array<FileSystemPatch>
  forwardPatches: Array<FileSystemPatch>
  inversePatches: Array<FileSystemPatch>
  undoable: boolean
}

export function fileSystemSelfEvents(
  type:
    | typeof FILE_SYSTEM_EVENT_TYPE.moved
    | typeof FILE_SYSTEM_EVENT_TYPE.trashed
    | typeof FILE_SYSTEM_EVENT_TYPE.restored
    | typeof FILE_SYSTEM_EVENT_TYPE.deletedForever
    | typeof FILE_SYSTEM_EVENT_TYPE.noop,
  itemIds: Array<Id<'sidebarItems'>>,
): Array<FileSystemEvent> {
  return itemIds.map((itemId) => ({ type, itemId }))
}

export function summarizeFileSystemEvents(
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

export function messageKindForFileSystemCommand(
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
      return events.some((event) => event.type === FILE_SYSTEM_EVENT_TYPE.renamed)
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
  }
}

export function summarizeFileSystemReceipt(
  command: FileSystemCommand,
  events: Array<FileSystemEvent>,
): FileSystemReceiptMessage {
  return summarizeFileSystemEvents(messageKindForFileSystemCommand(command, events), events)
}

export type FileSystemTransactionDirection = 'forward' | 'undo' | 'redo'

export type FileSystemTransactionSummary = FileSystemReceiptMessage

export type FileSystemTransactionReceipt = {
  transactionId: Id<'filesystemTransactions'> | null
  direction: FileSystemTransactionDirection
  command: FileSystemCommand
  events: Array<FileSystemEvent>
  patches: Array<FileSystemPatch>
  summary: FileSystemTransactionSummary
  undoable: boolean
}
