import { applyCanvasRichTextDefaultTextColor } from './canvas-rich-text-default-color'
import { restoreCanvasRichTextSelection } from './canvas-rich-text-blocknote-adapter'
import {
  blockTypeSupportsProp,
  getSelectedBlocks,
} from './canvas-floating-formatting-toolbar-model'
import type { CanvasRichTextSelectionSnapshot } from './canvas-rich-text-blocknote-adapter'
import type {
  BlockTypeOption,
  FormattingEditor,
  InlineStyle,
  TextAlignment,
} from './canvas-floating-formatting-toolbar-model'

export function applyCanvasToolbarBlockType({
  editor,
  nextType,
  selectionSnapshot,
}: {
  editor: FormattingEditor
  nextType: BlockTypeOption
  selectionSnapshot: CanvasRichTextSelectionSnapshot | null
}) {
  restoreCanvasRichTextSelection(editor, selectionSnapshot)
  const selectedBlocks = getSelectedBlocks(editor)
  editor.transact(() => {
    for (const block of selectedBlocks) {
      editor.updateBlock(block, {
        type: nextType.type,
        props: nextType.props,
      })
    }
  })
}

export function toggleCanvasToolbarInlineStyle({
  editor,
  selectionSnapshot,
  style,
}: {
  editor: FormattingEditor
  selectionSnapshot: CanvasRichTextSelectionSnapshot | null
  style: InlineStyle
}) {
  restoreCanvasRichTextSelection(editor, selectionSnapshot)
  editor.toggleStyles({ [style]: true })
}

export function applyCanvasToolbarTextAlignment({
  alignment,
  editor,
  selectionSnapshot,
}: {
  alignment: TextAlignment
  editor: FormattingEditor
  selectionSnapshot: CanvasRichTextSelectionSnapshot | null
}) {
  restoreCanvasRichTextSelection(editor, selectionSnapshot)
  const selectedBlocks = getSelectedBlocks(editor)
  editor.transact(() => {
    for (const block of selectedBlocks) {
      if (!blockTypeSupportsProp(editor, block.type, 'textAlignment')) {
        continue
      }

      editor.updateBlock(block, {
        props: { textAlignment: alignment },
      })
    }
  })
}

export function applyCanvasToolbarTextColor({
  color,
  defaultTextColor,
  editor,
  hasTextSelection,
  onDefaultTextColorChange,
  selectionSnapshot,
}: {
  color: string
  defaultTextColor: string
  editor: FormattingEditor
  hasTextSelection: boolean
  onDefaultTextColorChange?: (color: string) => void
  selectionSnapshot: CanvasRichTextSelectionSnapshot | null
}) {
  if (hasTextSelection) {
    restoreCanvasRichTextSelection(editor, selectionSnapshot)
    editor.addStyles({ textColor: color })
    editor.focus()
    requestAnimationFrame(() => {
      restoreCanvasRichTextSelection(editor, selectionSnapshot)
    })
    return
  }

  restoreCanvasRichTextSelection(editor, selectionSnapshot)
  applyCanvasRichTextDefaultTextColor(editor, defaultTextColor, color, selectionSnapshot)
  onDefaultTextColorChange?.(color)
  requestAnimationFrame(() => {
    editor.focus()
  })
}
