import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { ResourcePatch } from '../patch-contract'

type FileSystemLifecycleWorkspaceId = string

export type FileSystemLifecycleIntent =
  | {
      type: 'openFolder'
      workspaceId: FileSystemLifecycleWorkspaceId
      folderId: SidebarItemId
    }
  | {
      type: 'selectItem'
      itemId: SidebarItemId
    }
  | {
      type: 'selectItems'
      itemIds: Array<SidebarItemId>
      focusedItemId?: SidebarItemId
    }
  | {
      type: 'openResource'
      itemId: SidebarItemId
      replace?: boolean
    }
  | {
      type: 'clearEditor'
    }
  | {
      type: 'restorePreviousLocation'
      guardedByItemId: SidebarItemId
    }

export type FileSystemOptimisticPreview = {
  receiptPatches: Array<ResourcePatch>
  inversePatches: Array<ResourcePatch>
  optimisticIntents: Array<FileSystemLifecycleIntent>
  rollbackIntents: Array<FileSystemLifecycleIntent>
}
