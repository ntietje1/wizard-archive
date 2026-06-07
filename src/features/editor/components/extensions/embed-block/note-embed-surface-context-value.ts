import { createContext, useContext } from 'react'
import type { Id } from 'convex/_generated/dataModel'

export type NoteEmbedSurfaceContextValue = {
  sourceNoteId: Id<'sidebarItems'> | null
  editable: boolean
}

export const NoteEmbedSurfaceContext = createContext<NoteEmbedSurfaceContextValue>({
  sourceNoteId: null,
  editable: false,
})

export function useNoteEmbedSurface() {
  return useContext(NoteEmbedSurfaceContext)
}
