import { createContext, use } from 'react'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { EmbedTargetOperations } from '../../embeds/target-operations'
import type { EmbeddedNotePreviewRenderer } from './embedded-note-preview-renderer'

export type NoteEmbedSurfaceContextValue = {
  sourceNoteId: SidebarItemId | null
  editable: boolean
  embedTargetOperations?: EmbedTargetOperations
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
}

export const NoteEmbedSurfaceContext = createContext<NoteEmbedSurfaceContextValue | null>(null)

export function useNoteEmbedSurface() {
  const surface = use(NoteEmbedSurfaceContext)
  if (!surface) {
    throw new Error('useNoteEmbedSurface must be used within NoteEmbedSurfaceProvider')
  }
  return surface
}
