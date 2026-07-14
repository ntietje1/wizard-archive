import type { CampaignMemberId } from '../../../../shared/common/ids'
import type { ShareStatus } from '../../../../shared/block-shares/share-status'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import type { CreateParentTarget } from '../workspace/items'
import type {
  ResourceColor,
  ResourceId,
  ResourceIconName,
  ResourceKind,
} from '../workspace/resource-contract'
import type { ResourceTitle } from '../resources/resource-contract'
import type { OperationId } from '../resources/domain-id'

import type { ResourceChange, ResourcePatch } from './patch-contract'

export const RESOURCE_COMMAND_TYPE = {
  create: 'create',
  rename: 'rename',
  move: 'move',
  copy: 'copy',
  trash: 'trash',
  restore: 'restore',
  deleteForever: 'deleteForever',
  emptyTrash: 'emptyTrash',
  setResourceAudiencePermission: 'setResourceAudiencePermission',
  setResourcesMemberPermission: 'setResourcesMemberPermission',
  clearResourcesMemberPermission: 'clearResourcesMemberPermission',
  setFolderInheritShares: 'setFolderInheritShares',
  setBlocksShareStatus: 'setBlocksShareStatus',
  setBlockMemberPermission: 'setBlockMemberPermission',
  toggleBookmarks: 'toggleBookmarks',
} as const

export type ResourceCreateCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.create
  itemType: ResourceKind
  name: ResourceTitle
  parentTarget: CreateParentTarget
  iconName?: ResourceIconName
  color?: ResourceColor
}

export type ResourceCreateParentPlan =
  | { kind: 'direct'; parentId: ResourceId | null }
  | {
      kind: 'path'
      folders: Array<{ kind: 'existing'; id: ResourceId } | { kind: 'virtual'; name: string }>
    }

export type ResourceRenameCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.rename
  itemId: ResourceId
  name?: ResourceTitle
  iconName?: ResourceIconName | null
  color?: ResourceColor | null
}

type ResourceMoveCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.move
  itemIds: Array<ResourceId>
  targetParentId: ResourceId | null
}

type ResourceCopyCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.copy
  itemIds: Array<ResourceId>
  targetParentId: ResourceId | null
}

type ResourceTrashCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.trash
  itemIds: Array<ResourceId>
}

type ResourceRestoreCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.restore
  itemIds: Array<ResourceId>
  targetParentId: ResourceId | null
}

type ResourceDeleteForeverCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.deleteForever
  itemIds: Array<ResourceId>
}

type ResourceEmptyTrashCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.emptyTrash
}

type SetResourceAudiencePermissionCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.setResourceAudiencePermission
  itemIds: Array<ResourceId>
  permissionLevel: PermissionLevel | null
}

type SetResourcesMemberPermissionCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.setResourcesMemberPermission
  itemIds: Array<ResourceId>
  campaignMemberId: CampaignMemberId
  permissionLevel: PermissionLevel
}

type ClearResourcesMemberPermissionCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission
  itemIds: Array<ResourceId>
  campaignMemberId: CampaignMemberId
}

type SetFolderInheritSharesCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.setFolderInheritShares
  folderId: ResourceId
  inheritShares: boolean
}

type SetBlocksShareStatusCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.setBlocksShareStatus
  noteId: ResourceId
  blockNoteIds: Array<string>
  status: ShareStatus
}

type SetBlockMemberPermissionCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.setBlockMemberPermission
  noteId: ResourceId
  blockNoteIds: Array<string>
  campaignMemberId: CampaignMemberId
  permissionLevel: Extract<PermissionLevel, 'none' | 'view'> | null
}

type ToggleResourceBookmarksCommand = {
  type: typeof RESOURCE_COMMAND_TYPE.toggleBookmarks
  itemIds: Array<ResourceId>
}

export type ResourceCommand =
  | ResourceCreateCommand
  | ResourceRenameCommand
  | ResourceMoveCommand
  | ResourceCopyCommand
  | ResourceTrashCommand
  | ResourceRestoreCommand
  | ResourceDeleteForeverCommand
  | ResourceEmptyTrashCommand
  | SetResourceAudiencePermissionCommand
  | SetResourcesMemberPermissionCommand
  | ClearResourcesMemberPermissionCommand
  | SetFolderInheritSharesCommand
  | SetBlocksShareStatusCommand
  | SetBlockMemberPermissionCommand
  | ToggleResourceBookmarksCommand

