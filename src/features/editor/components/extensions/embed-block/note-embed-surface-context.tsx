import type { ReactNode } from 'react'
import { NoteEmbedSurfaceContext } from './note-embed-surface-context-value'
import type { NoteEmbedSurfaceContextValue } from './note-embed-surface-context-value'

export function NoteEmbedSurfaceProvider({
  sourceNoteId,
  editable,
  children,
}: NoteEmbedSurfaceContextValue & { children: ReactNode }) {
  return (
    <NoteEmbedSurfaceContext.Provider value={{ sourceNoteId, editable }}>
      {children}
    </NoteEmbedSurfaceContext.Provider>
  )
}
