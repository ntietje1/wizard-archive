import type { CampaignActor } from 'shared/campaigns/actor'
import type { EditorMode } from 'shared/editor/types'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { ValidationResult } from 'shared/sidebar-items/name'
import type { Id } from 'convex/_generated/dataModel'
import type { ComponentType, RefObject } from 'react'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import type { EditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import type { SidebarItemAvailabilityState } from 'shared/sidebar-items/availability'
import type { EditorWorkspaceChrome } from './editor-workspace-chrome'
import type { FileViewerSource } from '~/features/editor/components/viewer/file/file-viewer-source'

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

interface EditorWorkspaceHistoryPreview {
  previewingEntryId: Id<'editHistory'> | null
  clearItemSession: (itemId: Id<'sidebarItems'>) => void
  PreviewComponent: ComponentType<{ itemId: Id<'sidebarItems'>; entryId: Id<'editHistory'> }>
  RollbackDialogComponent: ComponentType<{ itemId: Id<'sidebarItems'> }>
}

interface EditorWorkspaceCommands {
  renameItem: (item: AnySidebarItem, name: string) => Promise<void> | void
  openItem: (item: AnySidebarItem) => Promise<void> | void
  getItemLinkProps: (item: AnySidebarItem) => EditorLinkProps | null
  validateItemName: (
    name: string,
    parentId: Id<'sidebarItems'> | null,
    excludeId?: Id<'sidebarItems'>,
  ) => ValidationResult
}

interface EditorWorkspaceViewers {
  file: FileViewerSource
}

export interface EditorWorkspaceSource {
  currentItem: EditorCurrentItemSnapshot
  editorMode: EditorModeSnapshot
  filesystem: EditorFileSystemSnapshot
  campaign: EditorCampaignSnapshot
  chrome: EditorWorkspaceChrome
  interactions: EditorWorkspaceInteractions
  historyPreview: EditorWorkspaceHistoryPreview
  viewers: EditorWorkspaceViewers
  commands: EditorWorkspaceCommands
  pendingItemName: string
  setPendingItemName: (name: string) => void
  requestedSlug: SidebarItemSlug | null
  canViewCurrentItem: boolean
  availabilityState: SidebarItemAvailabilityState
  createMissingRequestedNote: () => void
  isCreatingMissingRequestedNote: boolean
}
