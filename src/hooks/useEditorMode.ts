import { createContext, useContext } from 'react'
import { EDITOR_MODE } from 'convex/editors/types'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorMode } from 'convex/editors/types'

export interface EditorModeStateContextType {
  editorMode: EditorMode
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  canEdit: boolean
}

export interface EditorModeActionsContextType {
  setEditorMode: (editorMode: EditorMode) => void
  setViewAsPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
}

export type EditorModeContextType = EditorModeStateContextType &
  EditorModeActionsContextType

export const EditorModeStateContext =
  createContext<EditorModeStateContextType | null>(null)
export const EditorModeActionsContext =
  createContext<EditorModeActionsContextType | null>(null)

export function useEditorMode(): EditorModeContextType {
  const state = useContext(EditorModeStateContext)
  const actions = useContext(EditorModeActionsContext)
  return {
    editorMode: state?.editorMode ?? EDITOR_MODE.VIEWER,
    viewAsPlayerId: state?.viewAsPlayerId,
    canEdit: state?.canEdit ?? false,
    setEditorMode: actions?.setEditorMode ?? (() => {}),
    setViewAsPlayerId: actions?.setViewAsPlayerId ?? (() => {}),
  }
}

export function useEditorModeState(): EditorModeStateContextType {
  const context = useContext(EditorModeStateContext)
  return (
    context ?? {
      editorMode: EDITOR_MODE.VIEWER,
      viewAsPlayerId: undefined,
      canEdit: false,
    }
  )
}

export function useEditorModeActions(): EditorModeActionsContextType {
  const context = useContext(EditorModeActionsContext)
  return context ?? { setEditorMode: () => {}, setViewAsPlayerId: () => {} }
}
