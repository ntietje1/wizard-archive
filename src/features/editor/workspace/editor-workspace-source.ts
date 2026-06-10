import type { CampaignActor } from 'shared/campaigns/actor'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { EditorMode } from 'shared/editor/types'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { ValidationResult } from 'shared/sidebar-items/name'
import type { SidebarItemType } from 'shared/sidebar-items/types'
import type { Id } from 'convex/_generated/dataModel'
import type { ComponentType, RefObject } from 'react'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import type { EditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import type { SidebarItemAvailabilityState } from 'shared/sidebar-items/availability'
import type { FileViewerSource } from '~/features/editor/components/viewer/file/file-viewer-source'

interface EditorWorkspaceContent {
  currentItem: EditorCurrentItemSnapshot
  requestedSlug: SidebarItemSlug | null
  canViewCurrentItem: boolean
  availabilityState: SidebarItemAvailabilityState
}

interface EditorCurrentItemSnapshot {
  item: AnySidebarItem | null
  contentItem: AnySidebarItemWithContent | null
  editorSearch: EditorSearch
  isLoading: boolean
  itemError: unknown
  hasRequestedItem: boolean
}

interface EditorWorkspacePermissions {
  editorMode: EditorMode
  campaignActor: CampaignActor | null
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  canEdit: boolean
  setEditorMode: (editorMode: EditorMode) => void
  setViewAsPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
  viewAsPlayer: EditorWorkspaceViewAsPlayerCapability
}

interface EditorWorkspaceIndex {
  activeItemsById: Map<Id<'sidebarItems'>, AnySidebarItem>
  trashItems: Array<AnySidebarItem>
}

interface EditorWorkspaceIdentity {
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

export type EditorWorkspaceSharingState =
  | {
      visible: false
    }
  | {
      disabled: boolean
      items: Array<AnySidebarItem>
      shared: boolean
      visible: true
    }

export interface EditorWorkspaceViewAsPlayerCapability {
  isPending: boolean
  playerMembers: Array<CampaignMemberSummary>
  selectedPlayerId: Id<'campaignMembers'> | undefined
  setSelectedPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
  visible: boolean
}

export interface EditorWorkspaceItemActionsCapability {
  enabled: boolean
  item: AnySidebarItem | null
}

interface EditorWorkspaceCreationDraft {
  pendingName: string
  setPendingName: (name: string) => void
}

interface EditorWorkspaceHistory {
  preview: {
    previewingEntryId: Id<'editHistory'> | null
    clearItemSession: (itemId: Id<'sidebarItems'>) => void
    PreviewComponent: ComponentType<{ itemId: Id<'sidebarItems'>; entryId: Id<'editHistory'> }>
  }
  rollback: {
    DialogComponent: ComponentType<{ itemId: Id<'sidebarItems'> }>
  }
}

interface EditorWorkspaceItems {
  itemActions: EditorWorkspaceItemActionsCapability
  createItem: (
    input: EditorWorkspaceCreateItemInput,
  ) => Promise<EditorWorkspaceCreateItemResult | null> | EditorWorkspaceCreateItemResult | null
  createMissingRequestedNote: () => void
  creationDraft: EditorWorkspaceCreationDraft
  emptyWorkspaceDrop: EditorEmptyWorkspaceDropCapability
  isCreatingMissingRequestedNote: boolean
  renameItem: (item: AnySidebarItem, name: string) => Promise<void> | void
  validateItemName: (
    name: string,
    parentId: Id<'sidebarItems'> | null,
    excludeId?: Id<'sidebarItems'>,
  ) => ValidationResult
}

interface EditorWorkspaceCreateItemInput {
  type: SidebarItemType
  parentId: Id<'sidebarItems'> | null
  name?: string
}

interface EditorWorkspaceCreateItemResult {
  id: Id<'sidebarItems'>
  slug: SidebarItemSlug
}

interface EditorWorkspaceNavigation {
  openItem: (item: AnySidebarItem) => Promise<void> | void
  openItemBySlug: (slug: SidebarItemSlug, replace?: boolean) => Promise<void> | void
  getItemLinkProps: (item: AnySidebarItem) => EditorLinkProps | null
}

interface EditorWorkspaceFiles {
  viewer: FileViewerSource
}

export interface EditorWorkspaceSource {
  content: EditorWorkspaceContent
  permissions: EditorWorkspacePermissions
  index: EditorWorkspaceIndex
  workspace: EditorWorkspaceIdentity
  items: EditorWorkspaceItems
  navigation: EditorWorkspaceNavigation
  history: EditorWorkspaceHistory
  sharing: EditorWorkspaceSharingState
  files: EditorWorkspaceFiles
}
