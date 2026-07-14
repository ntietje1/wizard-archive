import {
  createWizardEditorCatalogIoSource,
  createWizardEditorCatalogNavigation,
  createWizardEditorCatalogResourceSource,
  createWizardEditorCatalogSearchSource,
  createWizardEditorRuntime,
  createWizardEditorRuntimeSources,
  createWizardEditorUnsupportedHistorySource,
  resolveWizardEditorMapImage,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorCanvasEmbeddedSessionPorts,
  WizardEditorCanvasSessionPorts,
  WizardEditorDocumentSourceInput,
  WizardEditorFileContentSourceInput,
  WizardEditorNavigationState,
  WizardEditorNoteHeadingSessionPorts,
  WizardEditorNotePlaybackSessionPorts,
  WizardEditorNoteSessionPorts,
  WizardEditorNoteValueSessionPorts,
} from '@wizard-archive/editor/adapter'
import type { WorkspaceRuntime } from '@wizard-archive/editor/runtime'
import type { Dispatch } from 'react'
import type { WorkspaceMode } from 'shared/workspace/workspace-mode'

import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { LocalWorkspaceAction } from './local-workspace-model'
import { requireLocalCanvasPayload, requireLocalFilePayloadForItem } from './local-workspace-model'
import { createLocalWorkspaceActor, getLocalCampaignMemberId } from './local-filesystem-snapshot'
import type { LocalFileSystemSnapshot } from './local-filesystem-snapshot'
import { createLocalGameMapSessionSource } from './local-game-map-session-source'
import { createLocalFileSystemHost } from './local-filesystem-operations'
import { createLocalFilePayload, MAX_LOCAL_IMPORT_BYTES } from './local-operation-utils'
import { canMutateLocalWorkspace } from './local-workspace-capabilities'
import { toEditorShareParticipant } from '~/editor-adapters/sharing/share-participants'

export type LocalWorkspaceSeparateItemNavigation = (input: {
  heading?: string
  itemId: string
}) => void
export type LocalWorkspaceExternalUrlNavigation = (url: string) => void
export type LocalWorkspaceErrorReporter = (error: unknown) => void
type LocalFileSystemAdapterInput = {
  canEdit?: boolean
  canvasEmbedded: WizardEditorCanvasEmbeddedSessionPorts
  canvasPreviewUpload: WizardEditorDocumentSourceInput['canvasPreviewUpload']
  canvasSession: WizardEditorCanvasSessionPorts
  dispatch: Dispatch<LocalWorkspaceAction>
  snapshot: LocalFileSystemSnapshot
  runtimeInstanceId?: string
  workspaceMode: WorkspaceMode
  noteHeadings: WizardEditorNoteHeadingSessionPorts
  notePlayback: WizardEditorNotePlaybackSessionPorts
  noteSession: WizardEditorNoteSessionPorts
  noteValues: WizardEditorNoteValueSessionPorts
  openSeparateItem?: LocalWorkspaceSeparateItemNavigation
  openExternalUrl: LocalWorkspaceExternalUrlNavigation
  reportCreateItemError: LocalWorkspaceErrorReporter
  setNavigation: (navigation: WizardEditorNavigationState) => void
  setSelectedViewAsPlayerId?: (playerId: CampaignMemberId | undefined) => void
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void
}

