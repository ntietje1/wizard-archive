import type { NoteSessionState } from '../resources/content-session-contract'
import { useEffect } from 'react'
import { NoteEditor } from './note-editor'
import type { NoteScrollBehavior } from './note-scroll-persistence'
import type { NoteHeadingNavigationRef } from './note-heading-navigation'
import type { BlockNoteActivation } from '../rich-text/blocknote/use-blocknote-activation'
import type { NoteBlockAccessMenuBinding } from './sharing/note-block-access-menu'
import type { NoteResourceBinding } from './note-resource-runtime-context'
import type { NoteBlockNoteEditor } from './note-editor-schema'

type RenderableNoteSessionState = Extract<
  NoteSessionState,
  { status: 'initializing' } | { status: 'ready' }
>

export function NoteSessionEditor({
  canEdit,
  activation,
  blockAccess,
  formattingToolbar,
  resources,
  headingNavigationRef,
  label,
  onEditorChange,
  scroll,
  state,
}: {
  canEdit: boolean
  activation?: BlockNoteActivation
  blockAccess?: NoteBlockAccessMenuBinding
  formattingToolbar?: boolean
  resources?: NoteResourceBinding
  headingNavigationRef?: NoteHeadingNavigationRef
  label: string
  onEditorChange?: (editor: NoteBlockNoteEditor | null) => void
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
        resources={resources}
        headingNavigationRef={headingNavigationRef}
        label={label}
        onEditorChange={onEditorChange}
        mode="edit"
        persistence="initializing"
        scroll={scroll}
      />
    ) : (
      <NoteEditor
        key={state.local.guid}
        document={state.local}
        formattingToolbar={formattingToolbar}
        resources={resources}
        headingNavigationRef={headingNavigationRef}
        label={label}
        onEditorChange={onEditorChange}
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
      resources={resources}
      headingNavigationRef={headingNavigationRef}
      label={label}
      onEditorChange={onEditorChange}
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
      resources={resources}
      headingNavigationRef={headingNavigationRef}
      label={label}
      onEditorChange={onEditorChange}
      mode="view"
      scroll={scroll}
    />
  )
}
