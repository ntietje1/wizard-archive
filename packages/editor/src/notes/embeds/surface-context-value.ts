import { createContext, use } from 'react'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { EmbedTargetOperations } from '../../embeds/target-operations'
import type { EmbeddedNotePreviewRenderer } from './embedded-note-preview-renderer'

type NoteEmbedSurfaceBase = {
  sourceNoteId: SidebarItemId | null
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
}

export type NoteEmbedSurfaceContextValue =
  | (NoteEmbedSurfaceBase & {
      state: 'editable'
      editable: true
      embedTargetOperations?: EmbedTargetOperations
    })
  | (NoteEmbedSurfaceBase & {
      state: 'readonly'
      editable: false
      embedTargetOperations?: never
    })
  | (NoteEmbedSurfaceBase & {
      state: 'unavailable'
      editable: false
      sourceNoteId: null
      embedTargetOperations?: never
    })

export const NoteEmbedSurfaceContext = createContext<NoteEmbedSurfaceContextValue | null>(null)

export function useNoteEmbedSurface() {
  const surface = use(NoteEmbedSurfaceContext)
  if (!surface) {
    throw new Error('useNoteEmbedSurface must be used within NoteEmbedSurfaceProvider')
  }
  return surface
}
