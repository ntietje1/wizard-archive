import { create } from 'zustand'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'

interface NoteEditorStore {
  editor: CustomBlockNoteEditor | null
  setEditor: (editor: CustomBlockNoteEditor | null) => void
}

export const useNoteEditorStore = create<NoteEditorStore>((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
}))
