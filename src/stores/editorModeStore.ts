import { create } from 'zustand'
import { EDITOR_MODE } from 'convex/editors/types'
import type { EditorMode } from 'convex/editors/types'
import type { Id } from 'convex/_generated/dataModel'

interface EditorModeState {
  editorMode: EditorMode
  viewAsPlayerId: Id<'campaignMembers'> | undefined
}

interface EditorModeActions {
  setEditorMode: (mode: EditorMode) => void
  setViewAsPlayerId: (id: Id<'campaignMembers'> | undefined) => void
}

const initialState: EditorModeState = {
  editorMode: EDITOR_MODE.EDITOR,
  viewAsPlayerId: undefined,
}

export const useEditorModeStore = create<EditorModeState & EditorModeActions>()(
  (set) => ({
    ...initialState,
    setEditorMode: (mode) => set({ editorMode: mode }),
    setViewAsPlayerId: (id) => set({ viewAsPlayerId: id }),
  }),
)
