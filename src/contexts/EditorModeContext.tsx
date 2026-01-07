import { useMemo, useState } from 'react'
import { EditorModeContext } from '~/hooks/useEditorMode'

export type EditorMode = 'viewer' | 'editor'

export function EditorModeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [editorMode, setEditorMode] = useState<EditorMode>('editor')
  const value = useMemo(() => {
    return {
      editorMode,
      setEditorMode,
    }
  }, [editorMode])

  return (
    <EditorModeContext.Provider value={value}>
      {children}
    </EditorModeContext.Provider>
  )
}
