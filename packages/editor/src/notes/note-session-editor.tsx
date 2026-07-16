import type { NoteSessionState } from '../resources/content-session-contract'
import { NoteEditor } from './note-editor'

type RenderableNoteSessionState = Extract<
  NoteSessionState,
  { status: 'initializing' } | { status: 'ready' }
>

export function NoteSessionEditor({
  canEdit,
  label,
  state,
}: {
  canEdit: boolean
  label: string
  state: RenderableNoteSessionState
}) {
  if (state.status === 'initializing') {
    return canEdit ? (
      <NoteEditor document={state.local} label={label} mode="edit" persistence="initializing" />
    ) : (
      <NoteEditor document={state.local} label={label} mode="view" />
    )
  }
  return canEdit ? (
    <NoteEditor
      collaboration={state.session.collaboration}
      document={state.session.document}
      label={label}
      mode="edit"
      persistence="ready"
      onFlush={state.session.flush}
    />
  ) : (
    <NoteEditor
      collaboration={state.session.collaboration}
      document={state.session.document}
      label={label}
      mode="view"
    />
  )
}
