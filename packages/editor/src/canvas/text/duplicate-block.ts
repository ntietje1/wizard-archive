import { generateUuidV7 } from '../../resources/domain-id'
import type {
  RichTextBlockMenuBlock,
  RichTextBlockMenuEditor,
} from '../../rich-text/block-menu/block-menu'

export function duplicateCanvasTextBlock(
  editor: RichTextBlockMenuEditor,
  block: RichTextBlockMenuBlock,
) {
  const [duplicate] = editor.insertBlocks([copyCanvasTextBlock(block)], block, 'after')
  if (duplicate) editor.setTextCursorPosition(duplicate, 'end')
}

function copyCanvasTextBlock(block: RichTextBlockMenuBlock): RichTextBlockMenuBlock {
  return {
    ...structuredClone(block),
    id: generateUuidV7(),
    children: block.children.map(copyCanvasTextBlock),
  }
}
