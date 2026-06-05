import type { CampaignId, SidebarItemId } from '../../common/ids'
import type { SidebarItemSlug } from '../slug'
import type { FileSystemPatch } from './receipts'

export type FileSystemLifecycleIntent =
  | {
      type: 'openFolder'
      campaignId: CampaignId
      folderId: SidebarItemId
    }
  | {
      type: 'selectItem'
      itemId: SidebarItemId
      slug: SidebarItemSlug
    }
  | {
      type: 'selectItems'
      itemIds: Array<SidebarItemId>
      focusedItemId?: SidebarItemId
    }
  | {
      type: 'navigateToItem'
      slug: SidebarItemSlug
      replace?: boolean
    }
  | {
      type: 'clearEditor'
    }
  | {
      type: 'restorePreviousLocation'
      guardedByItemId: SidebarItemId
      guardedBySlug: SidebarItemSlug
    }

export type FileSystemOptimisticPreview = {
  receiptPatches: Array<FileSystemPatch>
  inversePatches: Array<FileSystemPatch>
  optimisticIntents: Array<FileSystemLifecycleIntent>
  rollbackIntents: Array<FileSystemLifecycleIntent>
}
