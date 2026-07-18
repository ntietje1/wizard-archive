import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useEffect, useState } from 'react'
import type * as Y from 'yjs'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { useResolvedTheme } from '@wizard-archive/ui/theme/context'
import type { ContentCollaboration } from '../resources/content-session-contract'
import { NOTE_YJS_FRAGMENT } from './document/headless-yjs'
import { NoteFormattingToolbar } from './note-formatting-toolbar'
import { useNoteScrollPersistence } from './note-scroll-persistence'
import { noteEditorSchema } from './note-editor-schema'
import { NoteValueRuntimeProvider } from './values/runtime-context'
import { noteValueTransferExtension } from './values/value-transfer'
import { NoteSlashMenu } from './slash-menu/slash-menu'
import { NoteSideMenu } from './side-menu/side-menu'
import { createBlockNoteUuidV7Extension } from '../rich-text/blocknote/uuidv7'
import { createBlockNoteModifierClickSuppressionExtension } from '../rich-text/blocknote/modifier-click'
import './note-editor.css'
import type { NoteScrollBehavior } from './note-scroll-persistence'
import type { NoteHeadingNavigation, NoteHeadingNavigationRef } from './note-heading-navigation'
import { useBlockNoteActivation } from '../rich-text/blocknote/use-blocknote-activation'
import type { BlockNoteActivation } from '../rich-text/blocknote/use-blocknote-activation'
import { NoteBlockAccessMenuProvider } from './sharing/note-block-access-menu'
import type { NoteBlockAccessMenuBinding } from './sharing/note-block-access-menu'
import { NoteResourceRuntimeProvider } from './note-resource-runtime'
import type { NoteResourceBinding } from './note-resource-runtime-context'

type NoteEditorProps = {
  activation?: BlockNoteActivation
  blockAccess?: NoteBlockAccessMenuBinding
  collaboration?: ContentCollaboration
  document: Y.Doc
  formattingToolbar?: boolean
  headingNavigationRef?: NoteHeadingNavigationRef
  resources?: NoteResourceBinding
  label: string
  scroll: NoteScrollBehavior
} & (
  | { mode: 'view' }
  | { mode: 'edit'; persistence: 'initializing' }
  | { mode: 'edit'; persistence: 'ready'; onFlush: () => Promise<unknown> }
)

export function NoteEditor(props: NoteEditorProps) {
  return <NoteDocumentEditor key={props.document.guid} {...props} />
}

function NoteDocumentEditor(props: NoteEditorProps) {
  const { collaboration, document, headingNavigationRef, label } = props
  const editable = props.mode === 'edit'
  const flush = props.mode === 'edit' && props.persistence === 'ready' ? props.onFlush : null
  const resolvedTheme = useResolvedTheme()
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
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
      extensions: [
        createBlockNoteUuidV7Extension(true),
        createBlockNoteModifierClickSuppressionExtension(),
        noteValueTransferExtension,
      ],
    },
    [document],
  )
  useBlockNoteActivation(editor, props.activation ?? null)

  useEffect(() => {
    if (!flush) return
    return () => {
      void flush()
    }
  }, [flush])
  useEffect(() => {
    if (!headingNavigationRef) return
    const navigation: NoteHeadingNavigation = (blockId) => {
      const block = editor._tiptapEditor.view.dom.querySelector<HTMLElement>(
        `[data-id="${blockId}"]`,
      )
      if (!block) return
      block.scrollIntoView({ behavior: 'smooth', block: 'start' })
      editor.focus()
      editor.setTextCursorPosition(blockId, 'end')
    }
    headingNavigationRef.current = navigation
    return () => {
      if (headingNavigationRef.current === navigation) headingNavigationRef.current = null
    }
  }, [editor, headingNavigationRef])
  useNoteScrollPersistence(props.scroll, viewport)

  const content = (
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
        if (
          event.target instanceof Element &&
          event.target.closest('[data-blocknote-external-drop-target="true"]')
        ) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <NoteFormattingToolbar
        editor={editor}
        visible={editable && props.formattingToolbar !== false}
      />
      <ScrollArea
        className="min-h-0 flex-1"
        contentClassName="note-editor-scroll-content"
        viewportRef={setViewport}
      >
        <div className="note-editor-fill-height">
          <div className="note-editor-surface">
            <div className="note-editor-core-surface">
              <NoteResourceRuntimeProvider binding={props.resources} editable={editable}>
                <NoteValueRuntimeProvider editor={editor} editable={editable}>
                  <BlockNoteView
                    editable={editable}
                    editor={editor}
                    formattingToolbar={false}
                    linkToolbar={false}
                    sideMenu={false}
                    slashMenu={false}
                    theme={resolvedTheme}
                  >
                    {editable && (
                      <>
                        <SideMenuController sideMenu={NoteSideMenu} />
                        <NoteSlashMenu editor={editor} />
                      </>
                    )}
                  </BlockNoteView>
                </NoteValueRuntimeProvider>
              </NoteResourceRuntimeProvider>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
  return props.blockAccess ? (
    <NoteBlockAccessMenuProvider {...props.blockAccess}>{content}</NoteBlockAccessMenuProvider>
  ) : (
    content
  )
}

function isExternalFileDrop(dataTransfer: DataTransfer) {
  return dataTransfer.files.length > 0 || dataTransfer.types.includes('Files')
}
