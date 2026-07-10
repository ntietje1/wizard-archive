import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { createNote } from '../../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import { getWikiLinkAutocompleteContextFromSource } from '../autocomplete-model'
import { getWikiLinkAutocompleteLoadRequest } from '../autocomplete-source'
import type { WikiLinkAutocompleteItemSource } from '../autocomplete-model'
import type { WorkspaceRuntime } from '../../../workspace/runtime'
import type { NoteValueRuntimeContextValue } from '../../value-block/value-block-runtime-context'

describe('wiki link autocomplete source', () => {
  it('resolves heading and persisted-value load requests from the editor autocomplete context', () => {
    const targetNote = createNote({ name: 'Target Note' })
    const runtime = createTestWorkspaceRuntime({ activeItems: [targetNote] })
    const itemSource = createAutocompleteItemSource(runtime)
    const headingContext = getWikiLinkAutocompleteContextFromSource(
      'Target Note#',
      itemSource,
      undefined,
    )
    const valueContext = getWikiLinkAutocompleteContextFromSource(
      'Target Note.',
      itemSource,
      undefined,
    )

    expect(
      getWikiLinkAutocompleteLoadRequest({
        context: headingContext,
        valueRuntime: null,
      }),
    ).toEqual({
      headingsNoteId: targetNote.id,
      persistedValuesNoteId: null,
    })
    expect(
      getWikiLinkAutocompleteLoadRequest({
        context: valueContext,
        valueRuntime: createValueRuntime('source-note' as SidebarItemId),
      }),
    ).toEqual({
      headingsNoteId: null,
      persistedValuesNoteId: targetNote.id,
    })
  })

  it('uses current authored values without requesting persisted values for the same note', () => {
    const currentNote = createNote({ name: 'Current Note' })
    const runtime = createTestWorkspaceRuntime({ activeItems: [currentNote] })
    const context = getWikiLinkAutocompleteContextFromSource(
      'Current Note.',
      createAutocompleteItemSource(runtime),
      currentNote.id,
    )

    expect(
      getWikiLinkAutocompleteLoadRequest({
        context,
        valueRuntime: createValueRuntime(currentNote.id),
      }),
    ).toEqual({
      headingsNoteId: null,
      persistedValuesNoteId: null,
    })
  })
})

function createAutocompleteItemSource(runtime: WorkspaceRuntime): WikiLinkAutocompleteItemSource {
  const { catalog, paths } = runtime.filesystem
  return {
    getItemBreadcrumbs: () => '',
    getItemLinkPath: paths.getVisibleItemLinkPath,
    queryItems: (input) => [...catalog.queryVisibleItems(input)],
    resolveFolderPath: paths.resolveVisibleFolderPath,
    resolveItemPath: paths.resolveVisibleItemPath,
    resolveNotePath: paths.resolveVisibleNotePath,
  }
}

function createValueRuntime(noteId: SidebarItemId): NoteValueRuntimeContextValue {
  return {
    noteId,
    editable: true,
    authoredDefinitions: [],
    authoredValueStates: [],
    externalDependencyStates: [],
    externalDependencyStatesStatus: 'success',
    referenceableStates: [],
    referenceableStatesStatus: 'success',
    stateByValueId: new Map(),
    references: {
      getNoteCandidates: () => [],
      resolveNoteIdByPath: () => null,
    },
  }
}
