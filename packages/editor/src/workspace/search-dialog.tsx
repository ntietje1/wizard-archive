import type { ResourceId } from '../resources/domain-id'
import { useEffect } from 'react'

import { SearchDialog } from '../search/dialog'
import type { ItemSearchInput, ItemSearchState } from '../search/model'
import { useWorkspaceRuntimeSearchDialogController } from './search-controller'
import type { FileSystemItemCreateOperations } from '../filesystem/item-operation-contracts'
import type {
  ResourceContentSource,
  ResourceContentState,
} from '../filesystem/resource-content-source'
import { createRuntimeNoteContentSource } from '../notes/runtime-content-source'
import type { RuntimeNoteContentSourceInput } from '../notes/runtime-content-source'
import type {
  NoteHeadingSessionPorts,
  NotePlaybackSessionPorts,
  NoteSessionPorts,
  NoteValueSessionPorts,
} from '../notes/workspace-session-source'
import { useWorkspaceRuntimeSearchRequestState } from './search-request-state'

type WorkspaceSearchDialogSearchSource =
  | {
      status: 'unsupported'
      reason: 'not_available' | 'not_implemented'
    }
  | {
      status: 'available'
      ensureSearchState: (input: ItemSearchInput) => void
      getSearchState: (input: ItemSearchInput) => ItemSearchState
    }

type WorkspaceRuntimeSearchDialogInput = {
  navigation: RuntimeNoteContentSourceInput['navigation']
  filesystem: {
    operations: FileSystemItemCreateOperations
    resourceContent: ResourceContentSource
    search: WorkspaceSearchDialogSearchSource
  } & RuntimeNoteContentSourceInput['filesystem']
  sessions: {
    note: Pick<NoteSessionPorts, 'document'>
    noteHeadings: NoteHeadingSessionPorts
    notePlayback: NotePlaybackSessionPorts
    noteValues: NoteValueSessionPorts
  }
}

type AvailableWorkspaceSearchDialogSearch = Extract<
  WorkspaceSearchDialogSearchSource,
  { status: 'available' }
>

export function WorkspaceRuntimeSearchDialog({
  runtime,
}: {
  runtime: WorkspaceRuntimeSearchDialogInput
}) {
  const search = runtime.filesystem.search
  const resourceContent = runtime.filesystem.resourceContent
  if (search.status !== 'available') {
    return <UnsupportedWorkspaceRuntimeSearchDialog runtime={runtime} />
  }

  return (
    <AvailableWorkspaceRuntimeSearchDialog
      resourceContent={resourceContent}
      runtime={runtime}
      search={search}
    />
  )
}

const unsupportedSearchState = {
  bodySearchError: null,
  bodySearchPending: false,
  recentItems: [],
  results: [],
} satisfies ItemSearchState

const unsupportedPreviewState = {
  status: 'not_found',
  label: 'Page',
  error: null,
  folderChildren: [],
  isLoading: false,
  item: undefined,
} satisfies ResourceContentState

function UnsupportedWorkspaceRuntimeSearchDialog({
  runtime,
}: {
  runtime: WorkspaceRuntimeSearchDialogInput
}) {
  const request = useWorkspaceRuntimeSearchRequestState()
  const controller = useWorkspaceRuntimeSearchDialogController({
    request,
    runtime,
    searchState: unsupportedSearchState,
  })
  const hasCommands = controller.displayItems.some((item) => item.kind === 'command')

  return (
    <SearchDialog
      controller={{
        ...controller,
        emptyStateMessage: hasCommands ? undefined : 'Search is not available in this workspace.',
        inlineStatusMessage: hasCommands
          ? 'Search is unavailable. Showing commands only.'
          : undefined,
        status: 'Search unavailable',
      }}
      embeddedNoteContentSource={
        createRuntimeNoteContentSource({
          ...runtime,
          sessions: {
            noteDocument: runtime.sessions.note.document,
            noteHeadings: runtime.sessions.noteHeadings.headings,
            notePlayback: runtime.sessions.notePlayback.playback,
            noteValues: runtime.sessions.noteValues.values,
          },
        }).embeddedNotes
      }
      previewState={unsupportedPreviewState}
    />
  )
}

function AvailableWorkspaceRuntimeSearchDialog({
  resourceContent,
  runtime,
  search,
}: {
  resourceContent: ResourceContentSource
  runtime: WorkspaceRuntimeSearchDialogInput
  search: AvailableWorkspaceSearchDialogSearch
}) {
  const request = useWorkspaceRuntimeSearchRequestState()
  const searchState = useRuntimeSearchState(search, request.debouncedQuery)
  const controller = useWorkspaceRuntimeSearchDialogController({
    request,
    runtime,
    searchState,
  })
  const previewState = useRuntimeResourceContentState(
    resourceContent,
    controller.selectedResult?.item.id,
    controller.selectedResult?.item.name,
  )

  return (
    <SearchDialog
      controller={controller}
      embeddedNoteContentSource={
        createRuntimeNoteContentSource({
          ...runtime,
          sessions: {
            noteDocument: runtime.sessions.note.document,
            noteHeadings: runtime.sessions.noteHeadings.headings,
            notePlayback: runtime.sessions.notePlayback.playback,
            noteValues: runtime.sessions.noteValues.values,
          },
        }).embeddedNotes
      }
      previewState={previewState}
    />
  )
}

function useRuntimeSearchState(
  search: AvailableWorkspaceSearchDialogSearch,
  query: string,
): ItemSearchState {
  useEffect(() => {
    search.ensureSearchState({ query })
  }, [query, search])

  return search.getSearchState({ query })
}

function useRuntimeResourceContentState(
  resourceContent: ResourceContentSource,
  itemId: ResourceId | null | undefined,
  fallbackLabel: string | undefined,
): ResourceContentState {
  useEffect(() => {
    if (!itemId || resourceContent.status !== 'available') return
    resourceContent.ensureContentState(itemId)
  }, [itemId, resourceContent])

  if (resourceContent.status !== 'available') {
    return {
      ...unsupportedPreviewState,
      label: fallbackLabel ?? unsupportedPreviewState.label,
    }
  }
  return resourceContent.getContentState(itemId, fallbackLabel)
}
