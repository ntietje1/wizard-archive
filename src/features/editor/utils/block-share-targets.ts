import type { BlockNoteId, CustomBlock } from 'shared/editor-blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'

export function getBlockShareTargetBlocks(
  editor: CustomBlockNoteEditor,
  fallbackBlockNoteId: BlockNoteId | undefined,
): Array<CustomBlock> {
  const selectedBlocks = getSelectedBlockShareTargetBlocks(editor)
  if (selectedBlocks) return selectedBlocks
  if (!fallbackBlockNoteId) return []

  const fallbackBlock = editor.getBlock(fallbackBlockNoteId) as CustomBlock | undefined
  return fallbackBlock ? [fallbackBlock] : []
}

function getSelectedBlockShareTargetBlocks(
  editor: CustomBlockNoteEditor,
): Array<CustomBlock> | null {
  const selection = editor.getSelection()
  return selection && selection.blocks.length > 1 ? (selection.blocks as Array<CustomBlock>) : null
}

export function getBlockShareTitle(blockCount: number) {
  return `Share ${blockCount} ${blockCount === 1 ? 'Block' : 'Blocks'}`
}
