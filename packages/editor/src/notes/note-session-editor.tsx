import type { NoteSessionState } from '../resources/content-session-contract'
import { NoteEditor } from './note-editor'
import type { NoteScrollBehavior } from './note-scroll-persistence'

type RenderableNoteSessionState = Extract<
  NoteSessionState,
  { status: 'initializing' } | { status: 'ready' }
>

export function NoteSessionEditor({
  canEdit,
  label,
  scroll,
  state,
}: {
  canEdit: boolean
  label: string
  scroll: NoteScrollBehavior
  state: RenderableNoteSessionState
}) {
  if (state.status === 'initializing') {
    return canEdit ? (
      <NoteEditor
        document={state.local}
        label={label}
        mode="edit"
        persistence="initializing"
        scroll={scroll}
      />
    ) : (
      <NoteEditor document={state.local} label={label} mode="view" scroll={scroll} />
    )
  }
  return canEdit ? (
    <NoteEditor
      collaboration={state.session.collaboration}
      document={state.session.document}
      label={label}
      mode="edit"
      persistence="ready"
      scroll={scroll}
      onFlush={state.session.flush}
    />
  ) : (
    <NoteEditor
      collaboration={state.session.collaboration}
      document={state.session.document}
      label={label}
      mode="view"
      scroll={scroll}
    />
  )
}
