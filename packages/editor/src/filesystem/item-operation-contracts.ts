import type { ResourceId } from '../resources/domain-id'
import type { MaybePromise } from '../../../../shared/common/async'

import type { ResourceImportFile } from '../files/import-contract'
import type { AnyItem, CreateParentTarget, ValidationResult } from '../workspace/items'
import type {
  ResourceColor,
  ResourceSlug,
  ResourceIconName,
  ResourceKind,
} from '../workspace/resource-contract'

import type { FileSystemIntentCommand } from './domain/intent-planning'
import type { ResourceTrashRequestResult } from './operation-runtime-contract'
import type { ResourceCommandResult } from './transaction-contract'

export interface FileSystemCreateItemInput {
  type: ResourceKind
  parentTarget: CreateParentTarget
  name?: string
  iconName?: ResourceIconName
  color?: ResourceColor
}

interface FileSystemCreateItemValidationInput {
  type: ResourceKind
  parentTarget: CreateParentTarget
  name: string
}

export interface FileSystemCreateItemCompletedResult {
  status: 'completed'
  id: ResourceId
  slug: ResourceSlug
}

type FileSystemCreateItemUnavailableResult = {
  status: 'unavailable'
  reason: 'create_items_unsupported' | 'manage_folders_unsupported'
}

type FileSystemCreateItemFailedResult = {
  status: 'failed'
  reason: 'create_failed'
  error?: unknown
}

export type FileSystemCreateItemResult =
  | FileSystemCreateItemCompletedResult
  | FileSystemCreateItemUnavailableResult
  | FileSystemCreateItemFailedResult

type FileSystemCreateItemInitializer = (
  created: FileSystemCreateItemCompletedResult,
  createItem: FileSystemCreateItem,
) => MaybePromise<void>

export type FileSystemCreateItem = (
  input: FileSystemCreateItemInput,
  initialize?: FileSystemCreateItemInitializer,
) => MaybePromise<FileSystemCreateItemResult>

interface FileSystemUpdateItemMetadataInput {
  item: AnyItem
  name?: string
  iconName?: ResourceIconName | null
  color?: ResourceColor | null
}

interface FileSystemUpdateItemMetadataResult {
  slug: ResourceSlug
}

export type FileSystemUpdateItemMetadata = (
  input: FileSystemUpdateItemMetadataInput,
) => MaybePromise<FileSystemUpdateItemMetadataResult>

export interface FileSystemPasteTargetInput {
  clickedItem?: AnyItem
}

export type FileSystemClipboardOperations =
  | {
      status: 'unsupported'
    }
  | {
      status: 'available'
      canPaste: boolean
      cancel: () => boolean
      copyItems: (itemIds: Array<ResourceId>) => void
      cutItems: (itemIds: Array<ResourceId>) => void
      paste: (targetParentId?: ResourceId | null) => MaybePromise<ResourceCommandResult>
    }

interface ResourceImportFileInput {
  file: ResourceImportFile
  name?: string
  parentId: ResourceId | null
  acceptedKinds?: ReadonlyArray<ResourceImportFileKind>
  onProgress?: (event: { fileName: string; percentage: number }) => void
}

type ResourceImportFileKind = 'file' | 'note'

type ResourceImportFileResult =
  | {
      status: 'imported'
      kind: ResourceImportFileKind
      fileName: string
      result: FileSystemCreateItemCompletedResult
    }
  | {
      status: 'skipped'
      fileName: string
      reason: 'failed' | 'invalid' | 'unavailable' | 'unsupported'
      error?: unknown
    }

interface ResourceImportFileEntry {
  file: ResourceImportFile
}

interface FileSystemImportFolderEntry {
  name: string
  files: Array<ResourceImportFileEntry>
  subfolders: Array<FileSystemImportFolderEntry>
}

interface FileSystemImportDropProgress {
  processedFiles: number
  processedFolders: number
  skippedFiles: number
}

