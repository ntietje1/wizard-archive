import type { ResourceId } from '../../../resources/domain-id'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import type { RefObject } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { createNote } from '../../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import { WikiLinkAutocomplete } from '../autocomplete'
import type { AnyItem } from '../../../workspace/items'
import type { CustomBlockNoteEditor } from '../../editor-schema'
import type { NoteValueRuntimeState } from '../../values/state-contract'

import type { WikiLinkAutocompleteMenuState } from '../autocomplete-source'
import {
  createWikiLinkAutocompleteModelData,
  useWikiLinkAutocompleteState,
} from '../autocomplete-source'
import type { WikiLinkAutocompleteItemSource } from '../autocomplete-model'
import { NoteValueRuntimeContext } from '../../value-block/value-block-runtime-context'
import type { NoteValueRuntimeContextValue } from '../../value-block/value-block-runtime-context'

function createEditorStub(text = '[[') {
  const domElement = document.createElement('div')
  document.body.append(domElement)
  let currentText = text
  let insertedContent = ''
  let transactionHandler: ((payload: { transaction: { docChanged: boolean } }) => void) | null =
    null

  const editor = {
    domElement,
    _tiptapEditor: {
      state: {
        selection: {
          get from() {
            return currentText.length
          },
          $from: {
            start: () => 0,
            end: () => currentText.length,
          },
        },
        doc: {
          textBetween: (from: number, to: number) => currentText.slice(from, to),
        },
      },
      view: {
        coordsAtPos: () => ({ left: 10, top: 10, bottom: 24 }),
      },
      on: vi.fn((event: string, handler: typeof transactionHandler) => {
        if (event === 'transaction') transactionHandler = handler
      }),
      off: vi.fn(),
      chain: () => ({
        focus: () => ({
          insertContentAt: (_range: { from: number; to: number }, content: string) => ({
            run: () => {
              insertedContent = content
            },
          }),
          setTextSelection: () => ({
            run: () => undefined,
          }),
        }),
      }),
    },
  } as unknown as CustomBlockNoteEditor

  return {
    domElement,
    editor,
    openAutocomplete: () => transactionHandler?.({ transaction: { docChanged: true } }),
    insertedContent: () => insertedContent,
    setText: (nextText: string) => {
      currentText = nextText
    },
  }
}

function TestWikiLinkAutocomplete({
  editor,
  persistedValues = [],
  sourceNoteId,
  visibleItems,
  onForceOpenRef,
}: {
  editor: CustomBlockNoteEditor | undefined
  onForceOpenRef?: RefObject<(() => void) | null>
  persistedValues?: Array<NoteValueRuntimeState<ResourceId>>
  sourceNoteId?: ResourceId
  visibleItems: Array<AnyItem>
}) {
  const runtime = createTestWorkspaceRuntime({ activeItems: visibleItems })
  const [menu, setMenu] = useState<WikiLinkAutocompleteMenuState>({
    show: false,
    query: '',
    pos: null,
  })
  const autocompleteState = useWikiLinkAutocompleteState({
    itemSource: createAutocompleteItemSource(runtime),
    menu,
    sourceNoteId,
  })
  const modelData = createWikiLinkAutocompleteModelData({
    ...autocompleteState,
    headings: [],
    headingsPending: false,
    persistedValues,
    persistedValuesPending: false,
  })

  return (
    <WikiLinkAutocomplete
      editor={editor}
      menu={menu}
      modelData={modelData}
      onForceOpenRef={onForceOpenRef}
      setMenu={setMenu}
      sourceNoteId={sourceNoteId}
    />
  )
}

describe('WikiLinkAutocomplete', () => {
  it('suggests only sidebar items from the permission-filtered list', async () => {
    const visibleNote = createNote({
      name: 'Visible Note',
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const { editor, openAutocomplete } = createEditorStub()
    render(<TestWikiLinkAutocomplete editor={editor} visibleItems={[visibleNote]} />)

    act(() => {
      openAutocomplete()
    })

    expect(await screen.findByText('Visible Note')).toBeInTheDocument()
  })

  it('uses live current-note values for qualified value autocomplete', async () => {
    const currentNote = createNote({
      id: 'note-1' as ResourceId,
      name: 'Current Note',
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    const { editor, openAutocomplete } = createEditorStub('[[Current Note.')
    const currentNoteValue: NoteValueRuntimeState<ResourceId> = {
      noteId: currentNote.id,
      noteBlockId: 'block-1',
      valueId: 'value-1',
      slug: 'draft_value',
      status: 'ok',
      rawValue: 1,
      formattedValue: '1',
    }
    render(
      <NoteValueRuntimeContext.Provider
        value={createValueRuntime(currentNote.id, [currentNoteValue])}
      >
        <TestWikiLinkAutocomplete
          editor={editor}
          sourceNoteId={currentNote.id}
          visibleItems={[currentNote]}
        />
      </NoteValueRuntimeContext.Provider>,
    )

    act(() => {
      openAutocomplete()
    })

    expect(await screen.findByRole('option', { name: /draft_value/ })).toBeInTheDocument()
  })

  it('drops a preserved display name when the active query no longer has one', async () => {
    const note = createNote({
      name: 'Clock Tower',
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const forceOpenRef = { current: null } as RefObject<(() => void) | null>
    const editorStub = createEditorStub('[[Clock Tower|Tower')

    render(
      <TestWikiLinkAutocomplete
        editor={editorStub.editor}
        onForceOpenRef={forceOpenRef}
        visibleItems={[note]}
      />,
    )

    act(() => {
      forceOpenRef.current?.()
    })
    act(() => {
      editorStub.setText('[[Clock')
      editorStub.openAutocomplete()
    })

    expect(await screen.findByText('Clock Tower')).toBeInTheDocument()

    fireEvent.keyDown(editorStub.domElement, { key: 'Enter' })

    expect(editorStub.insertedContent()).toBe('[[Clock Tower]]')
  })
})

function createAutocompleteItemSource(
  runtime: ReturnType<typeof createTestWorkspaceRuntime>,
): WikiLinkAutocompleteItemSource {
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

function createValueRuntime(
  noteId: ResourceId,
  authoredValueStates: Array<NoteValueRuntimeState<ResourceId>>,
): NoteValueRuntimeContextValue {
  return {
    noteId,
    editable: true,
    authoredDefinitions: [],
    authoredValueStates,
    externalDependencyStates: [],
    externalDependencyStatesStatus: 'success',
    referenceableStates: [],
    referenceableStatesStatus: 'success',
    stateByValueId: new Map(authoredValueStates.map((state) => [state.valueId, state])),
    references: {
      getNoteCandidates: () => [],
      resolveNoteIdByPath: () => null,
    },
  }
}
