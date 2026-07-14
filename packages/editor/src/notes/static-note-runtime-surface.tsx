import type { ResourceId } from '../resources/domain-id'
import { NoteDocumentRuntime, NoteLinkClickHandler } from './document-runtime'
import { NoteView } from './view'
import type { CustomBlockNoteEditor } from './editor-schema'
import type { CSSProperties, ReactNode } from 'react'

import type { NoteItemWithContent } from '../notes/item-contract'
import type {
  NoteEmbedTargetContentSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
} from './runtime'
import type { EmbeddedNotePreviewRenderer } from './embeds/embedded-note-preview-renderer'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from './value-runtime-model'

export function StaticNoteRuntimeSurface({
  children,
  editor,
  evaluateValuesFromEditor,
  embedTargetSource,
  linkNavigationSource,
  linkResolutionSource,
  note,
  noteId,
  noteValueReferences,
  noteValueStateSource,
  renderEmbeddedNotePreview,
  style,
}: {
  children?: ReactNode
  editor: CustomBlockNoteEditor
  evaluateValuesFromEditor: boolean
  embedTargetSource: NoteEmbedTargetContentSource
  linkNavigationSource: NoteLinkNavigationSource | null
  linkResolutionSource: NoteLinkResolutionSource
  note?: NoteItemWithContent
  noteId?: ResourceId
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
  style?: CSSProperties
}) {
  return (
    <NoteDocumentRuntime
      editor={editor}
      isViewerMode
      linkResolutionSource={linkResolutionSource}
      noteId={noteId}
      noteValueReferences={noteValueReferences}
      noteValueStateSource={noteValueStateSource}
    >
      {({ linkResolver, valueRuntimeSource }) => (
        <>
          <NoteView
            editor={editor}
            note={note}
            noteId={noteId}
            editable={false}
            evaluateValuesFromEditor={evaluateValuesFromEditor}
            embedTargetOperations={embedTargetSource.embedTargetOperations}
            linkResolver={linkResolver}
            renderEmbeddedNotePreview={renderEmbeddedNotePreview}
            valueRuntimeSource={valueRuntimeSource}
            style={style}
          >
            {children}
          </NoteView>
          <NoteLinkClickHandler
            editor={editor}
            editorMode="viewer"
            linkCreation={null}
            linkNavigationSource={linkNavigationSource}
            sourceNoteId={noteId}
          />
        </>
      )}
    </NoteDocumentRuntime>
  )
}
