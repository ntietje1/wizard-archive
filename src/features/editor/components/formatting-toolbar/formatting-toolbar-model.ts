import type { BlockNoteEditor } from '@blocknote/core'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Italic,
  List,
  ListOrdered,
  ListTree,
  Pilcrow,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { textColorCanvasProperty } from '~/features/canvas/properties/canvas-property-definitions'
import { areCanvasPaintValuesEqual } from '~/features/canvas/properties/canvas-paint-values'
import type { CanvasPaintValue } from '~/features/canvas/properties/canvas-property-types'
import { readBlockNoteActiveStyles } from '~/features/editor/utils/blocknote-selection-adapter'
import { resolveCanvasRichTextSelectionTextColor } from '~/features/canvas/nodes/shared/canvas-rich-text-selection-colors'

type SupportedBlockType =
  | 'paragraph'
  | 'heading'
  | 'bulletListItem'
  | 'numberedListItem'
  | 'checkListItem'
  | 'toggleListItem'
  | 'quote'
  | 'codeBlock'

export type InlineStyle = 'bold' | 'italic' | 'underline' | 'strike'
export type TextAlignment = 'left' | 'center' | 'right'
export type FormattingToolbarMode = 'compact' | 'full'

export type FormattingEditor = Pick<
  BlockNoteEditor<any, any, any>,
  | 'addStyles'
  | 'document'
  | 'focus'
  | 'getActiveStyles'
  | 'getSelection'
  | 'getSelectionCutBlocks'
  | 'getTextCursorPosition'
  | 'isEditable'
  | 'onChange'
  | 'onSelectionChange'
  | 'removeStyles'
  | 'replaceBlocks'
  | 'schema'
  | 'toggleStyles'
  | 'transact'
  | 'updateBlock'
>

type FormattingBlock = ReturnType<FormattingEditor['getTextCursorPosition']>['block']

export interface BlockTypeOption {
  icon: LucideIcon
  id: string
  label: string
  modes: ReadonlyArray<FormattingToolbarMode>
  props?: Record<string, boolean | number | string>
  type: SupportedBlockType
}

export interface SelectedFileBlock {
  caption: string
  id: string
  type: string
  url: string
}

export interface ToolbarSnapshot {
  activeAlignment: TextAlignment | null
  activeBackgroundColor: string
  activeBlockTypeId: string | null
  activeStyles: Partial<Record<InlineStyle, boolean>>
  activeTextColor: { kind: 'value'; value: CanvasPaintValue } | { kind: 'mixed' }
  canAlign: boolean
  canFormatInline: boolean
  hasTextSelection: boolean
  selectedFileBlock: SelectedFileBlock | null
  supportedBlockTypes: Array<BlockTypeOption>
}

const ALL_MODES: ReadonlyArray<FormattingToolbarMode> = ['compact', 'full']
const FULL_ONLY: ReadonlyArray<FormattingToolbarMode> = ['full']

const BLOCK_TYPE_OPTIONS: Array<BlockTypeOption> = [
  { id: 'paragraph', label: 'Paragraph', type: 'paragraph', icon: Pilcrow, modes: ALL_MODES },
  {
    id: 'heading-1',
    label: 'Heading 1',
    type: 'heading',
    props: { level: 1, isToggleable: false },
    icon: Heading1,
    modes: ALL_MODES,
  },
  {
    id: 'heading-2',
    label: 'Heading 2',
    type: 'heading',
    props: { level: 2, isToggleable: false },
    icon: Heading2,
    modes: ALL_MODES,
  },
  {
    id: 'heading-3',
    label: 'Heading 3',
    type: 'heading',
    props: { level: 3, isToggleable: false },
    icon: Heading3,
    modes: ALL_MODES,
  },
  {
    id: 'heading-4',
    label: 'Heading 4',
    type: 'heading',
    props: { level: 4, isToggleable: false },
    icon: Heading4,
    modes: ALL_MODES,
  },
  {
    id: 'heading-5',
    label: 'Heading 5',
    type: 'heading',
    props: { level: 5, isToggleable: false },
    icon: Heading5,
    modes: ALL_MODES,
  },
  {
    id: 'heading-6',
    label: 'Heading 6',
    type: 'heading',
    props: { level: 6, isToggleable: false },
    icon: Heading6,
    modes: ALL_MODES,
  },
  {
    id: 'toggle-heading-1',
    label: 'Toggle Heading 1',
    type: 'heading',
    props: { level: 1, isToggleable: true },
    icon: Heading1,
    modes: FULL_ONLY,
  },
  {
    id: 'toggle-heading-2',
    label: 'Toggle Heading 2',
    type: 'heading',
    props: { level: 2, isToggleable: true },
    icon: Heading2,
    modes: FULL_ONLY,
  },
  {
    id: 'toggle-heading-3',
    label: 'Toggle Heading 3',
    type: 'heading',
    props: { level: 3, isToggleable: true },
    icon: Heading3,
    modes: FULL_ONLY,
  },
  { id: 'bullet-list', label: 'Bullet List', type: 'bulletListItem', icon: List, modes: ALL_MODES },
  {
    id: 'numbered-list',
    label: 'Numbered List',
    type: 'numberedListItem',
    icon: ListOrdered,
    modes: ALL_MODES,
  },
  {
    id: 'check-list',
    label: 'Checklist',
    type: 'checkListItem',
    icon: CheckSquare,
    modes: ALL_MODES,
  },
  {
    id: 'toggle-list',
    label: 'Toggle List',
    type: 'toggleListItem',
    icon: ListTree,
    modes: FULL_ONLY,
  },
  { id: 'quote', label: 'Quote', type: 'quote', icon: Quote, modes: ALL_MODES },
  { id: 'code-block', label: 'Code Block', type: 'codeBlock', icon: Code2, modes: ALL_MODES },
]

