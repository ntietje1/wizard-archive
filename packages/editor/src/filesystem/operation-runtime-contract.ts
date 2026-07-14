import type { ReactNode } from 'react'
import type { MaybePromise } from '../../../../shared/common/async'
import type { SidebarItemId, UserProfileId } from '../../../../shared/common/ids'
import type { OperationId } from '../resources/domain-id'
import type { ResourceColor, ResourceIconName, ResourceKind } from '../workspace/resource-contract'
import type { ResourceTitle } from '../resources/resource-contract'
import type { CreateParentTarget } from '../workspace/items'
import type { ResourceShareOperations } from '../sharing/contracts'
import type {
  ResourceCommand,
  ResourceCommandExecutionOptions,
  ResourceCommandMutationInput,
  ResourceTransactionReceipt,
  ResourceCommandResult,
  ResourceCreateParentPlan,
} from './transaction-contract'
import type { SidebarItemsCache } from './cache'
import type { FileSystemNavigationEffects } from './executor'
import type {
  CreatedFileSystemHostItem,
  CreateFileSystemHostItemInitializer,
  RenamedFileSystemHostItem,
  RenameFileSystemHostItemInput,
} from './item-command-operations'
import type { FileSystemIntentCommand } from './domain/intent-planning'
import type { FileSystemTrashDialogState } from './trash/dialogs'

type ResourceOperationDriverCreateItemInput = {
  itemType: ResourceKind
  name: ResourceTitle
  parentTarget: CreateParentTarget
  parentPlan?: ResourceCreateParentPlan
  iconName?: ResourceIconName
  color?: ResourceColor
}

export type ResourceOperationDriver = {
  createItem: (
    input: ResourceOperationDriverCreateItemInput,
    initialize?: CreateFileSystemHostItemInitializer,
  ) => MaybePromise<CreatedFileSystemHostItem>
  renameItem: (input: RenameFileSystemHostItemInput) => MaybePromise<RenamedFileSystemHostItem>
  toggleBookmarks: (itemIds: Array<SidebarItemId>) => MaybePromise<ResourceCommandResult>
}

export type ResourceTrashDriver = {
  requestTrashItems: (itemIds: Array<SidebarItemId>) => MaybePromise<ResourceTrashRequestResult>
  restoreItems: (
    itemIds: Array<SidebarItemId>,
    targetParentId?: SidebarItemId | null,
  ) => MaybePromise<ResourceCommandResult>
  confirmEmptyTrash: () => void
  confirmDeleteForever: (itemIds: Array<SidebarItemId>) => void
}

export type ResourceTrashRequestResult =
  | ResourceCommandResult
  | { status: 'pending'; reason: 'folder_confirmation_required' }
  | { status: 'noop'; reason: 'no_items' }

export type ResourceClipboardDriver = {
  copy: (itemIds: Array<SidebarItemId>) => void
  cut: (itemIds: Array<SidebarItemId>) => void
  canUseClipboardOperations: boolean
  cancelClipboard: () => boolean
  canPaste: (targetParentId?: SidebarItemId | null) => boolean
  paste: (targetParentId?: SidebarItemId | null) => MaybePromise<ResourceCommandResult>
}

export type ResourceDropDriver = {
  executeDropCommand: (command: FileSystemIntentCommand) => MaybePromise<ResourceCommandResult>
}

export type ResourceHistoryOperationDriver = {
  undo: () => MaybePromise<ResourceCommandResult>
  redo: () => MaybePromise<ResourceCommandResult>
  canUndo: boolean
  canRedo: boolean
}

export type ResourceCommandDriver = {
  executeCommand: (
    command: ResourceCommand,
    options?: ResourceCommandExecutionOptions,
  ) => MaybePromise<ResourceCommandResult>
  discardCreatedItem: (transactionId: OperationId) => MaybePromise<void>
  finalizeCreatedItem?: (transactionId: OperationId) => MaybePromise<void>
  undo: () => MaybePromise<ResourceCommandResult>
  redo: () => MaybePromise<ResourceCommandResult>
  canUndo: boolean
  canRedo: boolean
}

type ResourceCommandCapability = { status: 'available' } | { status: 'unsupported'; reason: string }

export type ResourceCommandCapabilities = {
  createItems: ResourceCommandCapability
  manageFolders: ResourceCommandCapability
}

export type ResourceIoCapabilities = {
  maxUploadBytes?: number
}

export type ResourceCommandRuntimeArgs = {
  workspaceId: string
  currentUserId: UserProfileId | null
  cache: SidebarItemsCache
  navigation: FileSystemNavigationEffects
  trashState: FileSystemTrashDialogState
  executeMutation: (args: ResourceCommandMutationInput) => Promise<ResourceTransactionReceipt>
  undoMutation: (transactionId: OperationId) => Promise<ResourceTransactionReceipt>
  redoMutation: (transactionId: OperationId) => Promise<ResourceTransactionReceipt>
}

export type ResourceCommandRuntime = {
  filesystem: {
    resourceCommands: ResourceCommandDriver
    operations: ResourceOperationDriver
    clipboardOperations: ResourceClipboardDriver
    dropOperations: ResourceDropDriver
    trashOperations: ResourceTrashDriver
    historyOperations: ResourceHistoryOperationDriver
    dialog: ReactNode
  }
  sharing: {
    sidebarItems: ResourceShareOperations
  }
}
