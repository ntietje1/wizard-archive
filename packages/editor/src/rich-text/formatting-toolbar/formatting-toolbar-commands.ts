import {
  blockTypeSupportsProp,
  getSelectedBlocks,
  isTextFormattingBlock,
} from './formatting-toolbar-model'
import { restoreBlockNoteSelection } from '../blocknote/blocknote-selection-adapter'
import type { BlockNoteSelectionSnapshot } from '../blocknote/blocknote-selection-adapter'
import type {
  BlockTypeOption,
  RichTextFormattingEditor,
  InlineStyle,
  TextAlignment,
} from './formatting-toolbar-model'

export function applyFormattingToolbarBlockType({
  editor,
  nextType,
  selectionSnapshot,
}: {
  editor: RichTextFormattingEditor
  nextType: BlockTypeOption
  selectionSnapshot: BlockNoteSelectionSnapshot | null
}) {
  restoreBlockNoteSelection(editor, selectionSnapshot)
  const selectedBlocks = getSelectedBlocks(editor).filter(isTextFormattingBlock)
  editor.transact(() => {
    for (const block of selectedBlocks) {
      editor.updateBlock(block, {
        type: nextType.type,
        props: nextType.props,
      })
    }
  })
}

export function toggleFormattingToolbarInlineStyle({
  active,
  editor,
  hasTextSelection,
  selectionSnapshot,
  style,
}: {
  active: boolean
  editor: RichTextFormattingEditor
  hasTextSelection: boolean
  selectionSnapshot: BlockNoteSelectionSnapshot | null
  style: InlineStyle
}) {
  restoreBlockNoteSelection(editor, selectionSnapshot)

  if (!hasTextSelection) {
    if (active) {
      editor.removeStyles({ [style]: true })
    } else {
      editor.addStyles({ [style]: true })
    }
    editor.focus()
    return
  }

  editor.toggleStyles({ [style]: true })
}

export function applyFormattingToolbarTextAlignment({
  alignment,
  editor,
  selectionSnapshot,
}: {
  alignment: TextAlignment
  editor: RichTextFormattingEditor
  selectionSnapshot: BlockNoteSelectionSnapshot | null
}) {
  restoreBlockNoteSelection(editor, selectionSnapshot)
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

export function applyFormattingToolbarStyleColor({
  color,
  editor,
  scheduleFocus,
  selectionSnapshot,
  style,
}: {
  color: string
  editor: RichTextFormattingEditor
  scheduleFocus?: () => void
  selectionSnapshot: BlockNoteSelectionSnapshot | null
  style: 'backgroundColor' | 'textColor'
}) {
  restoreBlockNoteSelection(editor, selectionSnapshot)
  if (color === 'default') {
    editor.removeStyles({ [style]: 'default' })
  } else {
    editor.addStyles({ [style]: color })
  }
  editor.focus()
  scheduleFocus?.()
}
