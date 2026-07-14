import type { ResourceId } from '../../resources/domain-id'
import { useCallback } from 'react'

import { useSidebarWorkspaceState } from './workspace-state'
import { revealSidebarItemParents } from './reveal'
import type { SidebarRevealCatalog } from './reveal'

export function useRevealSidebarItemParents(source: SidebarRevealCatalog) {
  const { getVisibleAncestors } = source
  const {
    uiCommands: { exitCloseAllMode, setFolderState },
  } = useSidebarWorkspaceState()

  return useCallback(
    (itemId: ResourceId) => {
      revealSidebarItemParents({
        catalog: { getVisibleAncestors },
        itemId,
        uiCommands: { exitCloseAllMode, setFolderState },
      })
    },
    [exitCloseAllMode, getVisibleAncestors, setFolderState],
  )
}
