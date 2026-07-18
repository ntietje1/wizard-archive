import type { NoteSessionState } from '../resources/content-session-contract'
import { NoteEditor } from './note-editor'
import type { NoteScrollBehavior } from './note-scroll-persistence'
import type { NoteHeadingNavigationRef } from './note-heading-navigation'
import type { BlockNoteActivation } from '../rich-text/blocknote/use-blocknote-activation'
import type { NoteBlockAccessMenuBinding } from './sharing/note-block-access-menu'

type RenderableNoteSessionState = Extract<
  NoteSessionState,
  { status: 'initializing' } | { status: 'ready' }
>

export function NoteSessionEditor({
  canEdit,
  activation,
  blockAccess,
  formattingToolbar,
  headingNavigationRef,
  label,
  scroll,
  state,
}: {
  canEdit: boolean
  activation?: BlockNoteActivation
  blockAccess?: NoteBlockAccessMenuBinding
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
        blockAccess={blockAccess}
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
      blockAccess={blockAccess}
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
