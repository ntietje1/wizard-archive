import type { ResourceId } from '../resources/domain-id'
import { NoteEditorCore } from './editor-core'
import { NoteValueRuntimeProvider } from './value-block/value-block-runtime'
import type { CustomBlockNoteEditor } from './editor-schema'

import type { NoteItemWithContent } from '../notes/item-contract'
import type { CSSProperties, ReactNode } from 'react'
import type { LinkResolver } from './references/resolver'
import type { NoteValueRuntimeSource } from './value-runtime-model'
import type { EmbedTargetOperations } from '../embeds/target-operations'
import type { EmbeddedNotePreviewRenderer } from './embeds/embedded-note-preview-renderer'

export function NoteView({
  editor,
  note,
  noteId,
  editable,
  evaluateValuesFromEditor = editable,
  linkResolver,
  valueRuntimeSource,
  editableChrome = null,
  embedTargetOperations,
  renderEmbeddedNotePreview,
  style,
  children,
}: {
  editor: CustomBlockNoteEditor
  note?: NoteItemWithContent
  noteId?: ResourceId
  editable: boolean
  evaluateValuesFromEditor?: boolean
  linkResolver: LinkResolver
  valueRuntimeSource: NoteValueRuntimeSource
  editableChrome?: ReactNode
  embedTargetOperations?: EmbedTargetOperations
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
  style?: CSSProperties
  children?: ReactNode
}) {
  const isViewerMode = !editable || linkResolver.isViewerMode
  const sourceNoteId = note?.id ?? noteId ?? null

  return (
    <NoteValueRuntimeProvider
      editor={editor}
      source={valueRuntimeSource}
      editable={editable}
      evaluateValuesFromEditor={evaluateValuesFromEditor}
    >
      <NoteEditorCore
        editor={editor}
        editable={editable}
        editableChrome={editableChrome}
        embedTargetOperations={embedTargetOperations}
        enableYjsHistory={!isViewerMode}
        linkResolver={linkResolver}
        renderEmbeddedNotePreview={renderEmbeddedNotePreview}
        sourceNoteId={sourceNoteId}
        style={style}
      >
        {children}
      </NoteEditorCore>
    </NoteValueRuntimeProvider>
  )
}
