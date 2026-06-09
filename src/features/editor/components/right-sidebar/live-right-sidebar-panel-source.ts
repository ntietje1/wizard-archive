import { RIGHT_SIDEBAR_CONTENT } from '~/features/editor/chrome/right-sidebar-content'
import { BackLinksPanel } from './back-links-panel'
import { HistoryPanel } from './history-panel'
import { OutgoingLinksPanel } from './outgoing-links-panel'
import { OutlinePanel } from './outline-panel'
import type { RightSidebarPanelServices } from './right-sidebar-panel-source'

export const liveRightSidebarPanelServices: RightSidebarPanelServices = {
  [RIGHT_SIDEBAR_CONTENT.history]: HistoryPanel,
  [RIGHT_SIDEBAR_CONTENT.backlinks]: BackLinksPanel,
  [RIGHT_SIDEBAR_CONTENT.outgoing]: OutgoingLinksPanel,
  [RIGHT_SIDEBAR_CONTENT.outline]: OutlinePanel,
}
