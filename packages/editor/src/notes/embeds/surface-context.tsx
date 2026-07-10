import type { ReactNode } from 'react'
import { NoteEmbedSurfaceContext } from './surface-context-value'
import type { NoteEmbedSurfaceContextValue } from './surface-context-value'

export function NoteEmbedSurfaceProvider({
  children,
  editable,
  embedTargetOperations,
  renderEmbeddedNotePreview,
  sourceNoteId,
}: NoteEmbedSurfaceContextValue & { children: ReactNode }) {
  return (
    <NoteEmbedSurfaceContext.Provider
      value={{
        sourceNoteId,
        editable,
        embedTargetOperations,
        renderEmbeddedNotePreview,
      }}
    >
      {children}
    </NoteEmbedSurfaceContext.Provider>
  )
}
