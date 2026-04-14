import { create } from 'zustand'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'

interface NoteEditorStore {
  editor: CustomBlockNoteEditor | null
  claimEditor: (editor: CustomBlockNoteEditor | null) => () => void
}

let claimToken = 0

export const useNoteEditorStore = create<NoteEditorStore>((set) => ({
  editor: null,
  claimEditor: (editor) => {
    const token = ++claimToken
    set({ editor })
    return () => {
      if (claimToken === token) set({ editor: null })
    }
  },
}))
