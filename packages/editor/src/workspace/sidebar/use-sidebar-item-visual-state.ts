import type { AnyItem } from '../items'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { useCutFileSystemItemIds } from '../../filesystem/clipboard'
import { getSidebarItemVisualState } from './item-visual-state'
import { useSidebarWorkspaceState } from './workspace-state'

const EMPTY_CUT_ITEM_IDS: ReadonlyArray<AnyItem['id']> = []

export function useSidebarItemVisualState(item: AnyItem, currentItemId: SidebarItemId | null) {
  const cutItemIds = useCutFileSystemItemIds()
  const { selection } = useSidebarWorkspaceState()
  return getSidebarItemVisualState({
    item,
    selectedItemIds: selection.selectedItemIds,
    currentItemId,
    cutItemIds: cutItemIds ?? EMPTY_CUT_ITEM_IDS,
  })
}
