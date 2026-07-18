import type { NoteSessionState } from '../resources/content-session-contract'
import { useEffect } from 'react'
import { NoteEditor } from './note-editor'
import type { NoteScrollBehavior } from './note-scroll-persistence'
import type { NoteHeadingNavigationRef } from './note-heading-navigation'
import type { BlockNoteActivation } from '../rich-text/blocknote/use-blocknote-activation'
import type { NoteBlockAccessMenuBinding } from './sharing/note-block-access-menu'
import type { NoteEmbedBinding } from './embeds/note-embed-runtime-context'

type RenderableNoteSessionState = Extract<
  NoteSessionState,
  { status: 'initializing' } | { status: 'ready' }
>

export function NoteSessionEditor({
  canEdit,
  activation,
  blockAccess,
  formattingToolbar,
  embeds,
  headingNavigationRef,
  label,
  scroll,
  state,
}: {
  canEdit: boolean
  activation?: BlockNoteActivation
  blockAccess?: NoteBlockAccessMenuBinding
  formattingToolbar?: boolean
  embeds?: NoteEmbedBinding
  headingNavigationRef?: NoteHeadingNavigationRef
  label: string
  scroll: NoteScrollBehavior
  state: RenderableNoteSessionState
}) {
  const session = state.status === 'ready' ? state.session : null
  useEffect(() => session?.retain(), [session])

  if (state.status === 'initializing') {
    return canEdit ? (
      <NoteEditor
        key={state.local.guid}
        document={state.local}
        activation={activation}
        blockAccess={blockAccess}
        formattingToolbar={formattingToolbar}
        embeds={embeds}
        headingNavigationRef={headingNavigationRef}
        label={label}
        mode="edit"
        persistence="initializing"
        scroll={scroll}
      />
    ) : (
      <NoteEditor
        key={state.local.guid}
        document={state.local}
        formattingToolbar={formattingToolbar}
        embeds={embeds}
        headingNavigationRef={headingNavigationRef}
        label={label}
        mode="view"
        scroll={scroll}
      />
    )
  }
  return canEdit ? (
    <NoteEditor
      key={state.session.document.guid}
      collaboration={state.session.collaboration}
      activation={activation}
      blockAccess={blockAccess}
      document={state.session.document}
      formattingToolbar={formattingToolbar}
      embeds={embeds}
      headingNavigationRef={headingNavigationRef}
      label={label}
      mode="edit"
      persistence="ready"
      scroll={scroll}
      onFlush={state.session.flush}
    />
  ) : (
    <NoteEditor
      key={state.session.document.guid}
      collaboration={state.session.collaboration}
      document={state.session.document}
      formattingToolbar={formattingToolbar}
      embeds={embeds}
      headingNavigationRef={headingNavigationRef}
      label={label}
      mode="view"
      scroll={scroll}
    />
  )
}
