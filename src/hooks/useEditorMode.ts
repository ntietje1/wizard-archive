import { createContext, useContext } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorMode } from '~/contexts/EditorModeContext'

export interface EditorModeContextType {
  editorMode: EditorMode
  setEditorMode: (editorMode: EditorMode) => void
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  setViewAsPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
}
export const EditorModeContext = createContext<EditorModeContextType | null>(
  null,
)

export function useEditorMode(): EditorModeContextType {
  const context = useContext(EditorModeContext)
  return (
    context ?? {
      editorMode: 'viewer',
      setEditorMode: () => {},
      viewAsPlayerId: undefined,
      setViewAsPlayerId: () => {},
    }
  )
}
