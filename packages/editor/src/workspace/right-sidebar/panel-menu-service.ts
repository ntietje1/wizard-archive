import { RIGHT_SIDEBAR_PANEL_ID } from './constants'
import { RIGHT_SIDEBAR_CONTENT } from './content'
import type { RightSidebarContentId } from './content'
import { canShowRightSidebarContent } from './model'
import { resolveAvailableRightSidebarContentForItemType, RIGHT_SIDEBAR_PANELS } from './registry'
import { useRightSidebarStateStore } from './state-store'
import type { WorkspacePanelContextMenuServices } from '../context-menu/panel-menu'
import type { PanelPreferenceStoreApi } from '@wizard-archive/ui/panel-preferences/store'
import type { RightSidebarAvailablePanels } from './source'

export function createRightSidebarPanelMenuService(
  panelPreferences: PanelPreferenceStoreApi,
  availablePanels: RightSidebarAvailablePanels,
): WorkspacePanelContextMenuServices['panels'] {
  return {
    getPanelItems: (context) => {
      if (!context.item) return []
      const itemType = context.item.type
      return RIGHT_SIDEBAR_PANELS.filter(
        (panel) => availablePanels[panel.id] && canShowRightSidebarContent(itemType, panel.id),
      ).map((panel) => ({
        id: panel.id,
        label: panel.id === RIGHT_SIDEBAR_CONTENT.history ? 'Edit History' : panel.label,
        icon: panel.icon,
      }))
    },
    isPanelActive: (context, panelId) => {
      if (!context.item || !isRightSidebarContentId(panelId)) return false
      if (!availablePanels[panelId]) return false
      if (!canShowRightSidebarContent(context.item.type, panelId)) return false
      const panel = panelPreferences.getState().panels[RIGHT_SIDEBAR_PANEL_ID]
      const activeContentId = resolveAvailableRightSidebarContentForItemType(
        context.item.type,
        useRightSidebarStateStore.getState().activeContentByItemType[context.item.type],
        availablePanels,
      )
      return panel?.visible === true && activeContentId === panelId
    },
    activatePanel: (context, panelId) => {
      if (!context.item || !isRightSidebarContentId(panelId)) return
      if (!availablePanels[panelId]) return
      if (!canShowRightSidebarContent(context.item.type, panelId)) return
      const resolvedContentId = resolveAvailableRightSidebarContentForItemType(
        context.item.type,
        panelId,
        availablePanels,
      )
      if (!resolvedContentId) return
      useRightSidebarStateStore.getState().setActiveContent(context.item.type, resolvedContentId)
      panelPreferences.getState().setVisible(RIGHT_SIDEBAR_PANEL_ID, true)
    },
  }
}

function isRightSidebarContentId(value: string): value is RightSidebarContentId {
  return Object.values(RIGHT_SIDEBAR_CONTENT).includes(value as RightSidebarContentId)
}
