export const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'toggleListItem',
  'quote',
  'codeBlock',
  'divider',
  'image',
  'video',
  'audio',
  'file',
  'table',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export const CANVAS_BLOCK_TYPES = [
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'quote',
  'codeBlock',
] as const satisfies ReadonlyArray<BlockType>
