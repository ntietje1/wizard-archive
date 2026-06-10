import { createContext, createElement, useContext } from 'react'
import type { ReactNode } from 'react'
import type { EditorWorkspaceSource } from './editor-workspace-source'

const EditorWorkspaceSourceContext = createContext<EditorWorkspaceSource | null>(null)

export function EditorWorkspaceSourceProvider({
  children,
  value,
}: {
  children: ReactNode
  value: EditorWorkspaceSource
}) {
  return createElement(EditorWorkspaceSourceContext.Provider, { value }, children)
}

export function useEditorWorkspaceSource() {
  const source = useContext(EditorWorkspaceSourceContext)
  if (!source) {
    throw new Error('useEditorWorkspaceSource must be used within EditorWorkspaceSourceProvider')
  }
  return source
}

export function useOptionalEditorWorkspaceSource() {
  return useContext(EditorWorkspaceSourceContext)
}