export function createLocalWorkspaceRuntime({
  canEdit = true,
  canvasEmbedded,
  canvasPreviewUpload,
  canvasSession,
  dispatch,
  snapshot,
  runtimeInstanceId,
  workspaceMode,
  noteHeadings,
  notePlayback,
  noteSession,
  noteValues,
  openSeparateItem,
  openExternalUrl,
  reportCreateItemError,
  setNavigation,
  setSelectedViewAsPlayerId,
  setWorkspaceMode,
}: LocalFileSystemAdapterInput): WorkspaceRuntime {
  const { catalog, current, workspace } = snapshot
  const actor = createLocalWorkspaceActor(workspace)
  const playerMembers = workspace.playerMembers ?? []
  const participants = playerMembers.map((member) => ({
    ...toEditorShareParticipant(member),
    id: getLocalCampaignMemberId(member.id),
  }))
  const canMutateWorkspace = canMutateLocalWorkspace({
    canEdit,
    selectedViewAsPlayerId: workspace.selectedViewAsPlayerId,
  })
  const mapSession = createLocalGameMapSessionSource({
    canEdit: canMutateWorkspace,
    catalog,
    dispatch,
  })
  const filesystemHost = createLocalFileSystemHost({
    canEdit: canMutateWorkspace,
    dispatch,
    runtimeInstanceId,
    workspace,
  })

  const resources = createWizardEditorCatalogResourceSource({
    snapshot,
    permissions: {
      actor,
      canEdit,
      canUseWorkspaceActions: canMutateWorkspace,
      workspaceMode,
      setWorkspaceMode,
    },
  })
  const fileDocument: WizardEditorFileContentSourceInput = {
    canReplaceFile: () => canMutateWorkspace,
    getItemById: (itemId) => catalog.getKnownItemById(itemId as ResourceId),
    maxUploadBytes: MAX_LOCAL_IMPORT_BYTES,
    readOnlyErrorMessage: 'This local workspace is read-only',
    resolveFile: (file) =>
      requireLocalFilePayloadForItem(workspace, {
        id: String(file.id),
        title: file.name,
      }),
    writeFile: async ({ file, fileId }) => {
      dispatch({
        type: 'replaceFile',
        itemId: String(fileId),
        payload: await createLocalFilePayload(file),
      })
    },
  }
  const runtimeSources = createWizardEditorRuntimeSources({
    commands: {
      canCreateItems: canMutateWorkspace,
      clipboardDriver: filesystemHost.clipboardDriver,
      contentInitializers: {
        initializeImportedTextFile: async ({ file, noteId }) => {
          dispatch({ type: 'replaceNoteBody', itemId: String(noteId), body: await file.text() })
        },
      },
      ioCapabilities: { maxUploadBytes: MAX_LOCAL_IMPORT_BYTES },
      resourceCommandDriver: filesystemHost.resourceCommandDriver,
      trashDialogDriver: filesystemHost.trashDialogDriver,
      unavailableReason: 'read_only',
      reportCreateItemError,
    },
    io: createWizardEditorCatalogIoSource(resources, {
      file: fileDocument,
      resolveCanvasDownloadContent: (canvas) =>
        requireLocalCanvasPayload(workspace, String(canvas.id)),
      resolveMapDownloadUrl: (map) => resolveWizardEditorMapImage(map).imageUrl,
    }),
    history: createWizardEditorUnsupportedHistorySource('not_implemented'),
    search: createWizardEditorCatalogSearchSource(resources),
    sharing: {
      unavailableReason: 'not_available',
      viewAsParticipant: {
        canUse: playerMembers.length > 0,
        isPending: false,
        participants,
        selectedParticipantId: workspace.selectedViewAsPlayerId
          ? getLocalCampaignMemberId(workspace.selectedViewAsPlayerId)
          : undefined,
        setSelectedParticipantId: setSelectedViewAsPlayerId
          ? (participantId) => {
              const member = playerMembers.find(
                ({ id }) => getLocalCampaignMemberId(id) === participantId,
              )
              setSelectedViewAsPlayerId(member?.id)
            }
          : undefined,
      },
    },
    resources,
    documents: {
      canvas: canvasSession,
      canvasEmbedded,
      canvasPreviewUpload,
      file: fileDocument,
      map: mapSession,
      note: noteSession,
      noteHeadings,
      notePlayback,
      noteValues,
    },
  })

  return createWizardEditorRuntime({
    workspace: { id: workspace.workspaceId, instanceId: runtimeInstanceId },
    navigation: createWizardEditorCatalogNavigation({
      catalog: resources.catalog,
      current: current.navigation,
      openExternalUrl: (url) => {
        openExternalUrl(url)
        return { status: 'completed' }
      },
      openSeparateItem,
      setNavigation,
    }),
    ...runtimeSources,
  })
}
