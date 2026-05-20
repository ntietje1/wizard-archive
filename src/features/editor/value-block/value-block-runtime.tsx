import { useSyncExternalStore } from 'react'
import { api } from 'convex/_generated/api'
import {
  collectFormulaReferences,
  evaluateNoteValueAuthoringDefinitions,
} from '../../../../shared/note-values/formula'
import { extractNoteValueDefinitions } from '../../../../shared/note-values/extract-definitions'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import type {
  NoteValueAuthoringDefinition,
  NoteValueRuntimeState,
} from '../../../../shared/note-values/types'
import { NoteValueRuntimeContext } from './value-block-runtime-context'
import { resolveExternalNoteId } from './use-value-reference-authoring'
import { useValueTransferBehavior } from './value-transfer-plugin'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'

type EditorDocumentSnapshot = {
  revision: number
  document: CustomBlockNoteEditor['document']
}

const editorDocumentSnapshots = new WeakMap<CustomBlockNoteEditor, EditorDocumentSnapshot>()

function getEditorDocumentSnapshot(editor: CustomBlockNoteEditor): EditorDocumentSnapshot {
  const existing = editorDocumentSnapshots.get(editor)
  if (existing) {
    return existing
  }

  const initialSnapshot = {
    revision: 0,
    document: editor.document,
  }
  editorDocumentSnapshots.set(editor, initialSnapshot)
  return initialSnapshot
}

function bumpEditorDocumentSnapshot(editor: CustomBlockNoteEditor): void {
  const previous = getEditorDocumentSnapshot(editor)
  editorDocumentSnapshots.set(editor, {
    revision: previous.revision + 1,
    document: editor.document,
  })
}

function useEditorDocumentSnapshot(editor: CustomBlockNoteEditor): EditorDocumentSnapshot {
  return useSyncExternalStore(
    (onStoreChange) => {
      const tiptap = editor._tiptapEditor
      if (!tiptap) {
        return () => {}
      }

      const handleTransaction = () => {
        bumpEditorDocumentSnapshot(editor)
        onStoreChange()
      }

      tiptap.on('transaction', handleTransaction)
      return () => {
        tiptap.off('transaction', handleTransaction)
      }
    },
    () => getEditorDocumentSnapshot(editor),
    () => getEditorDocumentSnapshot(editor),
  )
}

function evaluateSameNoteAuthoringStates({
  noteId,
  definitions,
  externalStates,
  externalNoteIdByPath,
}: {
  noteId: Id<'sidebarItems'>
  definitions: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>>
  externalStates: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
  externalNoteIdByPath: Map<string, Id<'sidebarItems'>>
}) {
  const externalValueByNoteAndSlug = new Map(
    externalStates.map((state) => [`${state.noteId}:${state.slug}`, state]),
  )
  const externalStateByTarget = new Map(
    externalStates.map((state) => [`${state.noteId}:${state.valueId}`, state]),
  )
  return evaluateNoteValueAuthoringDefinitions(definitions, {
    currentNoteId: noteId,
    resolveExternal: (notePathRaw, slug) => {
      const externalNoteId = externalNoteIdByPath.get(notePathRaw)
      const state = externalNoteId
        ? externalValueByNoteAndSlug.get(`${externalNoteId}:${slug}`)
        : undefined
      if (state) {
        return {
          ok: true,
          noteId: state.noteId,
          valueId: state.valueId,
        }
      }
      return {
        ok: false,
        errorCode: 'unknown_reference',
        errorMessage: `Unknown reference "${slug}"`,
      }
    },
    getDependencyState: (dependencyNoteId, dependencyValueId) =>
      externalStateByTarget.get(`${dependencyNoteId}:${dependencyValueId}`) ?? null,
  })
}

function getExternalNoteIdByPathForDefinitions({
  definitions,
  noteId,
  sidebarItems,
  itemsMap,
}: {
  definitions: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>>
  noteId: Id<'sidebarItems'>
  sidebarItems: ReturnType<typeof useActiveSidebarItems>['data']
  itemsMap: ReturnType<typeof useActiveSidebarItems>['itemsMap']
}) {
  const sourceParentId = itemsMap.get(noteId)?.parentId
  const noteIdByPath = new Map<string, Id<'sidebarItems'>>()
  for (const definition of definitions) {
    for (const reference of collectFormulaReferences(definition.expressionSource)) {
      if (reference.kind !== 'external') continue
      const externalNoteId = resolveExternalNoteId(
        reference.notePathRaw,
        sidebarItems,
        itemsMap,
        sourceParentId,
      )
      if (externalNoteId && externalNoteId !== noteId) {
        noteIdByPath.set(reference.notePathRaw, externalNoteId)
      }
    }
  }
  return noteIdByPath
}

export function NoteValueRuntimeProvider({
  editor,
  noteId,
  editable,
  evaluateValuesFromEditor,
  children,
}: {
  editor: CustomBlockNoteEditor
  noteId?: Id<'sidebarItems'>
  editable: boolean
  evaluateValuesFromEditor: boolean
  children: React.ReactNode
}) {
  const { data: sidebarItems, itemsMap } = useActiveSidebarItems()
  const editorDocumentSnapshot = useEditorDocumentSnapshot(editor)

  const persistedStatesQuery = useCampaignQuery(
    api.noteValues.queries.getNoteValueStates,
    noteId ? { noteId } : 'skip',
  )
  const persistedStates: Array<NoteValueRuntimeState<Id<'sidebarItems'>>> =
    persistedStatesQuery.data ?? []
  const authoredDefinitions = noteId
    ? extractNoteValueDefinitions(editorDocumentSnapshot.document, noteId)
    : []
  const externalNoteIdByPath = noteId
    ? getExternalNoteIdByPathForDefinitions({
        definitions: authoredDefinitions,
        noteId,
        sidebarItems,
        itemsMap,
      })
    : new Map<string, Id<'sidebarItems'>>()
  const externalNoteIds = [...new Set(externalNoteIdByPath.values())]
  const externalStatesQuery = useCampaignQuery(
    api.noteValues.queries.getNoteValueStatesByNotes,
    externalNoteIds.length > 0 ? { noteIds: externalNoteIds } : 'skip',
  )
  const externalStates: Array<NoteValueRuntimeState<Id<'sidebarItems'>>> =
    externalStatesQuery.data ?? []
  const existingSlugs = authoredDefinitions.map((definition) => definition.slug)
  useValueTransferBehavior(editor, editable, () => existingSlugs)

  const stateByValueId = new Map(persistedStates.map((state) => [state.valueId, state]))
  if (noteId && evaluateValuesFromEditor) {
    const liveStates = evaluateSameNoteAuthoringStates({
      noteId,
      definitions: authoredDefinitions,
      externalStates,
      externalNoteIdByPath,
    })
    for (const state of liveStates) {
      stateByValueId.set(state.valueId, state)
    }
  }

  return (
    <NoteValueRuntimeContext.Provider
      value={{
        noteId,
        editable,
        authoredDefinitions,
        stateByValueId,
        sidebarItems,
        itemsMap,
      }}
    >
      {children}
    </NoteValueRuntimeContext.Provider>
  )
}
