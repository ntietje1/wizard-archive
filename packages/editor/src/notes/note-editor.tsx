import { BlockNoteSchema } from '@blocknote/core'
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { Sigma } from 'lucide-react'
import { useEffect } from 'react'
import type * as Y from 'yjs'
import type { ContentCollaboration } from '../resources/content-session-contract'
import { createNoteBlockSpecs } from './document/schema-factory'
import { NOTE_YJS_FRAGMENT } from './document/headless-yjs'
import { noteInlineContentSpecs, noteStyleSpecs } from './dom-specs'
import { reactNoteValueInlineSpec } from './values/react-spec'
import { NoteValueRuntimeProvider } from './values/runtime-context'
import { noteValueTransferExtension } from './values/value-transfer'
import { createBlockNoteUuidV7Extension } from '../rich-text/blocknote/uuidv7'
import { generateUuidV7 } from '../resources/domain-id'
import './note-editor.css'

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

type NoteEditorProps = {
  collaboration?: ContentCollaboration
  document: Y.Doc
  label: string
} & (
  | { mode: 'view' }
  | { mode: 'edit'; persistence: 'initializing' }
  | { mode: 'edit'; persistence: 'ready'; onFlush: () => Promise<unknown> }
)

export function NoteEditor(props: NoteEditorProps) {
  return <NoteDocumentEditor key={props.document.guid} {...props} />
}

function NoteDocumentEditor(props: NoteEditorProps) {
  const { collaboration, document, label } = props
  const editable = props.mode === 'edit'
  const flush = props.mode === 'edit' && props.persistence === 'ready' ? props.onFlush : null
  const editor = useCreateBlockNote(
    {
      schema: noteEditorSchema,
      collaboration: {
        fragment: document.getXmlFragment(NOTE_YJS_FRAGMENT),
        provider: collaboration?.provider,
        user: collaboration?.user ?? { name: 'You', color: '#5e6ad2' },
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
      disableExtensions: ['uniqueID'],
      extensions: [createBlockNoteUuidV7Extension(true), noteValueTransferExtension],
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

  useEffect(() => {
    if (!flush) return
    return () => {
      void flush()
    }
  }, [flush])

  return (
    <div
      className="resource-note-editor min-h-0 flex-1 overflow-auto"
      onBlurCapture={
        flush
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) void flush()
            }
          : undefined
      }
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
          formattingToolbar={editable}
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
