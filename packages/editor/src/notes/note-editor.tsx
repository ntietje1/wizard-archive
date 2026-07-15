import { BlockNoteSchema } from '@blocknote/core'
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import { Sigma } from 'lucide-react'
import { useEffect } from 'react'
import type * as Y from 'yjs'
import { createNoteBlockSpecs } from './document/schema-factory'
import { NOTE_YJS_FRAGMENT } from './document/headless-yjs'
import { noteInlineContentSpecs, noteStyleSpecs } from './dom-specs'
import { reactNoteValueInlineSpec } from './values/react-spec'
import { NoteValueRuntimeProvider } from './values/runtime-context'
import { noteValueTransferExtension } from './values/value-transfer'
import { configureBlockNoteUuidV7 } from '../rich-text/blocknote/uuidv7'
import { generateUuidV7 } from '../resources/domain-id'
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
const { value: _value, ...noteInlineContentSpecsWithoutValue } = noteInlineContentSpecs

const noteEditorSchema = BlockNoteSchema.create({
  blockSpecs: noteBlockSpecs,
  inlineContentSpecs: {
    ...noteInlineContentSpecsWithoutValue,
    value: reactNoteValueInlineSpec,
  },
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
      extensions: [noteValueTransferExtension],
    },
    [document],
  )
  const insertValue = () => {
    editor.focus()
    editor.insertInlineContent(
      [
        {
          type: 'value',
          props: { valueId: generateUuidV7(), label: 'Value', expressionSource: '0' },
        },
      ],
      { updateSelection: true },
    )
  }

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
        if (!editable || !isExternalFileDrop(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {editable && (
        <div className="note-editor-toolbar">
          <button type="button" onClick={insertValue}>
            <Sigma aria-hidden="true" />
            Value
          </button>
        </div>
      )}
      <NoteValueRuntimeProvider editor={editor} editable={editable}>
        <BlockNoteView
          className="min-h-full"
          editable={editable}
          editor={editor}
          formattingToolbar
          linkToolbar={false}
          sideMenu={editable}
          slashMenu={false}
        >
          {editable && (
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={(query) => {
                const normalizedQuery = query.trim().toLowerCase()
                const items = [
                  ...getDefaultReactSlashMenuItems(editor),
                  {
                    title: 'Value',
                    subtext: 'Create a referenceable value or formula',
                    aliases: ['formula', 'stat', 'property'],
                    group: 'Other',
                    icon: <Sigma />,
                    onItemClick: insertValue,
                  },
                ]
                return Promise.resolve(
                  items.filter((item) =>
                    [item.title, item.subtext ?? '', ...(item.aliases ?? [])]
                      .join(' ')
                      .toLowerCase()
                      .includes(normalizedQuery),
                  ),
                )
              }}
            />
          )}
        </BlockNoteView>
      </NoteValueRuntimeProvider>
    </div>
  )
}

function isExternalFileDrop(dataTransfer: DataTransfer) {
  return dataTransfer.files.length > 0 || dataTransfer.types.includes('Files')
}
