import { BlockNoteEditor } from '@blocknote/core'
import { canvasRichTextEditorSchema, cloneCanvasRichTextContent } from './canvas-rich-text-editor'
import type { CanvasRichTextContent, CanvasRichTextEditor } from './canvas-rich-text-editor'
import {
  captureBlockNoteSelection,
  restoreBlockNoteSelection,
} from '~/features/editor/utils/blocknote-selection-adapter'
import type { BlockNoteSelectionSnapshot } from '~/features/editor/utils/blocknote-selection-adapter'

export type CanvasRichTextSelectionSnapshot = BlockNoteSelectionSnapshot

export function createCanvasRichTextBlockNoteEditor({
  ariaLabel,
  content,
}: {
  ariaLabel: string
  content: CanvasRichTextContent
}): CanvasRichTextEditor {
  return BlockNoteEditor.create({
    schema: canvasRichTextEditorSchema,
    initialContent: cloneCanvasRichTextContent(content),
    placeholders: {
      emptyDocument: '',
      default: '',
      paragraph: '',
      heading: '',
      bulletListItem: '',
      numberedListItem: '',
      checkListItem: '',
      quote: '',
      codeBlock: '',
    },
    domAttributes: {
      editor: {
        'aria-label': ariaLabel,
        class: 'canvas-rich-text-editor',
      },
    },
  }) as CanvasRichTextEditor
}

export function observeCanvasRichTextChanges(
  editor: CanvasRichTextEditor,
  onChange: (editor: CanvasRichTextEditor) => void,
) {
  return editor.onChange((currentEditor) => {
    onChange(currentEditor as CanvasRichTextEditor)
  })
}

export function captureCanvasRichTextSelection(
  editor: Pick<CanvasRichTextEditor, 'focus'> | null,
): CanvasRichTextSelectionSnapshot | null {
  return captureBlockNoteSelection(editor)
}

export function restoreCanvasRichTextSelection(
  editor: Pick<CanvasRichTextEditor, 'focus'>,
  selectionSnapshot: CanvasRichTextSelectionSnapshot | null,
) {
  restoreBlockNoteSelection(editor, selectionSnapshot)
}
