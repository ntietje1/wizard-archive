import { blockTypeSupportsProp, getSelectedBlocks } from './formatting-toolbar-model'
import { restoreBlockNoteSelection } from '~/features/editor/utils/blocknote-selection-adapter'
import type { BlockNoteSelectionSnapshot } from '~/features/editor/utils/blocknote-selection-adapter'
import type {
  BlockTypeOption,
  FormattingEditor,
  InlineStyle,
  TextAlignment,
} from './formatting-toolbar-model'

export function applyFormattingToolbarBlockType({
  editor,
  nextType,
  selectionSnapshot,
}: {
  editor: FormattingEditor
  nextType: BlockTypeOption
  selectionSnapshot: BlockNoteSelectionSnapshot | null
}) {
  restoreBlockNoteSelection(editor, selectionSnapshot)
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

export function toggleFormattingToolbarInlineStyle({
  editor,
  selectionSnapshot,
  style,
}: {
  editor: FormattingEditor
  selectionSnapshot: BlockNoteSelectionSnapshot | null
  style: InlineStyle
}) {
  restoreBlockNoteSelection(editor, selectionSnapshot)
  editor.toggleStyles({ [style]: true })
}

export function applyFormattingToolbarTextAlignment({
  alignment,
  editor,
  selectionSnapshot,
}: {
  alignment: TextAlignment
  editor: FormattingEditor
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
  selectionSnapshot,
  style,
}: {
  color: string
  editor: FormattingEditor
  selectionSnapshot: BlockNoteSelectionSnapshot | null
  style: 'backgroundColor' | 'textColor'
}) {
  restoreBlockNoteSelection(editor, selectionSnapshot)
  if (color === 'default') {
    editor.removeStyles({ [style]: undefined })
  } else {
    editor.addStyles({ [style]: color })
  }
  editor.focus()
  requestAnimationFrame(() => editor.focus())
}
