import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { Fragment, useLayoutEffect, useRef } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { CanvasFloatingFormattingToolbar } from './canvas-floating-formatting-toolbar'
import { createBlockNoteModifierClickSuppressionExtension } from '../rich-text/blocknote/modifier-click'
import { createBlockNoteUuidV7Extension } from '../rich-text/blocknote/uuidv7'
import { createCanvasTextDocument, parseCanvasTextDocument } from './text/model'
import type { CanvasTextDocument } from './text/model'
import { canvasTextEditorSchema } from './text/schema'
import type { CanvasTextPartialBlock } from './text/schema'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { useBlockNoteActivation } from '../rich-text/blocknote/use-blocknote-activation'
import type { BlockNoteActivation } from '../rich-text/blocknote/use-blocknote-activation'
import './canvas-text-editor.css'

type CanvasTextEditorProps = {
  activation: BlockNoteActivation | null
  content: CanvasTextDocument | undefined
  exclusivelySelected: boolean
  onChange: (content: CanvasTextDocument) => void
  onFinish: () => void
  selected: boolean
  style: CSSProperties
  textColor: string
} & ({ editing: false } | { editing: true; onDefaultTextColorChange: (color: string) => void })

export function CanvasTextEditor(props: CanvasTextEditorProps) {
  const {
    activation,
    content,
    editing,
    exclusivelySelected,
    onChange,
    onFinish,
    selected,
    style,
    textColor,
  } = props
  const initialContent = normalizeCanvasTextContent(content)
  const editor = useCreateBlockNote(
    {
      schema: canvasTextEditorSchema,
      initialContent,
      autofocus: false,
      domAttributes: { editor: { 'aria-label': 'Canvas text' } },
      disableExtensions: ['uniqueID'],
      extensions: [
        createBlockNoteUuidV7Extension(true),
        createBlockNoteModifierClickSuppressionExtension(),
      ],
      setIdAttribute: true,
    },
    [],
  )
  const contentKey = JSON.stringify(content ?? [])
  const sourceContentKey = useRef(contentKey)
  const publishedContentKey = useRef<string | null>(null)
  if (publishedContentKey.current === null) {
    publishedContentKey.current = canvasEditorDocumentKey(editor)
  }

  useLayoutEffect(() => {
    if (contentKey === sourceContentKey.current) return
    sourceContentKey.current = contentKey
    editor.replaceBlocks(editor.document, normalizeCanvasTextContent(content))
    publishedContentKey.current = canvasEditorDocumentKey(editor)
  }, [content, contentKey, editor])

  useBlockNoteActivation(editor, editing ? activation : null)

  const persist = () => {
    const parsed = parseCanvasTextDocument(structuredClone(editor.document))
    if (!parsed) return
    const nextKey = JSON.stringify(parsed)
    if (nextKey === publishedContentKey.current) return
    publishedContentKey.current = nextKey
    sourceContentKey.current = nextKey
    onChange(parsed)
  }

  return (
    <Fragment>
      {editing && (
        <CanvasFloatingFormattingToolbar
          defaultTextColor={textColor}
          editor={editor}
          onDefaultTextColorChange={props.onDefaultTextColorChange}
        />
      )}
      <div
        className={`canvas-text-editor size-full overflow-hidden rounded-md border bg-card text-sm outline-none ${exclusivelySelected ? 'nowheel' : ''} ${editing ? 'nopan select-text ring-2 ring-ring' : `select-none shadow-sm ${selected ? 'ring-2 ring-ring' : ''}`}`}
        style={style}
        onKeyDownCapture={editing ? (event) => finishCanvasTextEditing(event, onFinish) : undefined}
        onPointerDown={editing ? (event) => event.stopPropagation() : undefined}
      >
        <ScrollArea className="size-full">
          <BlockNoteView
            className="min-h-full bg-transparent"
            editable={editing}
            editor={editor}
            formattingToolbar={false}
            linkToolbar={false}
            sideMenu={false}
            slashMenu={false}
            onChange={editing ? persist : undefined}
          />
        </ScrollArea>
      </div>
    </Fragment>
  )
}

function canvasEditorDocumentKey(editor: { document: unknown }): string {
  return JSON.stringify(parseCanvasTextDocument(structuredClone(editor.document)) ?? [])
}

function normalizeCanvasTextContent(
  content: CanvasTextDocument | undefined,
): Array<CanvasTextPartialBlock> {
  return structuredClone(
    content?.length ? content : createCanvasTextDocument(''),
  ) as Array<CanvasTextPartialBlock>
}

function finishCanvasTextEditing(event: KeyboardEvent<HTMLElement>, onFinish: () => void): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  onFinish()
}