export const INLINE_STYLE_OPTIONS: Array<{
  icon: LucideIcon
  id: InlineStyle
  label: string
}> = [
  { id: 'bold', label: 'Bold', icon: Bold },
  { id: 'italic', label: 'Italic', icon: Italic },
  { id: 'underline', label: 'Underline', icon: Underline },
  { id: 'strike', label: 'Strikethrough', icon: Strikethrough },
]

export const TEXT_ALIGNMENT_OPTIONS: Array<{
  icon: LucideIcon
  id: TextAlignment
  label: string
}> = [
  { id: 'left', label: 'Align left', icon: AlignLeft },
  { id: 'center', label: 'Align center', icon: AlignCenter },
  { id: 'right', label: 'Align right', icon: AlignRight },
]

export const EMPTY_TOOLBAR_SNAPSHOT: ToolbarSnapshot = {
  activeAlignment: null,
  activeBackgroundColor: 'default',
  activeBlockTypeId: null,
  activeStyles: {},
  activeTextColor: { kind: 'value', value: textColorCanvasProperty.defaultValue },
  canAlign: false,
  canFormatInline: false,
  hasTextSelection: false,
  selectedFileBlock: null,
  supportedBlockTypes: [],
}

export function getVisibleToolbarSnapshot({
  defaultTextColor,
  editor,
  mode,
  visible,
}: {
  defaultTextColor: string
  editor: FormattingEditor | null
  mode: FormattingToolbarMode
  visible: boolean
}): ToolbarSnapshot {
  if (!editor || !visible || !editor.isEditable) {
    return EMPTY_TOOLBAR_SNAPSHOT
  }

  return getToolbarSnapshot(editor, defaultTextColor, mode)
}

export function toolbarSnapshotsEqual(current: ToolbarSnapshot, next: ToolbarSnapshot) {
  if (
    current.activeAlignment !== next.activeAlignment ||
    current.activeBackgroundColor !== next.activeBackgroundColor ||
    current.activeBlockTypeId !== next.activeBlockTypeId ||
    current.canAlign !== next.canAlign ||
    current.canFormatInline !== next.canFormatInline ||
    current.hasTextSelection !== next.hasTextSelection
  ) {
    return false
  }

  if (current.activeTextColor.kind !== next.activeTextColor.kind) {
    return false
  }

  if (
    current.activeTextColor.kind === 'value' &&
    next.activeTextColor.kind === 'value' &&
    !areCanvasPaintValuesEqual(current.activeTextColor.value, next.activeTextColor.value)
  ) {
    return false
  }

  if (!selectedFileBlocksEqual(current.selectedFileBlock, next.selectedFileBlock)) {
    return false
  }

  for (const style of INLINE_STYLE_OPTIONS) {
    if (!!current.activeStyles[style.id] !== !!next.activeStyles[style.id]) {
      return false
    }
  }

  return (
    current.supportedBlockTypes.length === next.supportedBlockTypes.length &&
    current.supportedBlockTypes.every((option, index) => {
      return option.id === next.supportedBlockTypes[index]?.id
    })
  )
}

export function getSelectedBlocks(editor: FormattingEditor): Array<FormattingBlock> {
  return editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]
}

export function blockTypeSupportsProp(
  editor: FormattingEditor,
  blockType: string,
  propName: string,
) {
  const blockDefinition = editor.schema.blockSchema[blockType]
  if (!blockDefinition) {
    return false
  }

  return propName in (blockDefinition.propSchema ?? {})
}

export function styleExistsInSchema(editor: FormattingEditor, style: InlineStyle) {
  const styleDefinition = editor.schema.styleSchema[style]
  return (
    !!styleDefinition && styleDefinition.type === style && styleDefinition.propSchema === 'boolean'
  )
}

