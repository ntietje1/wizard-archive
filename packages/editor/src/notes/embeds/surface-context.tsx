import type { ResourceId } from '../../resources/domain-id'
import type { ReactNode } from 'react'

import type { EmbedTargetOperations } from '../../embeds/target-operations'
import { NoteEmbedSurfaceContext } from './surface-context-value'
import type { NoteEmbedSurfaceContextValue } from './surface-context-value'

export function NoteEmbedSurfaceProvider({
  children,
  editable,
  embedTargetOperations,
  renderEmbeddedNotePreview,
  sourceNoteId,
}: {
  children: ReactNode
  editable: boolean
  embedTargetOperations?: EmbedTargetOperations
  renderEmbeddedNotePreview?: NoteEmbedSurfaceContextValue['renderEmbeddedNotePreview']
  sourceNoteId: ResourceId | null
}) {
  const value: NoteEmbedSurfaceContextValue = editable
    ? {
        state: 'editable',
        sourceNoteId,
        editable: true,
        embedTargetOperations,
        renderEmbeddedNotePreview,
      }
    : sourceNoteId === null
      ? {
          state: 'unavailable',
          sourceNoteId: null,
          editable: false,
          renderEmbeddedNotePreview,
        }
      : {
          state: 'readonly',
          sourceNoteId,
          editable: false,
          renderEmbeddedNotePreview,
        }

  return (
    <NoteEmbedSurfaceContext.Provider value={value}>{children}</NoteEmbedSurfaceContext.Provider>
  )
}
