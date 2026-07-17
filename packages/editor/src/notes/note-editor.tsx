import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useEffect } from 'react'
import type * as Y from 'yjs'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { useResolvedTheme } from '@wizard-archive/ui/theme/context'
import type { ContentCollaboration } from '../resources/content-session-contract'
import { NOTE_YJS_FRAGMENT } from './document/headless-yjs'
import { noteEditorSchema } from './note-editor-schema'
import { NoteValueRuntimeProvider } from './values/runtime-context'
import { noteValueTransferExtension } from './values/value-transfer'
import { NoteSlashMenu } from './slash-menu/slash-menu'
import { createBlockNoteUuidV7Extension } from '../rich-text/blocknote/uuidv7'
import './note-editor.css'

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
  const resolvedTheme = useResolvedTheme()
  const editor = useCreateBlockNote(
    {
      schema: noteEditorSchema,
      collaboration: {
        fragment: document.getXmlFragment(NOTE_YJS_FRAGMENT),
        provider: collaboration?.provider,
        user: collaboration?.user ?? { name: 'You', color: '#5e6ad2' },
      },
      autofocus: false,
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

  useEffect(() => {
    if (!flush) return
    return () => {
      void flush()
    }
  }, [flush])

  return (
    <div
      className="resource-note-editor relative flex min-h-0 flex-1 flex-col"
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
      <ScrollArea className="min-h-0 flex-1" contentClassName="note-editor-scroll-content">
        <div className="note-editor-fill-height">
          <div className="note-editor-surface">
            <div className="note-editor-core-surface">
              <NoteValueRuntimeProvider editor={editor} editable={editable}>
                <BlockNoteView
                  editable={editable}
                  editor={editor}
                  formattingToolbar={editable}
                  linkToolbar={false}
                  sideMenu={editable}
                  slashMenu={false}
                  theme={resolvedTheme}
                >
                  {editable && <NoteSlashMenu editor={editor} />}
                </BlockNoteView>
              </NoteValueRuntimeProvider>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

function isExternalFileDrop(dataTransfer: DataTransfer) {
  return dataTransfer.files.length > 0 || dataTransfer.types.includes('Files')
}
