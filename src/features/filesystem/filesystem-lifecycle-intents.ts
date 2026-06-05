import type { CampaignId, SidebarItemId } from 'shared/common/ids'
import type { FileSystemLifecycleIntent } from 'shared/sidebar-items/filesystem/lifecycle'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'

type FileSystemLifecycleSelectionState = {
  selectedSlug: SidebarItemSlug | null
  selectedItemIds: Array<SidebarItemId>
  clearItemSelection: () => void
  setSelected: (slug: SidebarItemSlug) => void
}

type FileSystemLifecycleIntentAdapters = {
  setFolderState: (campaignId: CampaignId, folderId: SidebarItemId, isOpen: boolean) => void
  setSelectedItemIds: (itemIds: Array<SidebarItemId>, focusedItemId?: SidebarItemId) => void
  getSelectionState: () => FileSystemLifecycleSelectionState
  navigateToItem: (slug: SidebarItemSlug, replace?: boolean) => Promise<void>
  clearEditorContent: () => Promise<void>
}

export async function applyFileSystemLifecycleIntents({
  intents,
  previousSlug,
  adapters,
}: {
  intents: Array<FileSystemLifecycleIntent>
  previousSlug: SidebarItemSlug | null
  adapters: FileSystemLifecycleIntentAdapters
}) {
  await intents.reduce<Promise<void>>(
    (chain, intent) =>
      chain.then(() => applyFileSystemLifecycleIntent({ intent, previousSlug, adapters })),
    Promise.resolve(),
  )
}

async function applyFileSystemLifecycleIntent({
  intent,
  previousSlug,
  adapters,
}: {
  intent: FileSystemLifecycleIntent
  previousSlug: SidebarItemSlug | null
  adapters: FileSystemLifecycleIntentAdapters
}) {
  switch (intent.type) {
    case 'openFolder':
      adapters.setFolderState(intent.campaignId, intent.folderId, true)
      return
    case 'selectItem':
      adapters.setSelectedItemIds([intent.itemId], intent.itemId)
      adapters.getSelectionState().setSelected(intent.slug)
      return
    case 'selectItems':
      adapters.setSelectedItemIds(intent.itemIds, intent.focusedItemId)
      return
    case 'navigateToItem':
      await adapters.navigateToItem(intent.slug, intent.replace)
      return
    case 'clearEditor':
      await adapters.clearEditorContent()
      return
    case 'restorePreviousLocation': {
      const state = adapters.getSelectionState()
      if (
        state.selectedSlug !== intent.guardedBySlug &&
        !state.selectedItemIds.includes(intent.guardedByItemId)
      ) {
        return
      }
      state.clearItemSelection()
      if (previousSlug) {
        state.setSelected(previousSlug)
        await adapters.navigateToItem(previousSlug, true)
      } else {
        await adapters.clearEditorContent()
      }
      return
    }
  }
}
