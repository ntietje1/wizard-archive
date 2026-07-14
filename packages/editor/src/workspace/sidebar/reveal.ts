import type { ResourceId } from '../../resources/domain-id'
export interface SidebarRevealCatalog {
  getVisibleAncestors: (itemId: ResourceId) => ReadonlyArray<{ id: ResourceId }>
}

interface SidebarRevealCommands {
  exitCloseAllMode: () => void
  setFolderState: (folderId: ResourceId, isOpen: boolean) => void
}

export function revealSidebarItemParents({
  catalog,
  itemId,
  uiCommands,
}: {
  catalog: SidebarRevealCatalog
  itemId: ResourceId
  uiCommands: SidebarRevealCommands
}) {
  uiCommands.exitCloseAllMode()
  for (const ancestor of catalog.getVisibleAncestors(itemId)) {
    uiCommands.setFolderState(ancestor.id, true)
  }
}
