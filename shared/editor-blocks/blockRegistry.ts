export const BLOCK_REGISTRY = [
  { type: 'paragraph', props: 'defaultText', content: 'inline', canvas: true },
  { type: 'heading', props: 'heading', content: 'inline', canvas: true },
  { type: 'bulletListItem', props: 'defaultText', content: 'inline', canvas: true },
  { type: 'numberedListItem', props: 'numberedListItem', content: 'inline', canvas: true },
  { type: 'checkListItem', props: 'checkListItem', content: 'inline', canvas: true },
  { type: 'toggleListItem', props: 'defaultText', content: 'inline', canvas: false },
  { type: 'quote', props: 'defaultText', content: 'inline', canvas: true },
  { type: 'codeBlock', props: 'codeBlock', content: 'inline', canvas: true },
  { type: 'divider', props: 'empty', content: 'inline', canvas: false },
  { type: 'image', props: 'mediaPreview', content: 'inline', canvas: false },
  { type: 'video', props: 'mediaPreview', content: 'inline', canvas: false },
  { type: 'audio', props: 'audio', content: 'inline', canvas: false },
  { type: 'file', props: 'file', content: 'inline', canvas: false },
  { type: 'table', props: 'table', content: 'table', canvas: false },
] as const

export type BlockRegistryEntry = (typeof BLOCK_REGISTRY)[number]
export type BlockType = BlockRegistryEntry['type']
type CanvasBlockType = Extract<BlockRegistryEntry, { canvas: true }>['type']

export const BLOCK_TYPES = BLOCK_REGISTRY.map((entry) => entry.type) as [
  BlockType,
  BlockType,
  ...Array<BlockType>,
]

export const CANVAS_BLOCK_TYPES = BLOCK_REGISTRY.filter((entry) => entry.canvas).map(
  (entry) => entry.type,
) as [CanvasBlockType, CanvasBlockType, ...Array<CanvasBlockType>]
