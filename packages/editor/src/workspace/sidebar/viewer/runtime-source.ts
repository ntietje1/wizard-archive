import type { ResourceId } from '../../../resources/domain-id'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import type { FileSession } from '../../../files/session-contract'
import type { FileItemWithContent } from '../../../files/item-contract'
import { createRuntimeFolderViewerSource } from '../../../filesystem/cards/runtime-source'
import type { RuntimeFolderViewerSourceInput } from '../../../filesystem/cards/runtime-source'
import { createRuntimeNoteContentSource } from '../../../notes/runtime-content-source'
import type { RuntimeNoteContentSourceInput } from '../../../notes/runtime-content-source'
import type { WorkspaceNavigation } from '../../runtime'
import type { WorkspaceViewStateStores } from '../../runtime-host'
import type { NoteScrollRequest, RuntimeNoteContentSource } from '../../../notes/runtime'

import type { NoteEditorSetParticipantPermission } from '../../../notes/viewer/note-editor-source'
import type { EmbedTargetOperationFileSystem } from '../../../embeds/target-operations'
import { isCanvasSidebarItemEmbedRichTextEditable } from '../../../embeds/utils/canvas-resource-capabilities'
import { createWorkspaceMapRenderPins } from '../../../game-maps/viewer/render-pins'
import type { MapSession } from '../../../game-maps/session-contract'
import { createWorkspaceCanvasContextMenuSource } from '../../../canvas/runtime/context-menu/workspace-source'
import type { CanvasContextMenuRuntime } from '../../../canvas/runtime/context-menu/canvas-context-menu-runtime'
import type {
  CanvasEmbeddedSessionPorts,
  CanvasSessionPorts,
} from '../../../canvas/workspace-session-source'
import type { PreviewUploadCapability } from '../../../files/preview-upload-contract'
import type {
  NoteHeadingSessionPorts,
  NotePlaybackSessionPorts,
  NoteSessionPorts,
  NoteValueSessionPorts,
} from '../../../notes/workspace-session-source'
import type { SidebarItemViewerSource } from './sidebar-item-viewer'
import type { FileSystemPermissions } from '../../../filesystem/permissions'
import type { ResourceCatalog } from '../../../filesystem/catalog'
import type { ResourceShareSource, ShareActionResult } from '../../../sharing/contracts'

type RuntimeSidebarItemViewerFileSystem = RuntimeFolderViewerSourceInput['filesystem'] &
  RuntimeNoteContentSourceInput['filesystem'] &
  EmbedTargetOperationFileSystem &
  CanvasContextMenuRuntime['filesystem'] & {
    operations: RuntimeFolderViewerSourceInput['filesystem']['operations'] &
      RuntimeNoteContentSourceInput['filesystem']['operations']
    permissions: RuntimeFolderViewerSourceInput['filesystem']['permissions'] &
      RuntimeNoteContentSourceInput['filesystem']['permissions'] &
      CanvasContextMenuRuntime['filesystem']['permissions'] &
      Pick<FileSystemPermissions, 'workspaceMode'>
    sharing: RuntimeNoteContentSourceInput['filesystem']['sharing'] & {
      items: ResourceShareSource
    }
  }

type RuntimeNoteContentWorkspaceInput = Omit<RuntimeNoteContentSourceInput, 'sessions'> & {
  sessions: {
    note: Pick<NoteSessionPorts, 'document'>
    noteHeadings: NoteHeadingSessionPorts
    notePlayback: NotePlaybackSessionPorts
    noteValues: NoteValueSessionPorts
  }
}

type RuntimeSidebarItemViewerSessions = RuntimeNoteContentWorkspaceInput['sessions'] & {
  canvas: CanvasSessionPorts
  canvasEmbedded: CanvasEmbeddedSessionPorts
  canvasPreviewUpload: PreviewUploadCapability
  file: FileSession
  map: MapSession
}

export type RuntimeSidebarItemViewerSourceInput = {
  navigation: RuntimeFolderViewerSourceInput['navigation'] &
    RuntimeNoteContentSourceInput['navigation']
  filesystem: RuntimeSidebarItemViewerFileSystem
  sessions: RuntimeSidebarItemViewerSessions
}

type RuntimeMapViewerSourceInput = {
  navigation: Pick<WorkspaceNavigation, 'openItem'>
  filesystem: {
    permissions: Pick<FileSystemPermissions, 'canAccessItem' | 'canMutateItem'>
  }
  sessions: Pick<RuntimeSidebarItemViewerSessions, 'map'>
}

