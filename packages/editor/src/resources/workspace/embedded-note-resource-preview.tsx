import type { EmbeddedNoteResourceRenderer } from '../../notes/embeds/note-embed-runtime-context'
import { EPHEMERAL_NOTE_SCROLL } from '../../notes/note-scroll-persistence'
import { NoteSessionEditor } from '../../notes/note-session-editor'

export const renderEmbeddedNoteResource: EmbeddedNoteResourceRenderer = ({
  ancestors,
  drop,
  resource,
  runtime,
  state,
}) => (
  <NoteSessionEditor
    canEdit={false}
    embeds={{
      ancestors,
      drop: drop ?? undefined,
      renderNote: renderEmbeddedNoteResource,
      runtime,
      sourceResourceId: resource.id,
    }}
    formattingToolbar={false}
    label={`${resource.title} embedded note`}
    scroll={EPHEMERAL_NOTE_SCROLL}
    state={state}
  />
)
