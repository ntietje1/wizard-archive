import type {
  EmbeddedNoteContentSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
  RuntimeNoteContentSource,
} from './runtime'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from './value-runtime-model'
import type { WorkspaceNavigation } from '../workspace/runtime'
import type {
  NoteHeadingSessionPorts,
  NotePlaybackSessionPorts,
  NoteSessionPorts,
} from './workspace-session-source'
import type { FileSystemPaths } from '../filesystem/catalog-paths'
import type { ResourceCatalog } from '../filesystem/catalog'
import type { BlocksShareSource, ViewAsParticipantCapability } from '../sharing/contracts'
import type { FileSystemLoadState } from '../filesystem/load-state'
import { createWorkspaceEmbedTargetOperations } from '../embeds/target-operations'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import { formatItemAncestorBreadcrumb } from '../search/model'
import { getVisibleNoteBlocks } from './visibility'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import {
  createWikiLinkAutocompleteModelData,
  getWikiLinkAutocompleteLoadRequest,
  useWikiLinkAutocompleteState,
} from './wiki-link/autocomplete-source'
import type { WikiLinkAutocompleteItemSource } from './wiki-link/autocomplete-model'
import type { FileSystemPermissions } from '../filesystem/permissions'
import type {
  FileSystemItemCreateValidationOperations,
  FileSystemItemImportOperations,
} from '../filesystem/item-operation-contracts'
type RuntimeNoteFileSystemOperations = FileSystemItemImportOperations &
  FileSystemItemCreateValidationOperations

export type RuntimeNoteContentSourceInput = {
  navigation: Pick<WorkspaceNavigation, 'openExternalUrl' | 'openItem'>
  filesystem: {
    catalog: Pick<
      ResourceCatalog,
      'getVisibleAncestors' | 'getVisibleItemById' | 'getVisibleRoots' | 'queryVisibleItems'
    >
    load: Pick<FileSystemLoadState, 'activeError' | 'activeStatus'>
    operations: RuntimeNoteFileSystemOperations
    paths: Pick<
      FileSystemPaths,
      | 'getVisibleItemLinkPath'
      | 'resolveVisibleFolderPath'
      | 'resolveVisibleItemPath'
      | 'resolveVisibleNotePath'
    >
    permissions: Pick<
      FileSystemPermissions,
      'canAccessItem' | 'canEdit' | 'getMemberItemPermissionLevel'
    >
    sharing: {
      blocks: BlocksShareSource
      viewAsParticipant: ViewAsParticipantCapability
    }
  }
  sessions: {
    noteDocument: Pick<NoteSessionPorts['document'], 'useCollaborationSession'>
    noteHeadings: Pick<NoteHeadingSessionPorts['headings'], 'useNoteHeadings'>
    notePlayback: Pick<NotePlaybackSessionPorts['playback'], 'getCollaborationPlayback'>
    noteValues: NoteValueRuntimeStateSource
  }
}

