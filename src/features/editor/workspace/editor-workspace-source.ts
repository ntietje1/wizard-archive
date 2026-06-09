import type { CampaignActor } from 'shared/campaigns/actor'
import type { EditorMode } from 'shared/editor/types'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { Id } from 'convex/_generated/dataModel'
import type { RefObject } from 'react'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import type { SidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import type { EditorWorkspaceChrome } from './editor-workspace-chrome'

interface EditorCurrentItemSnapshot {
  item: AnySidebarItem | null
  contentItem: AnySidebarItemWithContent | null
  editorSearch: EditorSearch
  isLoading: boolean
  itemError: unknown
  hasRequestedItem: boolean
}

interface EditorModeSnapshot {
  editorMode: EditorMode
  campaignActor: CampaignActor | null
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  canEdit: boolean
  setEditorMode: (editorMode: EditorMode) => void
  setViewAsPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
}

interface EditorFileSystemSnapshot {
  activeItemsById: Map<Id<'sidebarItems'>, AnySidebarItem>
  trashItems: Array<AnySidebarItem>
}

interface EditorCampaignSnapshot {
  campaignId: Id<'campaigns'> | undefined
  isCampaignLoaded: boolean
  isDm: boolean | undefined
}

type EditorEmptyWorkspaceDropCapability =
  | {
      status: 'disabled'
      reason: 'unsupported' | 'read_only'
    }
  | {
      status: 'enabled'
      accepts: {
        externalFiles: boolean
        sidebarItems: boolean
      }
      target: {
        ref: RefObject<HTMLDivElement | null>
        isFileDropTarget: boolean
        isSidebarItemDropTarget: boolean
      }
    }

interface EditorWorkspaceInteractions {
  emptyWorkspaceDrop: EditorEmptyWorkspaceDropCapability
}

export interface EditorWorkspaceSource {
  currentItem: EditorCurrentItemSnapshot
  editorMode: EditorModeSnapshot
  filesystem: EditorFileSystemSnapshot
  campaign: EditorCampaignSnapshot
  chrome: EditorWorkspaceChrome
  interactions: EditorWorkspaceInteractions
  pendingItemName: string
  setPendingItemName: (name: string) => void
  requestedSlug: SidebarItemSlug | null
  canViewCurrentItem: boolean
  availabilityState: SidebarItemAvailabilityState
  createMissingRequestedNote: () => void
  isCreatingMissingRequestedNote: boolean
}