interface FileSystemImportDropSkippedFile {
  fileName: string
  reason: 'invalid' | 'unsupported' | 'unavailable' | 'failed'
  error?: unknown
}

interface FileSystemImportDropInput {
  files: Array<ResourceImportFileEntry>
  rootFolders: Array<FileSystemImportFolderEntry>
  parentId: ResourceId | null
  onFileProgress?: (event: { fileName: string; percentage: number }) => void
  onProgress?: (progress: FileSystemImportDropProgress) => void
}

interface FileSystemImportDropResult extends FileSystemImportDropProgress {
  lastFolderId: ResourceId | null
  skippedFileDetails: Array<FileSystemImportDropSkippedFile>
}

export type ResourceImportFileOperation = (
  input: ResourceImportFileInput,
) => MaybePromise<ResourceImportFileResult>

type FileSystemImportDropOperation = (
  input: FileSystemImportDropInput,
) => MaybePromise<FileSystemImportDropResult>

type FileSystemCreateItemValidation = (
  input: FileSystemCreateItemValidationInput,
) => ValidationResult

export type FileSystemItemCreateOperations = {
  createItem: FileSystemCreateItem
}

export type FileSystemItemImportOperations = FileSystemItemCreateOperations & {
  importFile: ResourceImportFileOperation
}

export type FileSystemItemDropImportOperations = FileSystemItemImportOperations & {
  importDrop: FileSystemImportDropOperation
}

type FileSystemItemDropExecutionOperations = {
  executeDropCommand: (command: FileSystemIntentCommand) => MaybePromise<ResourceCommandResult>
}

export type FileSystemItemDragDropOperations = FileSystemItemDropImportOperations &
  FileSystemItemDropExecutionOperations

export type FileSystemItemCreateValidationOperations = {
  validateCreateItem: FileSystemCreateItemValidation
}

export type FileSystemItemMetadataUpdateOperations = {
  updateItemMetadata: FileSystemUpdateItemMetadata
}

export type FileSystemItemMetadataOperations = FileSystemItemMetadataUpdateOperations

export type FileSystemItemFormOperations = FileSystemItemCreateOperations &
  FileSystemItemMetadataOperations

type FileSystemItemPasteTargetOperations = {
  canPasteIntoTarget: (input: FileSystemPasteTargetInput) => boolean
  pasteIntoTarget: (input: FileSystemPasteTargetInput) => MaybePromise<ResourceCommandResult>
}

export type FileSystemItemTrashOperations = {
  requestEmptyTrash: () => MaybePromise<void>
  requestDeleteItemsForever: (itemIds: Array<ResourceId>) => MaybePromise<void>
  restoreItems: (
    itemIds: Array<ResourceId>,
    targetParentId: ResourceId | null,
  ) => MaybePromise<ResourceCommandResult>
}

export type FileSystemItemSidebarOperations = FileSystemItemCreateOperations &
  FileSystemItemMetadataUpdateOperations &
  FileSystemItemTrashOperations

type FileSystemItemContextMenuFilesystemOperations = {
  executeDropCommand: (command: FileSystemIntentCommand) => MaybePromise<ResourceCommandResult>
  requestEmptyTrash: () => MaybePromise<void>
  requestDeleteItemsForever: (itemIds: Array<ResourceId>) => MaybePromise<void>
  restoreItems: (
    itemIds: Array<ResourceId>,
    targetParentId: ResourceId | null,
  ) => MaybePromise<ResourceCommandResult>
  trashItems: (itemIds: Array<ResourceId>) => MaybePromise<ResourceTrashRequestResult>
} & FileSystemItemPasteTargetOperations

export type FileSystemItemContextMenuOperations = FileSystemItemFormOperations &
  FileSystemItemContextMenuFilesystemOperations &
  FileSystemItemBookmarkOperations

type FileSystemItemBookmarkOperations = {
  toggleBookmarks: (itemIds: Array<ResourceId>) => MaybePromise<ResourceCommandResult>
}
