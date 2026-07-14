import type { ResourceId } from '../../resources/domain-id'
import type { ResourcePatch } from '../patch-contract'

type FileSystemLifecycleWorkspaceId = string

export type FileSystemLifecycleIntent =
  | {
      type: 'openFolder'
      workspaceId: FileSystemLifecycleWorkspaceId
      folderId: ResourceId
    }
  | {
      type: 'selectItem'
      itemId: ResourceId
    }
  | {
      type: 'selectItems'
      itemIds: Array<ResourceId>
      focusedItemId?: ResourceId
    }
  | {
      type: 'openResource'
      itemId: ResourceId
      replace?: boolean
    }
  | {
      type: 'clearEditor'
    }
  | {
      type: 'restorePreviousLocation'
      guardedByItemId: ResourceId
    }

export type FileSystemOptimisticPreview = {
  receiptPatches: Array<ResourcePatch>
  inversePatches: Array<ResourcePatch>
  optimisticIntents: Array<FileSystemLifecycleIntent>
  rollbackIntents: Array<FileSystemLifecycleIntent>
}