type RuntimeNoteEditorSourceInput = RuntimeNoteContentWorkspaceInput & {
  filesystem: RuntimeNoteContentWorkspaceInput['filesystem'] & {
    catalog: RuntimeNoteContentSourceInput['filesystem']['catalog'] &
      Pick<ResourceCatalog, 'getKnownItemById'>
    permissions: RuntimeNoteContentSourceInput['filesystem']['permissions'] &
      Pick<FileSystemPermissions, 'workspaceMode'>
    sharing: RuntimeNoteContentWorkspaceInput['filesystem']['sharing'] & {
      items: ResourceShareSource
    }
  }
}

type RuntimeFileViewerSourceInput = {
  filesystem: {
    permissions: Pick<FileSystemPermissions, 'canMutateItem'>
  }
  sessions: Pick<RuntimeSidebarItemViewerSessions, 'file'>
}

export function createRuntimeSidebarItemViewerSource(
  runtime: RuntimeSidebarItemViewerSourceInput,
  options: {
    noteScrollRequest: NoteScrollRequest
    showItemInSidebar: (itemId: ResourceId) => void
    viewStateStores: WorkspaceViewStateStores
  },
): SidebarItemViewerSource {
  return {
    resolveCanvas: () =>
      createRuntimeCanvasViewerSource(runtime, {
        showItemInSidebar: options.showItemInSidebar,
        viewStateStores: options.viewStateStores,
      }),
    resolveFile: () => createRuntimeFileViewerSource(runtime),
    resolveFolder: () => createRuntimeFolderViewerSource(runtime),
    resolveMap: () => createRuntimeMapViewerSource(runtime, options.viewStateStores),
    resolveNote: () =>
      createRuntimeNoteEditorSource(runtime, {
        noteScrollRequest: options.noteScrollRequest,
        viewStateStores: options.viewStateStores,
      }),
  }
}

function createRuntimeCanvasViewerSource(
  runtime: RuntimeSidebarItemViewerSourceInput,
  options: {
    showItemInSidebar: (itemId: ResourceId) => void
    viewStateStores: WorkspaceViewStateStores
  },
): ReturnType<SidebarItemViewerSource['resolveCanvas']> {
  const canvasSession = runtime.sessions.canvas
  const renderMapPins = createWorkspaceMapRenderPins(runtime.filesystem.permissions)
  const noteContentSource = createRuntimeSidebarNoteContentSource(runtime)
  return {
    embedResolution: {
      resolveEmbeddedMapState: renderMapPins,
    },
    isSidebarItemEmbedRichTextEditable: (itemId) =>
      isCanvasSidebarItemEmbedRichTextEditable(
        runtime.filesystem.catalog.getVisibleItemById(itemId),
      ),
    noteDocumentSource: noteContentSource.document,
    noteEmbeddedNoteContentSource: noteContentSource.embeddedNotes,
    noteEmbedTargetSource: noteContentSource.embedTargets,
    noteLinkCreationSource: noteContentSource.linkCreation,
    noteLinkNavigationSource: noteContentSource.linkNavigation,
    noteLinkResolutionSource: noteContentSource.linkResolution,
    notePlaybackSource: noteContentSource.playback,
    notePermissionSource: noteContentSource.permissions,
    noteSharingSource: noteContentSource.sharing,
    noteValueReferences: noteContentSource.valueReferences,
    noteValueStateSource: noteContentSource.valueState,
    noteWikiLinkSource: noteContentSource.wikiLinks,
    resolveContextMenuSource: (input) =>
      createWorkspaceCanvasContextMenuSource({
        runtime: {
          filesystem: runtime.filesystem,
          navigation: {
            openItem: async (itemId, navigationOptions) => {
              await runtime.navigation.openItem(itemId, navigationOptions)
            },
            openExternalUrl: async (url) => {
              await runtime.navigation.openExternalUrl(url)
            },
          },
        },
        session: input.session,
        showItemInSidebar: options.showItemInSidebar,
      }),
    previewUpload: runtime.sessions.canvasPreviewUpload,
    viewportStore: options.viewStateStores.canvasViewport,
    useCanvasDocumentSession: canvasSession.document.useCanvasDocumentSession,
  }
}

