import {
  RIGHT_SIDEBAR_DEFAULTS,
  RIGHT_SIDEBAR_PANEL_ID,
} from '~/features/editor/components/right-sidebar/constants'
import type { RightSidebarContentId } from '~/features/editor/chrome/right-sidebar-content'
import { resolveRightSidebarContent } from '~/features/editor/components/right-sidebar/right-sidebar-model'
import type { RightSidebarItemType } from '~/features/editor/components/right-sidebar/right-sidebar-model'
import { useRightSidebarStateStore } from '~/features/editor/stores/right-sidebar-state-store'
import { usePanelPreference } from '~/features/settings/hooks/use-panel-preference'

export function useRightSidebar(itemType: RightSidebarItemType | null | undefined) {
  const panel = usePanelPreference(RIGHT_SIDEBAR_PANEL_ID, RIGHT_SIDEBAR_DEFAULTS)
  const storedActiveContentId = useRightSidebarStateStore((state) =>
    itemType ? state.activeContentByItemType[itemType] : undefined,
  )
  const setActiveContentForItemType = useRightSidebarStateStore((state) => state.setActiveContent)

  const activeContentId = resolveRightSidebarContent(itemType, storedActiveContentId)

  const open = (contentId: RightSidebarContentId) => {
    if (itemType) setActiveContentForItemType(itemType, contentId)
    panel.setVisible(true)
  }

  const close = () => panel.setVisible(false)

  const toggle = (contentId: RightSidebarContentId) => {
    if (panel.visible && activeContentId === contentId) {
      close()
    } else {
      open(contentId)
    }
  }

  return {
    visible: panel.visible,
    activeContentId,
    size: panel.size,
    isLoaded: panel.isLoaded,
    setSize: panel.setSize,
    setVisible: panel.setVisible,
    setActiveContent: (contentId: RightSidebarContentId) => {
      if (itemType) setActiveContentForItemType(itemType, contentId)
    },
    open,
    close,
    toggle,
  }
}
