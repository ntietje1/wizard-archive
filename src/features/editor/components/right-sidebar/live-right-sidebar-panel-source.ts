import { RIGHT_SIDEBAR_CONTENT } from '~/features/editor/chrome/right-sidebar-content'
import { BackLinksPanel } from './back-links-panel'
import { LiveHistoryPanel } from './live-history-panel'
import { LiveOutlinePanel } from './live-outline-panel'
import { OutgoingLinksPanel } from './outgoing-links-panel'
import type { RightSidebarPanelServices } from './right-sidebar-panel-source'

export const liveRightSidebarPanelServices: RightSidebarPanelServices = {
  [RIGHT_SIDEBAR_CONTENT.history]: LiveHistoryPanel,
  [RIGHT_SIDEBAR_CONTENT.backlinks]: BackLinksPanel,
  [RIGHT_SIDEBAR_CONTENT.outgoing]: OutgoingLinksPanel,
  [RIGHT_SIDEBAR_CONTENT.outline]: LiveOutlinePanel,
}
