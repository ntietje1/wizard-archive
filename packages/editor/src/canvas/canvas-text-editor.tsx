import { FormattingToolbarController, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { CanvasFormattingToolbar } from './canvas-formatting-toolbar'
import { createBlockNoteUuidV7Extension } from '../rich-text/blocknote/uuidv7'
import { createCanvasTextDocument, parseCanvasTextDocument } from './text/model'
import type { CanvasTextDocument } from './text/model'
import { canvasTextEditorSchema } from './text/schema'
import type { CanvasTextPartialBlock } from './text/schema'
import './canvas-text-editor.css'

export function CanvasTextEditor({
  content,
  onChange,
  onFinish,
}: {
  content: CanvasTextDocument | undefined
  onChange: (content: CanvasTextDocument) => void
  onFinish: () => void
}) {
  const initialContent = normalizeCanvasTextContent(content)
  const editor = useCreateBlockNote(
    {
      schema: canvasTextEditorSchema,
      initialContent,
      autofocus: 'end',
      domAttributes: { editor: { 'aria-label': 'Canvas text' } },
      disableExtensions: ['uniqueID'],
      extensions: [createBlockNoteUuidV7Extension(true)],
      setIdAttribute: true,
    },
    [],
  )
  const contentKey = JSON.stringify(content ?? [])
  const publishedContentKey = useRef(contentKey)

  useEffect(() => {
    if (contentKey === publishedContentKey.current) return
    publishedContentKey.current = contentKey
    editor.replaceBlocks(editor.document, normalizeCanvasTextContent(content))
  }, [content, contentKey, editor])

  const persist = () => {
    const parsed = parseCanvasTextDocument(structuredClone(editor.document))
    if (!parsed) return
    const nextKey = JSON.stringify(parsed)
    if (nextKey === publishedContentKey.current) return
    publishedContentKey.current = nextKey
    onChange(parsed)
  }

  return (
    <div
      className="canvas-text-editor nowheel nopan size-full overflow-auto rounded-md border bg-card text-sm outline-none ring-2 ring-ring"
      onKeyDownCapture={(event) => finishCanvasTextEditing(event, onFinish)}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <BlockNoteView
        className="min-h-full bg-transparent"
        editor={editor}
        formattingToolbar={false}
        linkToolbar={false}
        sideMenu={false}
        slashMenu={false}
        onChange={persist}
      >
        <FormattingToolbarController formattingToolbar={CanvasFormattingToolbar} />
      </BlockNoteView>
    </div>
  )
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
