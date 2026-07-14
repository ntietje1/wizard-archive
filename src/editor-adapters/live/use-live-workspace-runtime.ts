import {
  createWizardEditorPermissionSource,
  createWizardEditorResourceAvailabilityMetadataSource,
  createWizardEditorResourceCatalogSource,
  createWizardEditorResource,
  createWizardEditorRuntime,
  createWizardEditorRuntimeSources,
  createWizardEditorSharingSource,
  getWizardEditorResourceId,
  isWizardEditorFileItem,
  resolveWizardEditorNavigationState,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorCurrentResourceState,
  WizardEditorItem,
  WizardEditorNavigation,
  WizardEditorPermissionSource,
  WizardEditorResourceAvailabilityMetadataSource,
  WizardEditorResourceSlug,
  WizardEditorRuntime,
  WizardEditorWorkspaceActor,
} from '@wizard-archive/editor/adapter'
import { createElement, useCallback, useRef, useState } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { PERMISSION_LEVEL } from 'shared/permissions/types'

import type { HistoryEntryId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import type { LiveFileSystemReadModel } from '~/editor-adapters/live/filesystem/read-model'
import { useLiveSidebarItemAvailabilityState } from '~/editor-adapters/live/use-live-sidebar-item-availability-state'
import { LiveSidebarItemsShareState } from '~/editor-adapters/live/sharing/live-sidebar-items-share-state'
import { useLiveBlocksShare } from '~/editor-adapters/live/sharing/use-live-blocks-share'
import { executeShareCommand } from '~/editor-adapters/live/sharing/use-share-mutation-runner'
import { toEditorShareParticipant } from '~/editor-adapters/sharing/share-participants'
import { useLiveWorkspaceNavigation } from './use-live-workspace-navigation'
import { useLastWorkspaceItem } from '~/editor-adapters/live/use-last-workspace-item'
import {
  useLiveCanvasEmbeddedSessionSource,
  useLiveCanvasSessionSource,
} from '~/editor-adapters/live/canvas/session-source'
import { useLiveFileSessionAdapter } from '~/editor-adapters/live/files/session-source'
import { useLiveGameMapSessionSource } from '~/editor-adapters/live/game-maps/session-source'
import type {
  LiveFileSystemHost,
  LiveSidebarItemsShareOperations,
} from '~/editor-adapters/live/filesystem/host'
import {
  useLiveImportedTextFileInitializer,
  useLiveNoteHeadingSessionPorts,
  useLiveNotePlaybackSessionPorts,
  useLiveNoteSessionPorts,
  useLiveNoteValueSessionPorts,
} from '~/editor-adapters/live/notes/session-source'
import { useLiveCurrentItem } from '~/editor-adapters/live/use-live-current-item'
import { useLiveWorkspaceMode } from '~/editor-adapters/live/use-live-workspace-mode'
import { useLiveWorkspaceHistory } from '~/editor-adapters/live/use-live-workspace-history'
import { useLiveWorkspaceSearch } from '~/editor-adapters/live/use-live-workspace-search'
import { createLiveWorkspaceDownloadSource } from '~/editor-adapters/live/filesystem/download'
import { useClaimAndUploadPreview } from '~/editor-adapters/live/previews/use-claim-and-upload-preview'
import { handleError } from '~/shared/utils/logger'

export type LiveWorkspaceSeparateItemNavigation = (input: {
  heading?: string
  itemSlug: string
}) => void

type LiveWorkspaceExternalUrlNavigation = (url: string) => void

export function useLiveWorkspaceRuntime({
  workspaceId,
  filesystemReadModel,
  filesystemHost,
  sidebarItemsShareOperations,
  openExternalUrl,
  openSeparateItem,
}: {
  workspaceId: string
  filesystemReadModel: LiveFileSystemReadModel
  filesystemHost: LiveFileSystemHost
  sidebarItemsShareOperations: LiveSidebarItemsShareOperations
  openExternalUrl: LiveWorkspaceExternalUrlNavigation
  openSeparateItem: LiveWorkspaceSeparateItemNavigation
}): WizardEditorRuntime {
  const campaign = useCampaign()
  const convex = useConvex()
  const filesystemModel = createWizardEditorResourceCatalogSource({
    activeItems: filesystemReadModel.activeItems,
    activeError: filesystemReadModel.activeError,
    activeStatus: filesystemReadModel.activeStatus,
    refreshActive: filesystemReadModel.refreshActive,
    refreshTrash: filesystemReadModel.refreshTrash,
    trashError: filesystemReadModel.trashError,
    trashItems: filesystemReadModel.visibleTrashItems,
    trashStatus: filesystemReadModel.trashStatus,
    visibleActiveItems: filesystemReadModel.visibleActiveItems,
  })
  const currentItem = useLiveCurrentItem({
    getKnownItemBySlug: filesystemModel.catalog.getKnownItemBySlug,
  })
  const workspaceMode = useLiveWorkspaceMode(
    currentItem.item,
    filesystemModel.catalog.getKnownItemById,
  )
  const canUseDmWorkspaceActions = canUseDmWorkspaceAuthority(workspaceMode.workspaceActor)
  const navigationSource = useLiveRuntimeNavigation({
    campaign,
    canCreateItems: canUseDmWorkspaceActions,
    catalog: filesystemModel.catalog,
    currentItem,
    openExternalUrl,
    openSeparateItem,
  })
  const runtimeSources = useLiveRuntimeSources({
    campaign,
    convex,
    currentItem,
    filesystemHost,
    filesystemModel,
    canUseDmWorkspaceActions,
    navigationSource,
    sidebarItemsShareOperations,
    workspaceId,
    workspaceMode,
  })

  return createWizardEditorRuntime({
    workspace: { id: workspaceId },
    commands: runtimeSources.commands,
    history: runtimeSources.history,
    io: runtimeSources.io,
    navigation: navigationSource.navigation,
    resources: runtimeSources.resources,
    search: runtimeSources.search,
    sharing: runtimeSources.sharing,
    documents: runtimeSources.documents,
  })
}

type LiveCampaign = ReturnType<typeof useCampaign>
type LiveCurrentItem = ReturnType<typeof useLiveCurrentItem>
type LiveWorkspaceMode = ReturnType<typeof useLiveWorkspaceMode>
type LiveFileSystemModel = ReturnType<typeof createWizardEditorResourceCatalogSource>
type LiveRuntimeNavigationSource = ReturnType<typeof useLiveRuntimeNavigation>
type LiveRuntimeSources = ReturnType<typeof createWizardEditorRuntimeSources>

function useLiveRuntimeSources({
  campaign,
  convex,
  currentItem,
  filesystemHost,
  filesystemModel,
  canUseDmWorkspaceActions,
  navigationSource,
  sidebarItemsShareOperations,
  workspaceId,
  workspaceMode,
}: {
  campaign: LiveCampaign
  convex: ReturnType<typeof useConvex>
  currentItem: LiveCurrentItem
  filesystemHost: LiveFileSystemHost
  filesystemModel: LiveFileSystemModel
  canUseDmWorkspaceActions: boolean
  navigationSource: LiveRuntimeNavigationSource
  sidebarItemsShareOperations: LiveSidebarItemsShareOperations
  workspaceId: string
  workspaceMode: LiveWorkspaceMode
}): LiveRuntimeSources {
  const { catalog, operationItems, paths, load } = filesystemModel
  const historyControls = useLiveResourceHistoryControls(currentItem.item?.id ?? null)
  const history = useLiveWorkspaceHistory({
    canEdit: workspaceMode.canEdit,
    controls: historyControls,
    itemId: currentItem.item?.id ?? null,
  })
  const permissions = createWizardEditorPermissionSource({
    actor: workspaceMode.workspaceActor,
    canEdit: workspaceMode.canEdit,
    canUseWorkspaceActions: canUseDmWorkspaceActions,
    getItemById: (itemId) => catalog.getKnownItemById(itemId as ResourceId),
    workspaceMode: workspaceMode.workspaceMode,
    setWorkspaceMode: workspaceMode.setWorkspaceMode,
  })
  const current = useLiveRuntimeCurrentState({
    campaign,
    catalog,
    currentItem,
    load,
  })
  const { resourceContent, search } = useLiveWorkspaceSearch(
    workspaceId,
    convex,
    current,
    currentItem.item,
    {
      catalog,
      permissions,
    },
    workspaceMode.viewAsPlayerId ?? null,
  )
  const contentSessions = useLiveRuntimeContentSessions({
    catalog,
    permissions,
    workspaceId,
  })
  const sharing = useLiveRuntimeSharing({
    campaign,
    canUseDmWorkspaceActions,
    operations: sidebarItemsShareOperations,
    workspaceMode,
  })
  const canvasSession = useLiveCanvasSessionSource({
    workspaceId,
    access: {
      canEditCanvas: (canvas) => permissions.canMutateItem(canvas, PERMISSION_LEVEL.EDIT),
    },
  })
  const canvasEmbedded = useLiveCanvasEmbeddedSessionSource({
    workspaceId,
  })
  const initializeImportedTextFile = useLiveImportedTextFileInitializer()

  return createWizardEditorRuntimeSources({
    commands: {
      canCreateItems: canUseDmWorkspaceActions,
      clipboardDriver: filesystemHost.clipboardOperations,
      contentInitializers: {
        initializeImportedFile: contentSessions.file.initializeImportedFile,
        initializeImportedTextFile,
      },
      navigateToItem: navigationSource.navigateToItem,
      onItemSlugChange: navigationSource.onItemSlugChange,
      resourceCommandDriver: filesystemHost.resourceCommands,
      reportCreateItemError: handleError,
      setLastSelectedItem: navigationSource.setLastSelectedItem,
      trashDialogDriver: filesystemHost.trashOperations,
      unavailableReason: 'insufficient_authority',
    },
    resources: {
      catalog,
      operationItems,
      paths,
      load,
      current,
      permissions,
      resourceContent,
    },
    search: {
      items: search,
    },
    io: {
      download: createLiveWorkspaceDownloadSource(convex, workspaceId, {
        canDownloadRoot: canUseDmWorkspaceActions,
      }),
    },
    history,
    sharing,
    documents: {
      canvas: canvasSession,
      canvasEmbedded,
      canvasPreviewUpload: { status: 'available', upload: useClaimAndUploadPreview() },
      file: contentSessions.file.session,
      map: contentSessions.map.session,
      note: contentSessions.note,
      noteHeadings: contentSessions.noteHeadings,
      notePlayback: contentSessions.notePlayback,
      noteValues: contentSessions.noteValues,
    },
  })
}

type LiveResourceHistoryControlState = {
  itemId: ResourceId | null
  previewingEntryId: HistoryEntryId | null
  rollbackEntryId: HistoryEntryId | null
}

type LiveResourceHistoryControls = {
  previewingEntryId: HistoryEntryId | null
  rollbackEntryId: HistoryEntryId | null
  previewEntry: (entryId: HistoryEntryId | null) => void
  requestRollback: (entryId: HistoryEntryId | null) => void
  clearPreview: () => void
  clearRollback: () => void
  clearItemSession: () => void
}

function useLiveResourceHistoryControls(itemId: ResourceId | null): LiveResourceHistoryControls {
  const [state, setState] = useState<LiveResourceHistoryControlState>({
    itemId: null,
    previewingEntryId: null,
    rollbackEntryId: null,
  })
  const previewEntry = useCallback(
    (entryId: HistoryEntryId | null) => {
      if (!itemId) return
      setState((prev) => ({
        itemId,
        previewingEntryId: entryId,
        rollbackEntryId: prev.itemId === itemId ? prev.rollbackEntryId : null,
      }))
    },
    [itemId],
  )
  const requestRollback = useCallback(
    (entryId: HistoryEntryId | null) => {
      if (!itemId) return
      setState((prev) => ({
        itemId,
        previewingEntryId: prev.itemId === itemId ? prev.previewingEntryId : null,
        rollbackEntryId: entryId,
      }))
    },
    [itemId],
  )
  const clearPreview = useCallback(() => {
    setState((prev) => (prev.itemId === itemId ? { ...prev, previewingEntryId: null } : prev))
  }, [itemId])
  const clearRollback = useCallback(() => {
    setState((prev) => (prev.itemId === itemId ? { ...prev, rollbackEntryId: null } : prev))
  }, [itemId])
  const clearItemSession = useCallback(() => {
    setState((prev) =>
      prev.itemId === itemId
        ? { itemId: null, previewingEntryId: null, rollbackEntryId: null }
        : prev,
    )
  }, [itemId])
  const isCurrentItemSession = state.itemId === itemId

  return {
    previewingEntryId: isCurrentItemSession ? state.previewingEntryId : null,
    rollbackEntryId: isCurrentItemSession ? state.rollbackEntryId : null,
    previewEntry,
    requestRollback,
    clearPreview,
    clearRollback,
    clearItemSession,
  }
}

function useLiveRuntimeSharing({
  campaign,
  canUseDmWorkspaceActions,
  operations,
  workspaceMode,
}: {
  campaign: LiveCampaign
  canUseDmWorkspaceActions: boolean
  operations: LiveSidebarItemsShareOperations
  workspaceMode: LiveWorkspaceMode
}) {
  const campaignMembers = useCampaignMembers()
  const playerMembers =
    campaignMembers.data?.filter((member) => member.role === CAMPAIGN_MEMBER_ROLE.Player) ?? []
  const participants = playerMembers.map(toEditorShareParticipant)

  return createWizardEditorSharingSource({
    blocks: canUseDmWorkspaceActions
      ? {
          status: 'available',
          useBlocksShare: useLiveBlocksShare,
        }
      : undefined,
    items: canUseDmWorkspaceActions
      ? {
          status: 'available',
          renderItemsShareState: (items, render) =>
            createElement(LiveSidebarItemsShareState, { items, operations, render }),
          setDefaultPermission: (items, permissionLevel) =>
            executeShareCommand(
              () =>
                operations.setDefaultPermission({
                  itemIds: items.map((item) => item.id),
                  permissionLevel,
                }),
              'Failed to update share',
            ),
          setParticipantPermission: (items, participantId, permissionLevel) =>
            executeShareCommand(
              () =>
                operations.setParticipantPermission({
                  itemIds: items.map((item) => item.id),
                  participantId,
                  permissionLevel,
                }),
              'Failed to update participant share',
            ),
        }
      : undefined,
    unavailableReason: 'insufficient_authority',
    viewAsParticipant: {
      canUse: Boolean(campaign.isDm),
      isPending: campaignMembers.isPending,
      participants,
      selectedParticipantId: workspaceMode.viewAsPlayerId,
      setSelectedParticipantId: (participantId) =>
        workspaceMode.setViewAsPlayerId(participantId as typeof workspaceMode.viewAsPlayerId),
    },
  })
}

function canUseDmWorkspaceAuthority(actor: WizardEditorWorkspaceActor | null): boolean {
  return actor?.kind === 'owner'
}

function useLiveRuntimeNavigation({
  campaign,
  canCreateItems,
  catalog,
  currentItem,
  openExternalUrl,
  openSeparateItem,
}: {
  campaign: LiveCampaign
  canCreateItems: boolean
  catalog: LiveFileSystemModel['catalog']
  currentItem: LiveCurrentItem
  openExternalUrl: LiveWorkspaceExternalUrlNavigation
  openSeparateItem: LiveWorkspaceSeparateItemNavigation
}) {
  const { clearWorkspaceContent, navigateToItem, navigateToTrash, openLastWorkspaceItem } =
    useLiveWorkspaceNavigation()
  const { setLastSelectedItem } = useLastWorkspaceItem()
  const createdItemSlugsByIdRef = useRef(new Map<string, WizardEditorResourceSlug>())
  const requestedSlug = currentItem.requestedSlug
  const currentNavigationState = resolveWizardEditorNavigationState({
    canCreateDashboard: canCreateItems,
    resource: currentItem.item ? createWizardEditorResource(currentItem.item.id) : null,
    isResourceRequested: Boolean(requestedSlug),
    isWorkspaceLoaded: campaign.isCampaignLoaded,
    trashRequested: currentItem.isTrashRequested,
  })
  const completeNavigation = async (navigate: () => void | Promise<unknown>) => {
    await navigate()
    return { status: 'completed' as const }
  }
  const openItem: WizardEditorNavigation['openItem'] = async (resource, options) => {
    const itemId = getWizardEditorResourceId(resource)
    const createdSlug = createdItemSlugsByIdRef.current.get(itemId)
    const item = createdSlug ? null : catalog.getVisibleItemById(itemId)
    const slug = createdSlug ?? item?.slug
    if (!slug) return { status: 'unavailable', reason: 'resource_not_visible' }
    setLastSelectedItem(slug)
    if (options?.target === 'separate') {
      openSeparateItem({
        heading: options.heading,
        itemSlug: slug,
      })
      return { status: 'completed' }
    }
    return await completeNavigation(() => navigateToItem(slug, options))
  }

  return {
    navigateToItem,
    navigation: {
      canOpenItemsSeparately: { status: 'available' as const },
      current: currentNavigationState,
      openCreateDashboard: () => completeNavigation(clearWorkspaceContent),
      openDefaultItem: () => completeNavigation(openLastWorkspaceItem),
      openItem,
      openExternalUrl: (url: string) => completeNavigation(() => openExternalUrl(url)),
      openTrash: () => completeNavigation(navigateToTrash),
    },
    onItemSlugChange: (itemId: string, slug: WizardEditorResourceSlug | null) => {
      if (slug === null) {
        createdItemSlugsByIdRef.current.delete(itemId)
        return
      }
      createdItemSlugsByIdRef.current.set(itemId, slug)
    },
    setLastSelectedItem,
  }
}

function useLiveRuntimeCurrentState({
  campaign,
  catalog,
  currentItem,
  load,
}: {
  campaign: LiveCampaign
  catalog: LiveFileSystemModel['catalog']
  currentItem: LiveCurrentItem
  load: LiveFileSystemModel['load']
}): WizardEditorCurrentResourceState {
  const availabilityMetadataSource = createWizardEditorResourceAvailabilityMetadataSource({
    catalog,
    load,
  })
  const currentItemAvailabilityMetadataSource = createCurrentItemAvailabilityMetadataSource(
    availabilityMetadataSource,
    currentItem.item,
  )
  const sourceAvailabilityState = useLiveSidebarItemAvailabilityState({
    accessStatus: currentItem.accessStatus,
    lookup: { kind: 'slug', slug: currentItem.requestedSlug },
    metadataSource: currentItemAvailabilityMetadataSource,
    readableItem: currentItem.contentItem,
    readableItemLoading: currentItem.isLoading,
    readableItemError: currentItem.itemError,
    subject: 'item',
    fallbackLabel: getRequestedItemFallbackLabel(currentItem.requestedSlug),
  })
  const availabilityState: WizardEditorCurrentResourceState['availabilityState'] =
    campaign.isCampaignLoaded
      ? sourceAvailabilityState
      : { status: 'loading', label: sourceAvailabilityState.label }

  return {
    item: currentItem.item,
    contentItem: currentItem.contentItem,
    availabilityState,
  }
}

function useLiveRuntimeContentSessions({
  catalog,
  permissions,
  workspaceId,
}: {
  catalog: LiveFileSystemModel['catalog']
  permissions: Pick<WizardEditorPermissionSource, 'canMutateItem'>
  workspaceId: string
}) {
  const file = useLiveFileSessionAdapter({
    canReplaceFile: (fileItem) => permissions.canMutateItem(fileItem, PERMISSION_LEVEL.EDIT),
    getItemById: (fileId) => {
      const item = catalog.getKnownItemById(fileId as ResourceId)
      return isWizardEditorFileItem(item) ? item : null
    },
  })
  const map = useLiveGameMapSessionSource()
  const note = useLiveNoteSessionPorts({
    workspaceId,
    canEditNote: (noteItem) => permissions.canMutateItem(noteItem, PERMISSION_LEVEL.EDIT),
    getNoteSlugById: (noteId) => catalog.getKnownItemById(noteId)?.slug,
  })
  const noteHeadings = useLiveNoteHeadingSessionPorts()
  const notePlayback = useLiveNotePlaybackSessionPorts()
  const noteValues = useLiveNoteValueSessionPorts()

  return { file, map, note, noteHeadings, notePlayback, noteValues }
}

function getRequestedItemFallbackLabel(slug: WizardEditorResourceSlug | null) {
  const label = slug?.trim()
  return label || 'Item'
}

function createCurrentItemAvailabilityMetadataSource(
  source: WizardEditorResourceAvailabilityMetadataSource,
  item: WizardEditorItem | null,
): WizardEditorResourceAvailabilityMetadataSource {
  if (!item) return source

  return {
    ...source,
    participant: {
      getItemById: (itemId) => (itemId === item.id ? item : source.participant.getItemById(itemId)),
      getItemBySlug: (slug) => (item.slug === slug ? item : source.participant.getItemBySlug(slug)),
    },
  }
}
