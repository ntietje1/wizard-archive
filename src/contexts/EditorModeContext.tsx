import { useMemo, useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { EditorModeContext } from '~/hooks/useEditorMode'

export type EditorMode = 'viewer' | 'editor'

export function EditorModeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [editorMode, setEditorMode] = useState<EditorMode>('editor')
  const [viewAsPlayerId, setViewAsPlayerId] = useState<
    Id<'campaignMembers'> | undefined
  >(undefined)

  const value = useMemo(() => {
    return {
      editorMode,
      setEditorMode,
      viewAsPlayerId,
      setViewAsPlayerId,
    }
  }, [editorMode, viewAsPlayerId])

  return (
    <EditorModeContext.Provider value={value}>
      {children}
    </EditorModeContext.Provider>
  )
}
