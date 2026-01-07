import { createContext, useContext } from 'react'
import type { EditorMode } from '~/contexts/EditorModeContext'

export interface EditorModeContextType {
  editorMode: EditorMode
  setEditorMode: (editorMode: EditorMode) => void
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
    }
  )
}
