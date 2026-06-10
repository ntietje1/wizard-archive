import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
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
  topbar: EditorWorkspaceTopbarChrome
}

export type EditorWorkspaceShareChrome =
  | {
      visible: false
    }
  | {
      disabled: boolean
      items: Array<AnySidebarItem>
      shared: boolean
      visible: true
    }

export interface EditorWorkspaceViewAsPlayerChrome {
  isPending: boolean
  playerMembers: Array<CampaignMemberSummary>
  selectedPlayerId: Id<'campaignMembers'> | undefined
  setSelectedPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
  visible: boolean
}

export interface EditorWorkspaceContextMenuChrome {
  enabled: boolean
  item: AnySidebarItem | null
}

export interface EditorWorkspaceTopbarChrome {
  contextMenu: EditorWorkspaceContextMenuChrome
  history: {
    toggle: () => void
  }
  share: EditorWorkspaceShareChrome
  viewAsPlayer: EditorWorkspaceViewAsPlayerChrome
}
