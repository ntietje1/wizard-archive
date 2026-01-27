import { createContext, useContext } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorMode } from '~/contexts/EditorModeContext'

export interface EditorModeStateContextType {
  editorMode: EditorMode
  viewAsPlayerId: Id<'campaignMembers'> | undefined
}

export interface EditorModeActionsContextType {
  setEditorMode: (editorMode: EditorMode) => void
  setViewAsPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
}

export type EditorModeContextType = EditorModeStateContextType & EditorModeActionsContextType

export const EditorModeStateContext = createContext<EditorModeStateContextType | null>(null)
export const EditorModeActionsContext = createContext<EditorModeActionsContextType | null>(null)

// For backwards compatibility - returns both state and actions
export function useEditorMode(): EditorModeContextType {
  const state = useContext(EditorModeStateContext)
  const actions = useContext(EditorModeActionsContext)
  return {
    editorMode: state?.editorMode ?? 'viewer',
    viewAsPlayerId: state?.viewAsPlayerId,
    setEditorMode: actions?.setEditorMode ?? (() => {}),
    setViewAsPlayerId: actions?.setViewAsPlayerId ?? (() => {}),
  }
}

// Use this when you only need the state values (will re-render on state changes)
export function useEditorModeState(): EditorModeStateContextType {
  const context = useContext(EditorModeStateContext)
  return context ?? { editorMode: 'viewer', viewAsPlayerId: undefined }
}

// Use this when you only need the setters (won't re-render on state changes)
export function useEditorModeActions(): EditorModeActionsContextType {
  const context = useContext(EditorModeActionsContext)
  return context ?? { setEditorMode: () => {}, setViewAsPlayerId: () => {} }
}
