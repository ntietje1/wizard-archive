import type { NoteBlockId, NoteBlock } from '../document/model'
import type { CustomBlockNoteEditor } from '../editor-schema'

export function getBlockShareTargetBlocks(
  editor: CustomBlockNoteEditor,
  fallbackNoteBlockId: NoteBlockId | undefined,
): Array<NoteBlock> {
  const selectedBlocks = getSelectedBlockShareTargetBlocks(editor)
  if (selectedBlocks) return selectedBlocks
  if (!fallbackNoteBlockId) return []

  const fallbackBlock = editor.getBlock(fallbackNoteBlockId) as NoteBlock | undefined
  return fallbackBlock ? [fallbackBlock] : []
}

function getSelectedBlockShareTargetBlocks(editor: CustomBlockNoteEditor): Array<NoteBlock> | null {
  const selection = editor.getSelection()
  return selection && selection.blocks.length > 1 ? (selection.blocks as Array<NoteBlock>) : null
}

export function getBlockShareTitle(blockCount: number) {
  return `Share ${getBlockShareTargetLabel(blockCount)}`
}

export function getBlockShareButtonLabel(blockCount: number) {
  return blockCount > 1 ? `Share ${getBlockShareTargetLabel(blockCount).toLowerCase()}` : 'Share'
}

export function getBlockShareActionLabel(
  blockCount: number,
  allPlayersPermissionLevel: 'hidden' | 'visible' | 'mixed',
) {
  const verb = allPlayersPermissionLevel === 'visible' ? 'Unshare' : 'Share'
  return `${verb} ${getBlockShareTargetLabel(blockCount)}`
}

function getBlockShareTargetLabel(blockCount: number) {
  return `${blockCount} ${blockCount === 1 ? 'Block' : 'Blocks'}`
}
