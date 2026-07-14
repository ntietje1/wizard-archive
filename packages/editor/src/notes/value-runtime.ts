import type { ResourceId } from '../resources/domain-id'
import { useCallback, useSyncExternalStore } from 'react'

import { extractNoteValueDefinitions } from './values/definitions'
import { hydrateNoteValueRuntimeSource, planNoteValueRuntimeStateLoad } from './value-runtime-model'
import type {
  NoteValueReferences,
  NoteValueRuntimeSource,
  NoteValueRuntimeStateSource,
} from './value-runtime-model'
import type { CustomBlockNoteEditor } from './editor-schema'

type EditorDocumentSnapshot = {
  revision: number
  document: CustomBlockNoteEditor['document']
}

export function useNoteValueRuntimeSource({
  editor,
  noteId,
  references,
  stateSource,
}: {
  editor: CustomBlockNoteEditor | null
  noteId?: ResourceId
  references: NoteValueReferences
  stateSource: NoteValueRuntimeStateSource
}): NoteValueRuntimeSource {
  const authoredDefinitions = useEditorNoteValueDefinitions({ editor, noteId })
  const statePlan = planNoteValueRuntimeStateLoad({ authoredDefinitions, noteId, references })
  const stateLoad = stateSource.useNoteValueStates(statePlan.noteIds)

  return hydrateNoteValueRuntimeSource({
    noteId,
    authoredDefinitions,
    references,
    stateLoad,
    statePlan,
  })
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
  const tiptap = editor?._tiptapEditor
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
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
    [editor, tiptap],
  )
  const getSnapshot = useCallback(() => getEditorDocumentSnapshot(editor), [editor])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function useEditorNoteValueDefinitions({
  editor,
  noteId,
}: {
  editor: CustomBlockNoteEditor | null
  noteId?: ResourceId
}) {
  const editorDocumentSnapshot = useEditorDocumentSnapshot(editor)
  return noteId ? extractNoteValueDefinitions(editorDocumentSnapshot.document, noteId) : []
}