export type ResourceCatalogCommand =
  | ResourceMoveCommand
  | ResourceCopyCommand
  | ResourceTrashCommand
  | ResourceRestoreCommand
  | ResourceDeleteForeverCommand
  | ResourceEmptyTrashCommand
  | ToggleResourceBookmarksCommand

export function isResourceCatalogCommand(
  command: ResourceCommand,
): command is ResourceCatalogCommand {
  switch (command.type) {
    case RESOURCE_COMMAND_TYPE.move:
    case RESOURCE_COMMAND_TYPE.copy:
    case RESOURCE_COMMAND_TYPE.trash:
    case RESOURCE_COMMAND_TYPE.restore:
    case RESOURCE_COMMAND_TYPE.deleteForever:
    case RESOURCE_COMMAND_TYPE.emptyTrash:
    case RESOURCE_COMMAND_TYPE.toggleBookmarks:
      return true
    default:
      return false
  }
}

export type ResourceSharingCommand =
  | SetResourceAudiencePermissionCommand
  | SetResourcesMemberPermissionCommand
  | ClearResourcesMemberPermissionCommand
  | SetFolderInheritSharesCommand
  | SetBlocksShareStatusCommand
  | SetBlockMemberPermissionCommand

export function isResourceSharingCommand(
  command: ResourceCommand,
): command is ResourceSharingCommand {
  switch (command.type) {
    case RESOURCE_COMMAND_TYPE.setResourceAudiencePermission:
    case RESOURCE_COMMAND_TYPE.setResourcesMemberPermission:
    case RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission:
    case RESOURCE_COMMAND_TYPE.setFolderInheritShares:
    case RESOURCE_COMMAND_TYPE.setBlocksShareStatus:
    case RESOURCE_COMMAND_TYPE.setBlockMemberPermission:
      return true
    default:
      return false
  }
}

export type ResourceOperationDecision = {
  sourceItemId: ResourceId
  action: 'skip' | 'replace' | 'keepBoth' | 'mergeFolder'
}

export type ResourceCommandDecision = Pick<ResourceOperationDecision, 'action'>

export type ResourceCommandDecisionRecord = Partial<Record<ResourceId, ResourceCommandDecision>>

export type ResourceCommandExecutionOptions = {
  decisions?: ResourceCommandDecisionRecord
  createParentPlan?: ResourceCreateParentPlan
  onSuccess?: () => void
}

export type ResourceCommandMutationInput = {
  command: ResourceCommand
  decisions: Array<ResourceOperationDecision> | undefined
  operationId: OperationId
}

