import type { BlockNoteEditor } from '@blocknote/core'
import { restoreCanvasRichTextSelection } from './canvas-rich-text-blocknote-adapter'
import type { CanvasRichTextSelectionSnapshot } from './canvas-rich-text-blocknote-adapter'

type CanvasRichTextDefaultColorEditor = Pick<
  BlockNoteEditor<any, any, any>,
  'addStyles' | 'document' | 'focus' | 'replaceBlocks'
>

interface RichTextBlock {
  children?: Array<RichTextBlock>
  content?: unknown
}

export function applyCanvasRichTextDefaultTextColor(
  editor: CanvasRichTextDefaultColorEditor,
  previousDefaultTextColor: string,
  nextDefaultTextColor: string,
  selectionSnapshot: CanvasRichTextSelectionSnapshot | null = null,
) {
  restoreCanvasRichTextSelection(editor, selectionSnapshot)

  const materializedDocument = materializeCanvasRichTextDefaultTextColor(
    editor.document,
    previousDefaultTextColor,
  )
  if (materializedDocument !== editor.document) {
    editor.replaceBlocks(editor.document, materializedDocument)
    restoreCanvasRichTextSelection(editor, selectionSnapshot)
  }

  editor.addStyles({ textColor: nextDefaultTextColor })
  editor.focus()
}

function materializeCanvasRichTextDefaultTextColor<TBlock extends RichTextBlock>(
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

function materializeBlockTextColor<TBlock extends RichTextBlock>(
  block: TBlock,
  textColor: string,
): TBlock {
  const nextContent = materializeInlineContentTextColor(block.content, textColor)
  const nextChildren = block.children
    ? materializeCanvasRichTextDefaultTextColor(block.children, textColor)
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
