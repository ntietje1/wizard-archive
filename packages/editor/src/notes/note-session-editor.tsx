import type { NoteSessionState } from '../resources/content-session-contract'
import { NoteEditor } from './note-editor'
import type { NoteScrollBehavior } from './note-scroll-persistence'
import type { NoteHeadingNavigationRef } from './note-heading-navigation'
import type { BlockNoteActivation } from '../rich-text/blocknote/use-blocknote-activation'

type RenderableNoteSessionState = Extract<
  NoteSessionState,
  { status: 'initializing' } | { status: 'ready' }
>

export function NoteSessionEditor({
  canEdit,
  activation,
  formattingToolbar,
  headingNavigationRef,
  label,
  scroll,
  state,
}: {
  canEdit: boolean
  activation?: BlockNoteActivation
  formattingToolbar?: boolean
  headingNavigationRef?: NoteHeadingNavigationRef
  label: string
  scroll: NoteScrollBehavior
  state: RenderableNoteSessionState
}) {
  if (state.status === 'initializing') {
    return canEdit ? (
      <NoteEditor
        document={state.local}
        activation={activation}
        formattingToolbar={formattingToolbar}
        headingNavigationRef={headingNavigationRef}
        label={label}
        mode="edit"
        persistence="initializing"
        scroll={scroll}
      />
    ) : (
      <NoteEditor
        document={state.local}
        formattingToolbar={formattingToolbar}
        headingNavigationRef={headingNavigationRef}
        label={label}
        mode="view"
        scroll={scroll}
      />
    )
  }
  return canEdit ? (
    <NoteEditor
      collaboration={state.session.collaboration}
      activation={activation}
      document={state.session.document}
      formattingToolbar={formattingToolbar}
      headingNavigationRef={headingNavigationRef}
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
      formattingToolbar={formattingToolbar}
      headingNavigationRef={headingNavigationRef}
      label={label}
      mode="view"
      scroll={scroll}
    />
  )
}