export const RESOURCE_EVENT_TYPE = {
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

export type ResourceEvent =
  | { type: typeof RESOURCE_EVENT_TYPE.created; itemId: ResourceId; slug: string }
  | { type: typeof RESOURCE_EVENT_TYPE.updated; itemId: ResourceId }
  | {
      type: typeof RESOURCE_EVENT_TYPE.renamed
      itemId: ResourceId
      slug: string
      previousSlug: string
    }
  | {
      type: typeof RESOURCE_EVENT_TYPE.copied
      itemId: ResourceId
      sourceItemId: ResourceId
    }
  | { type: typeof RESOURCE_EVENT_TYPE.moved; itemId: ResourceId }
  | { type: typeof RESOURCE_EVENT_TYPE.trashed; itemId: ResourceId }
  | { type: typeof RESOURCE_EVENT_TYPE.restored; itemId: ResourceId }
  | {
      type: typeof RESOURCE_EVENT_TYPE.replaced
      itemId: ResourceId
      sourceItemId: ResourceId
    }
  | {
      type: typeof RESOURCE_EVENT_TYPE.mergedFolder
      itemId: ResourceId
      sourceItemId: ResourceId
    }
  | { type: typeof RESOURCE_EVENT_TYPE.deletedForever; itemId: ResourceId }
  | {
      type: typeof RESOURCE_EVENT_TYPE.skipped
      itemId: ResourceId
      sourceItemId: ResourceId
    }
  | { type: typeof RESOURCE_EVENT_TYPE.noop; itemId: ResourceId }

type ResourceMessageKind =
  | 'created'
  | 'updated'
  | 'renamed'
  | 'copied'
  | 'moved'
  | 'restored'
  | 'trashed'
  | 'deletedForever'
  | 'shared'
  | 'bookmarksUpdated'
  | 'noop'

type ResourceReceiptMessage = {
  kind: ResourceMessageKind
  affectedCount: number
  createdCount: number
  mergedCount: number
  skippedCount: number
}

type ResourceMessageKindSelector = (events: Array<ResourceEvent>) => ResourceMessageKind

const constantMessageKind =
  (kind: ResourceMessageKind): ResourceMessageKindSelector =>
  () =>
    kind

function hasEventType(events: Array<ResourceEvent>, type: ResourceEvent['type']) {
  return events.some((event) => event.type === type)
}

function updatedMessageKind(kind: ResourceMessageKind): ResourceMessageKindSelector {
  return (events) => (hasEventType(events, RESOURCE_EVENT_TYPE.updated) ? kind : 'noop')
}

const RECEIPT_MESSAGE_KIND_BY_COMMAND = {
  [RESOURCE_COMMAND_TYPE.create]: constantMessageKind('created'),
  [RESOURCE_COMMAND_TYPE.rename]: (events) => {
    if (hasEventType(events, RESOURCE_EVENT_TYPE.renamed)) return 'renamed'
    return hasEventType(events, RESOURCE_EVENT_TYPE.updated) ? 'updated' : 'noop'
  },
  [RESOURCE_COMMAND_TYPE.move]: constantMessageKind('moved'),
  [RESOURCE_COMMAND_TYPE.copy]: constantMessageKind('copied'),
  [RESOURCE_COMMAND_TYPE.trash]: constantMessageKind('trashed'),
  [RESOURCE_COMMAND_TYPE.restore]: constantMessageKind('restored'),
  [RESOURCE_COMMAND_TYPE.deleteForever]: constantMessageKind('deletedForever'),
  [RESOURCE_COMMAND_TYPE.emptyTrash]: constantMessageKind('deletedForever'),
  [RESOURCE_COMMAND_TYPE.setResourceAudiencePermission]: updatedMessageKind('shared'),
  [RESOURCE_COMMAND_TYPE.setResourcesMemberPermission]: updatedMessageKind('shared'),
  [RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission]: updatedMessageKind('shared'),
  [RESOURCE_COMMAND_TYPE.setFolderInheritShares]: updatedMessageKind('shared'),
  [RESOURCE_COMMAND_TYPE.setBlocksShareStatus]: updatedMessageKind('shared'),
  [RESOURCE_COMMAND_TYPE.setBlockMemberPermission]: updatedMessageKind('shared'),
  [RESOURCE_COMMAND_TYPE.toggleBookmarks]: updatedMessageKind('bookmarksUpdated'),
} satisfies Record<ResourceCommand['type'], ResourceMessageKindSelector>

export type ResourceDelta = {
  command: ResourceCommand
  events: Array<ResourceEvent>
  changes: Array<ResourceChange>
  undoable: boolean
}

function summarizeResourceEvents(
  kind: ResourceMessageKind,
  events: Array<ResourceEvent>,
): ResourceReceiptMessage {
  const createdCount = events.filter(
    (event) =>
      event.type === RESOURCE_EVENT_TYPE.created || event.type === RESOURCE_EVENT_TYPE.copied,
  ).length
  const mergedCount = events.filter(
    (event) => event.type === RESOURCE_EVENT_TYPE.mergedFolder,
  ).length
  const skippedCount = events.filter((event) => event.type === RESOURCE_EVENT_TYPE.skipped).length
  const affectedCount = affectedCountForMessageKind(kind, events, {
    createdCount,
    mergedCount,
  })

  return {
    kind,
    affectedCount,
    createdCount,
    mergedCount,
    skippedCount,
  }
}

function affectedCountForMessageKind(
  kind: ResourceMessageKind,
  events: Array<ResourceEvent>,
  {
    createdCount,
    mergedCount,
  }: {
    createdCount: number
    mergedCount: number
  },
) {
  switch (kind) {
    case 'created':
      return events.filter((event) => event.type === RESOURCE_EVENT_TYPE.created).length
    case 'updated':
    case 'shared':
    case 'bookmarksUpdated':
      return events.filter((event) => event.type === RESOURCE_EVENT_TYPE.updated).length
    case 'renamed':
      return events.filter((event) => event.type === RESOURCE_EVENT_TYPE.renamed).length
    case 'copied':
      return (
        createdCount +
        mergedCount +
        events.filter((event) => event.type === RESOURCE_EVENT_TYPE.replaced).length
      )
    case 'moved':
      return events.filter(
        (event) =>
          event.type === RESOURCE_EVENT_TYPE.moved ||
          event.type === RESOURCE_EVENT_TYPE.replaced ||
          event.type === RESOURCE_EVENT_TYPE.mergedFolder,
      ).length
    case 'restored':
      return events.filter((event) => event.type === RESOURCE_EVENT_TYPE.restored).length
    case 'trashed':
      return events.filter((event) => event.type === RESOURCE_EVENT_TYPE.trashed).length
    case 'deletedForever':
      return events.filter((event) => event.type === RESOURCE_EVENT_TYPE.deletedForever).length
    case 'noop':
      return 0
  }
}

function messageKindForResourceCommand(
  command: ResourceCommand,
  events: Array<ResourceEvent>,
): ResourceMessageKind {
  if (events.every((event) => event.type === RESOURCE_EVENT_TYPE.noop)) {
    return 'noop'
  }

  return RECEIPT_MESSAGE_KIND_BY_COMMAND[command.type](events)
}

export function summarizeResourceReceipt(
  command: ResourceCommand,
  events: Array<ResourceEvent>,
): ResourceReceiptMessage {
  return summarizeResourceEvents(messageKindForResourceCommand(command, events), events)
}

type ResourceTransactionDirection = 'forward' | 'undo' | 'redo'

export type ResourceTransactionReceipt = {
  transactionId: OperationId | null
  direction: ResourceTransactionDirection
  command: ResourceCommand
  events: Array<ResourceEvent>
  patches: Array<ResourcePatch>
  summary: ResourceReceiptMessage
  undoable: boolean
}

export type ResourceCommandResult<TConflict = unknown> =
  | { status: 'completed'; receipt: ResourceTransactionReceipt }
  | { status: 'needsDecision'; conflicts: Array<TConflict> }
  | { status: 'rejected'; reason: 'stale-conflict' | 'stale-history' }
  | { status: 'unsupported'; reason: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; error?: unknown }

export function completedResourceCommand(
  command: ResourceCommand,
  events: Array<ResourceEvent>,
  {
    transactionId = null,
    undoable = false,
  }: {
    transactionId?: OperationId | null
    undoable?: boolean
  } = {},
): ResourceCommandResult<never> {
  return {
    status: 'completed',
    receipt: {
      transactionId,
      direction: 'forward',
      command,
      events,
      patches: [],
      summary: summarizeResourceReceipt(command, events),
      undoable,
    },
  }
}

export type ResourceOperationKind =
  | 'fileReplaced'
  | 'fileImported'
  | 'mapImageUpdated'
  | 'mapPinsCreated'
  | 'mapPinUpdated'
  | 'mapPinVisibilityUpdated'
  | 'mapPinRemoved'
  | 'blocksShareUpdated'
  | 'downloadPrepared'

export type ResourceOperationReceipt = {
  kind: ResourceOperationKind
  affectedCount: number
  itemId?: ResourceId
}

export type ResourceOperationResult =
  | { status: 'completed'; receipt: ResourceOperationReceipt }
  | { status: 'unsupported'; reason: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; error?: unknown }

export function completedResourceOperation(
  receipt: ResourceOperationReceipt,
): ResourceOperationResult {
  return { status: 'completed', receipt }
}
