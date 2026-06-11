import { useSyncExternalStore } from 'react'
import { collectFormulaReferences } from '../../../../shared/note-values/formula'
import { extractNoteValueDefinitions } from '../../../../shared/note-values/extract-definitions'
import { resolveExternalNoteId } from './value-reference-resolution'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type {
  NoteValueAuthoringDefinition,
  NoteValueRuntimeState,
} from '../../../../shared/note-values/types'

type EditorDocumentSnapshot = {
  revision: number
  document: CustomBlockNoteEditor['document']
}

export interface NoteValueRuntimeSource {
  noteId?: Id<'sidebarItems'>
  authoredDefinitions: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>>
  externalNoteIdByPath: Map<string, Id<'sidebarItems'>>
  externalStates: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
  persistedStates: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
  sidebarItems: Array<AnySidebarItem>
}

const EMPTY_ITEMS: Array<AnySidebarItem> = []
const EMPTY_ITEM_MAP = new Map<Id<'sidebarItems'>, AnySidebarItem>()
const EMPTY_VALUE_DEFINITIONS: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>> = []
const EMPTY_VALUE_STATES: Array<NoteValueRuntimeState<Id<'sidebarItems'>>> = []
const EMPTY_EXTERNAL_NOTE_ID_BY_PATH = new Map<string, Id<'sidebarItems'>>()

export function createEmptyNoteValueRuntimeSource(
  noteId?: Id<'sidebarItems'>,
): NoteValueRuntimeSource {
  return {
    noteId,
    authoredDefinitions: EMPTY_VALUE_DEFINITIONS,
    externalNoteIdByPath: EMPTY_EXTERNAL_NOTE_ID_BY_PATH,
    externalStates: EMPTY_VALUE_STATES,
    itemsMap: EMPTY_ITEM_MAP,
    persistedStates: EMPTY_VALUE_STATES,
    sidebarItems: EMPTY_ITEMS,
  }
}

const editorDocumentSnapshots = new WeakMap<CustomBlockNoteEditor, EditorDocumentSnapshot>()
const EMPTY_DOCUMENT: CustomBlockNoteEditor['document'] = []
const EMPTY_SNAPSHOT: EditorDocumentSnapshot = { revision: 0, document: EMPTY_DOCUMENT }

function getEditorDocumentSnapshot(editor: CustomBlockNoteEditor | null): EditorDocumentSnapshot {
  if (!editor) return EMPTY_SNAPSHOT

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

function useEditorDocumentSnapshot(editor: CustomBlockNoteEditor | null): EditorDocumentSnapshot {
  return useSyncExternalStore(
    (onStoreChange) => {
      const tiptap = editor?._tiptapEditor
      if (!editor || !tiptap) {
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

export function useEditorNoteValueDefinitions({
  editor,
  noteId,
}: {
  editor: CustomBlockNoteEditor | null
  noteId?: Id<'sidebarItems'>
}) {
  const editorDocumentSnapshot = useEditorDocumentSnapshot(editor)
  return noteId ? extractNoteValueDefinitions(editorDocumentSnapshot.document, noteId) : []
}

export function getExternalNoteIdByPathForDefinitions({
  definitions,
  noteId,
  sidebarItems,
  itemsMap,
}: {
  definitions: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>>
  noteId: Id<'sidebarItems'>
  sidebarItems: Array<AnySidebarItem>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
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
      if (externalNoteId) {
        noteIdByPath.set(reference.notePathRaw, externalNoteId)
      }
    }
  }
  return noteIdByPath
}
