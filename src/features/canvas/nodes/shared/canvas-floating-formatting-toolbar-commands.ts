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
    // Restore before styling so BlockNote applies the color to the intended range.
    restoreCanvasRichTextSelection(editor, selectionSnapshot)
    editor.addStyles({ textColor: color })
    // Focus synchronously for immediate text-selection feedback; focus can still adjust selection,
    // so restore again on the next frame after the browser/BlockNote focus work settles.
    editor.focus()
    requestAnimationFrame(() => {
      restoreCanvasRichTextSelection(editor, selectionSnapshot)
    })
    return
  }

  restoreCanvasRichTextSelection(editor, selectionSnapshot)
  applyCanvasRichTextDefaultTextColor(editor, defaultTextColor, color, selectionSnapshot)
  onDefaultTextColorChange?.(color)
  // Default-color changes do not need immediate selected-text feedback, so defer focus to avoid
  // stealing focus before the default style update and toolbar event finish.
  requestAnimationFrame(() => {
    editor.focus()
  })
}