export function stringStyleExistsInSchema(
  editor: FormattingEditor,
  style: 'backgroundColor' | 'textColor',
) {
  const styleDefinition = editor.schema.styleSchema[style]
  return (
    !!styleDefinition && styleDefinition.type === style && styleDefinition.propSchema === 'string'
  )
}

function getToolbarSnapshot(
  editor: FormattingEditor,
  defaultTextColor: string,
  mode: FormattingToolbarMode,
): ToolbarSnapshot {
  const selection = editor.getSelection()
  const hasTextSelection = selection !== undefined
  const selectedBlocks = getSelectedBlocks(editor)
  const selectedTextBlocks = hasTextSelection
    ? editor.getSelectionCutBlocks().blocks
    : selectedBlocks
  const supportedBlockTypes = BLOCK_TYPE_OPTIONS.filter(
    (option) => option.modes.includes(mode) && blockTypeOptionExists(editor, option),
  )
  const activeStyles = readBlockNoteActiveStyles<InlineStyle>(editor)
  const alignableBlocks = selectedBlocks.filter((block) =>
    blockTypeSupportsProp(editor, block.type, 'textAlignment'),
  )
  const editorActiveStyles = editor.getActiveStyles()
  const activeTextColor = editorActiveStyles.textColor
  const activeBackgroundColor = editorActiveStyles.backgroundColor

  return {
    activeAlignment: getActiveAlignment(alignableBlocks),
    activeBackgroundColor:
      typeof activeBackgroundColor === 'string' ? activeBackgroundColor : 'default',
    activeBlockTypeId: getActiveBlockTypeId(selectedBlocks, supportedBlockTypes),
    activeStyles,
    activeTextColor: resolveCanvasRichTextSelectionTextColor({
      activeTextColor: typeof activeTextColor === 'string' ? activeTextColor : null,
      defaultTextColor,
      hasTextSelection,
      selectedBlocks: selectedTextBlocks,
    }),
    canAlign: alignableBlocks.length > 0,
    canFormatInline: selectedBlocks.some((block) => block.content !== undefined),
    hasTextSelection,
    selectedFileBlock: getSelectedFileBlock(editor, selectedBlocks),
    supportedBlockTypes,
  }
}

function getActiveAlignment(blocks: Array<FormattingBlock>): TextAlignment | null {
  if (blocks.length === 0) {
    return null
  }

  const [firstBlock, ...restBlocks] = blocks
  const firstAlignment = firstBlock.props.textAlignment
  if (firstAlignment !== 'left' && firstAlignment !== 'center' && firstAlignment !== 'right') {
    return null
  }

  return restBlocks.every((block) => block.props.textAlignment === firstAlignment)
    ? firstAlignment
    : null
}

function getActiveBlockTypeId(
  blocks: Array<FormattingBlock>,
  supportedBlockTypes: Array<BlockTypeOption>,
): string | null {
  if (blocks.length === 0) {
    return null
  }

  const [firstBlock, ...restBlocks] = blocks
  const matchingType = supportedBlockTypes.find((option) =>
    matchesBlockTypeOption(firstBlock, option),
  )
  if (!matchingType) {
    return null
  }

  return restBlocks.every((block) => matchesBlockTypeOption(block, matchingType))
    ? matchingType.id
    : null
}

function blockTypeOptionExists(editor: FormattingEditor, option: BlockTypeOption) {
  const blockDefinition = editor.schema.blockSchema[option.type]
  if (!blockDefinition) {
    return false
  }

  const propSchema = blockDefinition.propSchema ?? {}

  return Object.keys(option.props ?? {}).every((propName) => propName in propSchema)
}

function matchesBlockTypeOption(block: FormattingBlock, option: BlockTypeOption) {
  if (block.type !== option.type) {
    return false
  }

  return Object.entries(option.props ?? {}).every(([propName, propValue]) => {
    return block.props[propName] === propValue
  })
}

function getSelectedFileBlock(
  editor: FormattingEditor,
  selectedBlocks: Array<FormattingBlock>,
): SelectedFileBlock | null {
  if (selectedBlocks.length !== 1) {
    return null
  }

  const block = selectedBlocks[0]
  if (!blockTypeSupportsProp(editor, block.type, 'url')) {
    return null
  }

  const url = block.props.url
  if (typeof url !== 'string') {
    return null
  }

  const caption = blockTypeSupportsProp(editor, block.type, 'caption') ? block.props.caption : ''

  return {
    caption: typeof caption === 'string' ? caption : '',
    id: block.id,
    type: block.type,
    url,
  }
}

function selectedFileBlocksEqual(
  current: SelectedFileBlock | null,
  next: SelectedFileBlock | null,
) {
  return (
    current?.id === next?.id &&
    current?.caption === next?.caption &&
    current?.type === next?.type &&
    current?.url === next?.url
  )
}
