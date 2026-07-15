import { BlockNoteSchema } from '@blocknote/core'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import { useEffect } from 'react'
import type * as Y from 'yjs'
import { createNoteBlockSpecs } from './document/schema-factory'
import { NOTE_YJS_FRAGMENT } from './document/headless-yjs'
import { noteInlineContentSpecs, noteStyleSpecs } from './dom-specs'
import { configureBlockNoteUuidV7 } from '../rich-text/blocknote/uuidv7'
import './note-editor.css'

configureBlockNoteUuidV7()

const noteBlockSpecs = createNoteBlockSpecs({
  renderEmbedBlock: () => {
    const element = document.createElement('div')
    element.className = 'note-embed-placeholder'
    element.textContent = 'Embedded content'
    return { dom: element }
  },
})

const noteEditorSchema = BlockNoteSchema.create({
  blockSpecs: noteBlockSpecs,
  inlineContentSpecs: noteInlineContentSpecs,
  styleSpecs: noteStyleSpecs,
})

export function NoteEditor({
  document,
  editable,
  label,
  onFlush,
}: {
  document: Y.Doc
  editable: boolean
  label: string
  onFlush: () => Promise<unknown>
}) {
  return (
    <NoteDocumentEditor
      key={document.guid}
      document={document}
      editable={editable}
      label={label}
      onFlush={onFlush}
    />
  )
}

function NoteDocumentEditor({
  document,
  editable,
  label,
  onFlush,
}: {
  document: Y.Doc
  editable: boolean
  label: string
  onFlush: () => Promise<unknown>
}) {
  const editor = useCreateBlockNote(
    {
      schema: noteEditorSchema,
      collaboration: {
        fragment: document.getXmlFragment(NOTE_YJS_FRAGMENT),
        user: { name: 'You', color: '#5e6ad2' },
      },
      autofocus: editable ? 'end' : false,
      domAttributes: { editor: { 'aria-label': label } },
      setIdAttribute: true,
      tables: {
        cellBackgroundColor: true,
        cellTextColor: true,
        headers: true,
        splitCells: true,
      },
    },
    [document],
  )

  useEffect(
    () => () => {
      void onFlush()
    },
    [onFlush],
  )

  return (
    <div
      className="resource-note-editor min-h-0 flex-1 overflow-auto"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) void onFlush()
      }}
      onDropCapture={(event) => {
        if (!editable || !isExternalDrop(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <BlockNoteView
        className="min-h-full"
        editable={editable}
        editor={editor}
        formattingToolbar
        linkToolbar={false}
        sideMenu={editable}
        slashMenu={editable}
      />
    </div>
  )
}

function isExternalDrop(dataTransfer: DataTransfer) {
  return (
    dataTransfer.files.length > 0 ||
    dataTransfer.types.includes('text/uri-list') ||
    dataTransfer.types.includes('text/html')
  )
}
