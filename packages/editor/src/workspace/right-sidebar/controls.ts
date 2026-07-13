import {
  getAvailableRightSidebarPanelsForItemType,
  resolveAvailableRightSidebarContentForItemType,
} from './registry'
import type { RightSidebarContentId } from './content'
import type { RightSidebarState } from './container'
import type { RightSidebarAvailablePanels } from './source'
import type { ResourceKind } from '../resource-contract'

interface RightSidebarPanelControls {
  isLoaded: boolean
  setSize: (size: number) => void
  setVisible: (visible: boolean) => void
  size: number
  visible: boolean
}

interface CreateRightSidebarControlsInput {
  availablePanels: RightSidebarAvailablePanels
  storedContentId: RightSidebarContentId | undefined
  itemType: ResourceKind | null | undefined
  panel: RightSidebarPanelControls
  setActiveContentForItemType: (itemType: ResourceKind, contentId: RightSidebarContentId) => void
}

export interface WorkspaceRightSidebarControls extends RightSidebarState {
  toggle: (contentId: RightSidebarContentId) => void
}

export function createRightSidebarControls({
  availablePanels,
  itemType,
  panel,
  setActiveContentForItemType,
  storedContentId,
}: CreateRightSidebarControlsInput): WorkspaceRightSidebarControls {
  const activeContentId = resolveAvailableRightSidebarContentForItemType(
    itemType,
    storedContentId,
    availablePanels,
  )
  const hasAvailablePanel = itemType
    ? getAvailableRightSidebarPanelsForItemType(itemType, availablePanels).length > 0
    : false

  const setActiveContent = (contentId: RightSidebarContentId) => {
    if (!itemType) return
    if (!hasAvailablePanel) return
    const resolvedContentId = resolveAvailableRightSidebarContentForItemType(
      itemType,
      contentId,
      availablePanels,
    )
    if (resolvedContentId) setActiveContentForItemType(itemType, resolvedContentId)
  }

  const open = (contentId: RightSidebarContentId) => {
    if (!hasAvailablePanel) {
      panel.setVisible(false)
      return
    }
    setActiveContent(contentId)
    panel.setVisible(true)
  }

  const close = () => panel.setVisible(false)

  const toggle = (contentId: RightSidebarContentId) => {
    if (panel.visible && activeContentId === contentId) {
      close()
      return
    }
    open(contentId)
  }

  return {
    activeContentId,
    close,
    isLoaded: panel.isLoaded,
    open,
    setActiveContent,
    setSize: panel.setSize,
    setVisible: panel.setVisible,
    size: panel.size,
    toggle,
    visible: panel.visible && hasAvailablePanel,
  }
}
