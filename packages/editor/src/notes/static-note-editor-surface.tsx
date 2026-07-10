import { useStaticNoteContentEditor } from './static-note-editor'
import { StaticNoteRuntimeSurface } from './static-note-runtime-surface'
import type { CSSProperties, ReactNode } from 'react'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { NoteBlock } from './document/model'
import type { NoteItemWithContent } from '../notes/item-contract'
import type {
  NoteEmbedTargetContentSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
} from './runtime'
import type { StaticNoteEditorChangeHandler } from './static-note-editor'
import type { EmbeddedNotePreviewRenderer } from './embeds/embedded-note-preview-renderer'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from './value-runtime-model'

export function StaticNoteEditorSurface({
  children,
  content,
  evaluateValuesFromEditor,
  embedTargetSource,
  linkNavigationSource,
  linkResolutionSource,
  note,
  noteId,
  noteValueReferences,
  noteValueStateSource,
  onEditorChange,
  renderEmbeddedNotePreview,
  style,
}: {
  children?: ReactNode
  content: Array<NoteBlock>
  evaluateValuesFromEditor: boolean
  embedTargetSource: NoteEmbedTargetContentSource
  linkNavigationSource: NoteLinkNavigationSource | null
  linkResolutionSource: NoteLinkResolutionSource
  note?: NoteItemWithContent
  noteId?: SidebarItemId
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  onEditorChange?: StaticNoteEditorChangeHandler
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
  style?: CSSProperties
}) {
  const editor = useStaticNoteContentEditor({
    content,
    noteId,
    onEditorChange,
  })

  if (!editor) return null

  return (
    <StaticNoteRuntimeSurface
      editor={editor}
      evaluateValuesFromEditor={evaluateValuesFromEditor}
      embedTargetSource={embedTargetSource}
      linkNavigationSource={linkNavigationSource}
      linkResolutionSource={linkResolutionSource}
      note={note}
      noteId={noteId}
      noteValueReferences={noteValueReferences}
      noteValueStateSource={noteValueStateSource}
      renderEmbeddedNotePreview={renderEmbeddedNotePreview}
      style={style}
    >
      {children}
    </StaticNoteRuntimeSurface>
  )
}
