import {
  RIGHT_SIDEBAR_CONTENT,
  RIGHT_SIDEBAR_DEFAULTS,
  RIGHT_SIDEBAR_PANEL_ID,
} from '~/features/editor/components/right-sidebar/constants'
import type { RightSidebarContentId } from '~/features/editor/components/right-sidebar/constants'
import { usePanelPreference } from '~/features/settings/hooks/use-panel-preference'

export function useRightSidebar() {
  const panel = usePanelPreference(RIGHT_SIDEBAR_PANEL_ID, RIGHT_SIDEBAR_DEFAULTS)

  const activeContentId =
    (panel.activeContentId as RightSidebarContentId | null) ?? RIGHT_SIDEBAR_CONTENT.history

  const open = (contentId: RightSidebarContentId) => {
    panel.setActiveContent(contentId)
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
    setActiveContent: panel.setActiveContent,
    open,
    close,
    toggle,
  }
}