export function createRuntimeNoteContentSource(
  runtime: RuntimeNoteContentSourceInput,
): RuntimeNoteContentSource {
  const { catalog, operations, permissions } = runtime.filesystem
  const sharing = runtime.filesystem.sharing
  const { noteDocument, noteHeadings, notePlayback, noteValues } = runtime.sessions
  const paths = runtime.filesystem.paths
  const selectedViewAsPlayerId =
    sharing.viewAsParticipant.status === 'available'
      ? sharing.viewAsParticipant.selectedParticipantId
      : undefined
  const noteValueReferences: NoteValueReferences = {
    getNoteCandidates: () =>
      catalog.queryVisibleItems({ type: RESOURCE_TYPES.notes }).map((item) => ({
        noteId: item.id,
        title: item.name,
        path: paths.getVisibleItemLinkPath(item).join('/'),
      })),
    resolveNoteIdByPath: ({ notePathRaw, sourceNoteId }) =>
      paths.resolveVisibleNotePath({
        text: notePathRaw,
        sourceItemId: sourceNoteId,
      })?.id ?? null,
  }
  const wikiLinkItemSource: WikiLinkAutocompleteItemSource = {
    getItemBreadcrumbs: (item) =>
      formatItemAncestorBreadcrumb(catalog.getVisibleAncestors(item.id)),
    getItemLinkPath: paths.getVisibleItemLinkPath,
    queryItems: (input) => [...catalog.queryVisibleItems(input)],
    resolveFolderPath: paths.resolveVisibleFolderPath,
    resolveItemPath: paths.resolveVisibleItemPath,
    resolveNotePath: paths.resolveVisibleNotePath,
  }
  const embeddedNotes: EmbeddedNoteContentSource = {
    getEmbeddedNoteContent: (note) =>
      permissions.canAccessItem(note, PERMISSION_LEVEL.EDIT) && !selectedViewAsPlayerId
        ? note.content
        : getVisibleNoteBlocks(note, {
            getMemberItemPermissionLevel: permissions.getMemberItemPermissionLevel,
            viewAsPlayerId: selectedViewAsPlayerId,
          }),
  }
  const linkNavigation: NoteLinkNavigationSource = {
    getSourceParentId: (sourceNoteId) => catalog.getVisibleItemById(sourceNoteId)?.parentId,
    openExternalLink: runtime.navigation.openExternalUrl,
    openInternalLink: ({ heading, itemId }) => runtime.navigation.openItem(itemId, { heading }),
    openInternalLinkSeparately: ({ heading, itemId }) =>
      runtime.navigation.openItem(itemId, {
        heading,
        target: 'separate',
      }),
  }
  const linkResolution: NoteLinkResolutionSource = {
    revision: createLinkResolutionRevision(catalog.queryVisibleItems()),
    resolveItemPath: ({ pathKind, pathSegments, sourceNoteId }) =>
      pathSegments.length === 0 && sourceNoteId
        ? (catalog.getVisibleItemById(sourceNoteId) ?? null)
        : paths.resolveVisibleItemPath({
            pathKind,
            pathSegments,
            sourceItemId: sourceNoteId,
          }),
  }
  const linkCreation = permissions.canEdit
    ? {
        createLinkedNote: operations.createItem,
        validateCreateItem: operations.validateCreateItem,
      }
    : null

  return {
    document: {
      useNoteCollaborationSession: noteDocument.useCollaborationSession,
    },
    embeddedNotes,
    embedTargets: {
      embedTargetOperations: createWorkspaceEmbedTargetOperations(runtime.filesystem),
    },
    linkCreation,
    linkNavigation,
    linkResolution,
    playback: notePlayback.getCollaborationPlayback
      ? { getNoteCollaborationPlayback: notePlayback.getCollaborationPlayback }
      : {},
    sharing: {
      blocks: sharing.blocks,
    },
    wikiLinks: {
      useWikiLinkAutocompleteModelData: (input) => {
        const autocomplete = useWikiLinkAutocompleteState({
          itemSource: wikiLinkItemSource,
          ...input,
        })
        const loadRequest = getWikiLinkAutocompleteLoadRequest(autocomplete)
        const headingsLoad = noteHeadings.useNoteHeadings(loadRequest.headingsNoteId)
        const valuesLoad = noteValues.useNoteValueStates(
          loadRequest.persistedValuesNoteId ? [loadRequest.persistedValuesNoteId] : [],
        )
        return createWikiLinkAutocompleteModelData({
          ...autocomplete,
          headings: headingsLoad.headings,
          headingsPending: headingsLoad.status === 'pending',
          persistedValues: valuesLoad.states,
          persistedValuesPending: valuesLoad.status === 'pending',
        })
      },
    },
    permissions: {
      canAccessItem: permissions.canAccessItem,
      getMemberItemPermissionLevel: permissions.getMemberItemPermissionLevel,
      selectedViewAsPlayerId,
    },
    valueReferences: noteValueReferences,
    valueState: noteValues,
  }
}

function createLinkResolutionRevision(
  items: ReadonlyArray<{
    id: string
    type: string
    name: string
    parentId: string | null
    color?: string | null
  }>,
) {
  return items
    .map((item) =>
      [item.id, item.type, item.name, item.parentId ?? '', item.color ?? ''].join('\u0000'),
    )
    .join('\u0001')
}
