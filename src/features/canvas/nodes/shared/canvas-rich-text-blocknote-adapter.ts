import { BlockNoteEditor } from '@blocknote/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Selection } from '@tiptap/pm/state'
import { canvasRichTextEditorSchema, cloneCanvasRichTextContent } from './canvas-rich-text-editor'
import type { CanvasRichTextContent, CanvasRichTextEditor } from './canvas-rich-text-editor'
import { logger } from '~/shared/utils/logger'

export type CanvasRichTextSelectionSnapshot = Record<string, unknown>

type CanvasRichTextFocusableEditor = Pick<CanvasRichTextEditor, 'focus'>
type CanvasRichTextStyleReader = Pick<CanvasRichTextEditor, 'getActiveStyles'>

interface CanvasRichTextEditorView {
  dispatch: (transaction: unknown) => void
  focus: () => void
  state: {
    doc: unknown
    selection: {
      toJSON: () => CanvasRichTextSelectionSnapshot
    }
    tr: {
      setSelection: (selection: Selection) => unknown
    }
  }
}

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
  editor: CanvasRichTextFocusableEditor | null,
): CanvasRichTextSelectionSnapshot | null {
  return getCanvasRichTextEditorView(editor)?.state.selection.toJSON() ?? null
}

export function restoreCanvasRichTextSelection(
  editor: CanvasRichTextFocusableEditor,
  selectionSnapshot: CanvasRichTextSelectionSnapshot | null,
) {
  const view = getCanvasRichTextEditorView(editor)
  if (!view) {
    editor.focus()
    return
  }

  if (selectionSnapshot) {
    try {
      const nextSelection = Selection.fromJSON(view.state.doc as ProseMirrorNode, selectionSnapshot)
      view.dispatch(view.state.tr.setSelection(nextSelection))
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.debug(
          'Failed to restore selection from snapshot, falling back to current editor selection',
          error,
        )
      }
    }
  }

  view.focus()
}

export function readCanvasRichTextActiveStyles<TStyle extends string>(
  editor: CanvasRichTextStyleReader,
): Partial<Record<TStyle, boolean>> {
  return editor.getActiveStyles() as Partial<Record<TStyle, boolean>>
}

function getCanvasRichTextEditorView(
  editor: CanvasRichTextFocusableEditor | null,
): CanvasRichTextEditorView | null {
  // BlockNote does not expose the ProseMirror view publicly in the current version used here.
  // Keep this private access isolated so future BlockNote upgrades have one place to revisit.
  const tiptapEditor = (editor as { _tiptapEditor?: { view?: CanvasRichTextEditorView } } | null)
    ?._tiptapEditor
  if (editor && (!tiptapEditor || typeof tiptapEditor !== 'object')) {
    // Fail fast if BlockNote changes the private `_tiptapEditor -> view` path this adapter relies on.
    throw new TypeError(
      `getCanvasRichTextEditorView: unexpected BlockNote editor shape ${JSON.stringify(editor)}`,
    )
  }
  return tiptapEditor?.view ?? null
}
