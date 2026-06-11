import { create } from 'zustand'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { EditorNoteCollaborationProvider } from '~/features/editor/workspace/editor-workspace-source'

interface NoteEditorStore {
  editor: CustomBlockNoteEditor | null
  provider: EditorNoteCollaborationProvider | null
  claimEditor: (
    editor: CustomBlockNoteEditor | null,
    provider?: EditorNoteCollaborationProvider | null,
  ) => () => void
}

let claimToken = 0

export const useNoteEditorStore = create<NoteEditorStore>((set) => ({
  editor: null,
  provider: null,
  claimEditor: (editor, provider = null) => {
    const token = ++claimToken
    set({ editor, provider })
    return () => {
      if (claimToken === token) set({ editor: null, provider: null })
    }
  },
}))
