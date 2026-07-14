import type { ResourceId } from '../resources/domain-id'
import { createEmbeddedNotePreviewRenderer } from './embeds/embedded-note-preview-renderer'
import { StaticNoteEditorSurface } from './static-note-editor-surface'
import type { CSSProperties, ReactNode } from 'react'

import type { NoteBlock } from './document/model'
import type { NoteItemWithContent } from '../notes/item-contract'
import type {
  EmbeddedNoteContentSource,
  NoteEmbedTargetContentSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
} from './runtime'
import type { StaticNoteEditorChangeHandler } from './static-note-editor'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from './value-runtime-model'

type StaticNoteContentProps = {
  children?: ReactNode
  className?: string
  content: Array<NoteBlock>
  evaluateValuesFromEditor?: boolean
  fillHeight?: boolean
  embeddedNoteContentSource: EmbeddedNoteContentSource
  embedTargetSource: NoteEmbedTargetContentSource
  linkNavigationSource: NoteLinkNavigationSource | null
  linkResolutionSource: NoteLinkResolutionSource
  note?: NoteItemWithContent
  noteId?: ResourceId
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  onEditorChange?: StaticNoteEditorChangeHandler
  style?: CSSProperties
}

export function StaticNoteContent({
  children,
  className,
  content,
  evaluateValuesFromEditor = false,
  fillHeight = false,
  embeddedNoteContentSource,
  embedTargetSource,
  linkNavigationSource,
  linkResolutionSource,
  note,
  noteId,
  noteValueReferences,
  noteValueStateSource,
  onEditorChange,
  style,
}: StaticNoteContentProps) {
  const body = (
    <StaticNoteEditorSurface
      content={content}
      evaluateValuesFromEditor={evaluateValuesFromEditor}
      embedTargetSource={embedTargetSource}
      linkNavigationSource={linkNavigationSource}
      linkResolutionSource={linkResolutionSource}
      note={note}
      noteId={noteId}
      noteValueReferences={noteValueReferences}
      noteValueStateSource={noteValueStateSource}
      onEditorChange={onEditorChange}
      renderEmbeddedNotePreview={createStaticNotePreviewRenderer(embeddedNoteContentSource)}
      style={style}
    >
      {children}
    </StaticNoteEditorSurface>
  )

  return (
    <div className={fillHeight ? 'note-editor-fill-height' : undefined}>
      <div className={className}>{body}</div>
    </div>
  )
}

function createStaticNotePreviewRenderer(source: EmbeddedNoteContentSource) {
  return createEmbeddedNotePreviewRenderer({
    source,
  })
}
