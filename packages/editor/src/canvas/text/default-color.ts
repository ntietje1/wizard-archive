import type { BlockNoteEditor } from '@blocknote/core'
import { restoreCanvasTextSelection } from './blocknote-adapter'
import type { BlockNoteSelectionSnapshot } from '../../rich-text/blocknote/blocknote-selection-adapter'

type CanvasTextDefaultColorEditor = Pick<
  BlockNoteEditor<any, any, any>,
  'addStyles' | 'document' | 'focus' | 'replaceBlocks'
>

interface CanvasTextBlockWithChildren {
  children?: Array<CanvasTextBlockWithChildren>
  content?: unknown
}

export function applyCanvasTextDefaultTextColor(
  editor: CanvasTextDefaultColorEditor,
  previousDefaultTextColor: string,
  nextDefaultTextColor: string,
  selectionSnapshot: BlockNoteSelectionSnapshot | null = null,
) {
  restoreCanvasTextSelection(editor, selectionSnapshot)

  const originalDocument = editor.document
  const materializedDocument = materializeCanvasTextDefaultTextColor(
    originalDocument,
    previousDefaultTextColor,
  )
  if (materializedDocument !== originalDocument) {
    editor.replaceBlocks(originalDocument, materializedDocument)
    restoreCanvasTextSelection(editor, selectionSnapshot)
  }

  editor.addStyles({ textColor: nextDefaultTextColor })
  editor.focus()
}

function materializeCanvasTextDefaultTextColor<TBlock extends CanvasTextBlockWithChildren>(
  blocks: Array<TBlock>,
  textColor: string,
): Array<TBlock> {
  let changed = false
  const nextBlocks = blocks.map((block) => {
    const nextBlock = materializeBlockTextColor(block, textColor)
    if (nextBlock !== block) {
      changed = true
    }
    return nextBlock
  })

  return changed ? nextBlocks : blocks
}

function materializeBlockTextColor<TBlock extends CanvasTextBlockWithChildren>(
  block: TBlock,
  textColor: string,
): TBlock {
  const nextContent = materializeInlineContentTextColor(block.content, textColor)
  const nextChildren = block.children
    ? materializeCanvasTextDefaultTextColor(block.children, textColor)
    : undefined

  if (nextContent === block.content && nextChildren === block.children) {
    return block
  }

  return {
    ...block,
    content: nextContent,
    ...('children' in block ? { children: nextChildren } : {}),
  }
}

function materializeInlineContentTextColor(content: unknown, textColor: string): unknown {
  if (!Array.isArray(content)) {
    return content
  }

  let changed = false
  const nextContent = content.map((item) => {
    const nextItem = materializeInlineTextItemColor(item, textColor)
    if (nextItem !== item) {
      changed = true
    }
    return nextItem
  })

  return changed ? nextContent : content
}

function materializeInlineTextItemColor(item: unknown, textColor: string): unknown {
  if (typeof item === 'string') {
    return item.length > 0 ? { type: 'text', text: item, styles: { textColor } } : item
  }

  if (!item || typeof item !== 'object') {
    return item
  }

  const inlineItem = item as { content?: unknown; styles?: unknown; text?: unknown }
  if (Array.isArray(inlineItem.content)) {
    const nextContent = materializeInlineContentTextColor(inlineItem.content, textColor)
    return nextContent === inlineItem.content ? item : { ...inlineItem, content: nextContent }
  }

  if (typeof inlineItem.text !== 'string' || inlineItem.text.length === 0) {
    return item
  }

  const styles = inlineItem.styles
  if (
    styles &&
    typeof styles === 'object' &&
    typeof (styles as { textColor?: unknown }).textColor === 'string'
  ) {
    return item
  }

  return {
    ...inlineItem,
    styles: {
      ...(styles && typeof styles === 'object' ? styles : {}),
      textColor,
    },
  }
}
