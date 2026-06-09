import type { RightSidebarContentId } from '~/features/editor/chrome/right-sidebar-content'

export interface EditorWorkspaceRightSidebarChrome {
  activeContentId: RightSidebarContentId
  close: () => void
  isLoaded: boolean
  open: (contentId: RightSidebarContentId) => void
  setActiveContent: (contentId: RightSidebarContentId) => void
  setSize: (size: number) => void
  setVisible: (visible: boolean) => void
  size: number
  toggle: (contentId: RightSidebarContentId) => void
  visible: boolean
}

export interface EditorWorkspaceChrome {
  rightSidebar: EditorWorkspaceRightSidebarChrome
}
