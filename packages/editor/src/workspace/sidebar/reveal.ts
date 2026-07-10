import type { SidebarItemId } from '../../../../../shared/common/ids'

export interface SidebarRevealCatalog {
  getVisibleAncestors: (itemId: SidebarItemId) => ReadonlyArray<{ id: SidebarItemId }>
}

interface SidebarRevealCommands {
  exitCloseAllMode: () => void
  setFolderState: (folderId: SidebarItemId, isOpen: boolean) => void
}

export function revealSidebarItemParents({
  catalog,
  itemId,
  uiCommands,
}: {
  catalog: SidebarRevealCatalog
  itemId: SidebarItemId
  uiCommands: SidebarRevealCommands
}) {
  uiCommands.exitCloseAllMode()
  for (const ancestor of catalog.getVisibleAncestors(itemId)) {
    uiCommands.setFolderState(ancestor.id, true)
  }
}
