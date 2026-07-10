import { BlockNoteEditor } from '@blocknote/core'
import { cloneCanvasTextContent } from './editor'
import { canvasTextEditorSchema } from './schema'
import type { CanvasTextContent } from './editor'
import type { CanvasTextEditor } from './schema'
import {
  captureBlockNoteSelection,
  restoreBlockNoteSelection,
} from '../../rich-text/blocknote/blocknote-selection-adapter'
import type { BlockNoteSelectionSnapshot } from '../../rich-text/blocknote/blocknote-selection-adapter'

export function createCanvasTextBlockNoteEditor({
  ariaLabel,
  content,
}: {
  ariaLabel: string
  content: CanvasTextContent
}): CanvasTextEditor {
  return BlockNoteEditor.create({
    schema: canvasTextEditorSchema,
    disableExtensions: ['link'],
    initialContent: cloneCanvasTextContent(content),
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
        class: 'canvas-text-editor',
      },
    },
  }) as CanvasTextEditor
}

export function observeCanvasTextChanges(
  editor: CanvasTextEditor,
  onChange: (editor: CanvasTextEditor) => void,
) {
  return editor.onChange((currentEditor) => {
    onChange(currentEditor as CanvasTextEditor)
  })
}

export function captureCanvasTextSelection(
  editor: Pick<CanvasTextEditor, 'focus'> | null,
): BlockNoteSelectionSnapshot | null {
  return captureBlockNoteSelection(editor)
}

export function restoreCanvasTextSelection(
  editor: Pick<CanvasTextEditor, 'focus'>,
  selectionSnapshot: BlockNoteSelectionSnapshot | null,
) {
  restoreBlockNoteSelection(editor, selectionSnapshot)
}
