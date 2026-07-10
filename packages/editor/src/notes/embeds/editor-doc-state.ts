import { useState } from 'react'
import type { Doc } from 'yjs'
import type { CustomBlockNoteEditor } from '../editor-schema'

interface EditorDocState {
  doc: Doc | null
  editor: CustomBlockNoteEditor | null
}

export type EditorDocChangeHandler = (editor: CustomBlockNoteEditor | null, doc: Doc | null) => void

export function useEditorDocState(onChange?: EditorDocChangeHandler) {
  const [state, setState] = useState<EditorDocState>({
    doc: null,
    editor: null,
  })

  const handleChange: EditorDocChangeHandler = (editor, doc) => {
    setState({ doc, editor })
    onChange?.(editor, doc)
  }

  return [state, handleChange] as const
}