function createRuntimeMapViewerSource(
  runtime: RuntimeMapViewerSourceInput,
  viewStateStores: WorkspaceViewStateStores,
): ReturnType<SidebarItemViewerSource['resolveMap']> {
  const { permissions } = runtime.filesystem
  const { sessions } = runtime

  return {
    canEditMap: (map) => permissions.canMutateItem(map, PERMISSION_LEVEL.EDIT),
    canViewItem: (item) => (item ? permissions.canAccessItem(item, PERMISSION_LEVEL.VIEW) : false),
    createMapPins: sessions.map.pins.create,
    removeMapPin: sessions.map.pins.remove,
    updateMapImage: sessions.map.updateMapImage,
    updateMapPin: sessions.map.pins.update,
    updateMapPinVisibility: sessions.map.pins.setVisibility,
    openItem: async (itemId, navigationOptions) => {
      await runtime.navigation.openItem(itemId, navigationOptions)
    },
    resolveEmbeddedMapState: createWorkspaceMapRenderPins(permissions),
    transformStore: viewStateStores.mapTransform,
  }
}

function createRuntimeNoteEditorSource(
  runtime: RuntimeNoteEditorSourceInput,
  options: {
    noteScrollRequest: NoteScrollRequest
    viewStateStores: WorkspaceViewStateStores
  },
): ReturnType<SidebarItemViewerSource['resolveNote']> {
  const permissions = runtime.filesystem.permissions
  const sharing = runtime.filesystem.sharing
  const contentSource = createRuntimeSidebarNoteContentSource(runtime)
  const noteSharing =
    sharing.items.status === 'available'
      ? {
          status: 'available' as const,
          participants:
            sharing.viewAsParticipant.status === 'available'
              ? sharing.viewAsParticipant.participants
              : [],
          setParticipantPermission: createRuntimeNoteParticipantPermissionSetter(runtime),
        }
      : { status: 'unsupported' as const }

  return {
    canEdit: permissions.canEdit,
    editorMode: permissions.workspaceMode,
    documentSource: contentSource.document,
    embeddedNoteContentSource: contentSource.embeddedNotes,
    embedTargetSource: contentSource.embedTargets,
    linkCreationSource: contentSource.linkCreation,
    linkNavigationSource: contentSource.linkNavigation,
    linkResolutionSource: contentSource.linkResolution,
    noteValueReferences: contentSource.valueReferences,
    noteValueStateSource: contentSource.valueState,
    permissionSource: contentSource.permissions,
    playbackSource: contentSource.playback,
    scrollRequest: options.noteScrollRequest,
    scrollStore: options.viewStateStores.noteScroll,
    sharing: noteSharing,
    sharingSource: contentSource.sharing,
    wikiLinkSource: contentSource.wikiLinks,
  }
}

function createRuntimeSidebarNoteContentSource(
  runtime: RuntimeNoteContentWorkspaceInput,
): RuntimeNoteContentSource {
  return createRuntimeNoteContentSource({
    ...runtime,
    sessions: {
      noteDocument: runtime.sessions.note.document,
      noteHeadings: runtime.sessions.noteHeadings.headings,
      notePlayback: runtime.sessions.notePlayback.playback,
      noteValues: runtime.sessions.noteValues.values,
    },
  })
}

function createRuntimeNoteParticipantPermissionSetter(
  runtime: RuntimeNoteEditorSourceInput,
): NoteEditorSetParticipantPermission {
  return async ({ participantId, itemIds, permissionLevel }) => {
    const sharing = runtime.filesystem.sharing.items
    if (sharing.status !== 'available') {
      throw new Error('Sidebar item sharing is not available')
    }
    const items = itemIds.map((itemId) => {
      const item = runtime.filesystem.catalog.getKnownItemById(itemId)
      if (!item) throw new Error(`Cannot share unknown sidebar item: ${itemId}`)
      return item
    })
    const result = await sharing.setParticipantPermission(items, participantId, permissionLevel)
    assertShareActionCompleted(result)
  }
}

function assertShareActionCompleted(result: ShareActionResult): void {
  if (result.status === 'completed') return
  if (result.status === 'failed' && result.error) throw result.error
  throw new Error('Sidebar item sharing did not complete')
}

function createRuntimeFileViewerSource(
  runtime: RuntimeFileViewerSourceInput,
): ReturnType<SidebarItemViewerSource['resolveFile']> {
  const fileSession = runtime.sessions.file
  return {
    canReplaceFile: (file: FileItemWithContent) =>
      runtime.filesystem.permissions.canMutateItem(file, PERMISSION_LEVEL.EDIT),
    maxUploadBytes: fileSession.maxUploadBytes,
    replaceFile: fileSession.replaceFile,
    resolveFile: fileSession.resolveFile,
  }
}
