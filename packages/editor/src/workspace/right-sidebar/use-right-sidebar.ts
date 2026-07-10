import { useEffect } from 'react'
import { RIGHT_SIDEBAR_DEFAULTS, RIGHT_SIDEBAR_PANEL_ID } from './constants'
import { useRightSidebarStateStore } from './state-store'
import { usePanelPreference } from '@wizard-archive/ui/panel-preferences/use-panel-preference'
import { createRightSidebarControls } from './controls'
import type { RightSidebarAvailablePanels } from './source'
import type { ResourceKind } from '../resource-contract'

export function useRightSidebar(
  itemType: ResourceKind | null | undefined,
  availablePanels: RightSidebarAvailablePanels,
) {
  const panel = usePanelPreference(RIGHT_SIDEBAR_PANEL_ID, RIGHT_SIDEBAR_DEFAULTS)
  const storedContentId = useRightSidebarStateStore((state) =>
    itemType ? state.activeContentByItemType[itemType] : undefined,
  )
  const setActiveContentForItemType = useRightSidebarStateStore((state) => state.setActiveContent)
  const { setVisible: setPanelVisible, visible: panelVisible } = panel

  const controls = createRightSidebarControls({
    availablePanels,
    itemType,
    panel,
    setActiveContentForItemType,
    storedContentId,
  })

  useEffect(() => {
    if (!itemType) return
    if (!storedContentId) return
    if (storedContentId === controls.activeContentId) return

    setActiveContentForItemType(itemType, controls.activeContentId)
  }, [controls.activeContentId, itemType, setActiveContentForItemType, storedContentId])

  useEffect(() => {
    if (!itemType) return
    if (!panelVisible) return
    if (controls.visible) return

    setPanelVisible(false)
  }, [controls.visible, itemType, panelVisible, setPanelVisible])

  return controls
}
