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
  Pilcrow,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { textColorCanvasProperty } from '../../properties/canvas-property-definitions'
import { areCanvasPaintValuesEqual } from '../../properties/canvas-paint-values'
import type { CanvasPaintValue } from '../../properties/canvas-property-types'
import { readCanvasRichTextActiveStyles } from './canvas-rich-text-blocknote-adapter'
import { resolveCanvasRichTextSelectionTextColor } from './canvas-rich-text-selection-colors'

type SupportedBlockType =
  | 'paragraph'
  | 'heading'
  | 'bulletListItem'
  | 'numberedListItem'
  | 'checkListItem'
  | 'quote'
  | 'codeBlock'

export type InlineStyle = 'bold' | 'italic' | 'underline' | 'strike'
export type TextAlignment = 'left' | 'center' | 'right'

export type FormattingEditor = Pick<
  BlockNoteEditor<any, any, any>,
  | 'focus'
  | 'document'
  | 'getActiveStyles'
  | 'getSelection'
  | 'getSelectionCutBlocks'
  | 'getTextCursorPosition'
  | 'isEditable'
  | 'addStyles'
  | 'onChange'
  | 'onSelectionChange'
  | 'removeStyles'
  | 'replaceBlocks'
  | 'toggleStyles'
  | 'transact'
  | 'updateBlock'
  | 'schema'
>

type FormattingBlock = ReturnType<FormattingEditor['getTextCursorPosition']>['block']

export interface BlockTypeOption {
  id: string
  label: string
  type: SupportedBlockType
  props?: Record<string, boolean | number | string>
  icon: LucideIcon
}

export interface ToolbarSnapshot {
  activeAlignment: TextAlignment | null
  activeBlockTypeId: string | null
  activeStyles: Partial<Record<InlineStyle, boolean>>
  activeTextColor: { kind: 'value'; value: CanvasPaintValue } | { kind: 'mixed' }
  canAlign: boolean
  canFormatInline: boolean
  hasTextSelection: boolean
  supportedBlockTypes: Array<BlockTypeOption>
}

const BLOCK_TYPE_OPTIONS: Array<BlockTypeOption> = [
  { id: 'paragraph', label: 'Paragraph', type: 'paragraph', icon: Pilcrow },
  {
    id: 'heading-1',
    label: 'Heading 1',
    type: 'heading',
    props: { level: 1, isToggleable: false },
    icon: Heading1,
  },
  {
    id: 'heading-2',
    label: 'Heading 2',
    type: 'heading',
    props: { level: 2, isToggleable: false },
    icon: Heading2,
  },
  {
    id: 'heading-3',
    label: 'Heading 3',
    type: 'heading',
    props: { level: 3, isToggleable: false },
    icon: Heading3,
  },
  {
    id: 'heading-4',
    label: 'Heading 4',
    type: 'heading',
    props: { level: 4, isToggleable: false },
    icon: Heading4,
  },
  {
    id: 'heading-5',
    label: 'Heading 5',
    type: 'heading',
    props: { level: 5, isToggleable: false },
    icon: Heading5,
  },
  {
    id: 'heading-6',
    label: 'Heading 6',
    type: 'heading',
    props: { level: 6, isToggleable: false },
    icon: Heading6,
  },
  { id: 'bullet-list', label: 'Bullet List', type: 'bulletListItem', icon: List },
  { id: 'numbered-list', label: 'Numbered List', type: 'numberedListItem', icon: ListOrdered },
  { id: 'check-list', label: 'Checklist', type: 'checkListItem', icon: CheckSquare },
  { id: 'quote', label: 'Quote', type: 'quote', icon: Quote },
  { id: 'code-block', label: 'Code Block', type: 'codeBlock', icon: Code2 },
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
  activeBlockTypeId: null,
  activeStyles: {},
  activeTextColor: { kind: 'value', value: textColorCanvasProperty.defaultValue },
  canAlign: false,
  canFormatInline: false,
  hasTextSelection: false,
  supportedBlockTypes: [],
}

export function getVisibleToolbarSnapshot(
  editor: FormattingEditor | null,
  visible: boolean,
  defaultTextColor: string,
): ToolbarSnapshot {
  if (!editor || !visible || !editor.isEditable) {
    return EMPTY_TOOLBAR_SNAPSHOT
  }

  return getToolbarSnapshot(editor, defaultTextColor)
}

export function toolbarSnapshotsEqual(current: ToolbarSnapshot, next: ToolbarSnapshot) {
  if (
    current.activeAlignment !== next.activeAlignment ||
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

export function textColorStyleExistsInSchema(editor: FormattingEditor) {
  const styleDefinition = editor.schema.styleSchema.textColor
  return (
    !!styleDefinition &&
    styleDefinition.type === 'textColor' &&
    styleDefinition.propSchema === 'string'
  )
}

function getToolbarSnapshot(editor: FormattingEditor, defaultTextColor: string): ToolbarSnapshot {
  const selection = editor.getSelection()
  const hasTextSelection = selection !== undefined
  const selectedBlocks = getSelectedBlocks(editor)
  const selectedTextBlocks = hasTextSelection
    ? editor.getSelectionCutBlocks().blocks
    : selectedBlocks
  const supportedBlockTypes = BLOCK_TYPE_OPTIONS.filter((option) =>
    blockTypeOptionExists(editor, option),
  )
  const activeStyles = readCanvasRichTextActiveStyles<InlineStyle>(editor)
  const alignableBlocks = selectedBlocks.filter((block) =>
    blockTypeSupportsProp(editor, block.type, 'textAlignment'),
  )
  const activeTextColor = editor.getActiveStyles().textColor

  return {
    activeAlignment: getActiveAlignment(alignableBlocks),
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
