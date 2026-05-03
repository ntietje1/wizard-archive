import type { BlockNoteEditor } from '@blocknote/core'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  ChevronDown,
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
import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { SyntheticEvent } from 'react'
import { Button } from '~/features/shadcn/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '~/features/shadcn/components/dropdown-menu'
import { Separator } from '~/features/shadcn/components/separator'
import { cn } from '~/features/shadcn/lib/utils'
import { getNextBlockTypeMenuState } from './canvas-floating-formatting-toolbar-state'
import type { BlockTypeMenuChangeDetails } from './canvas-floating-formatting-toolbar-state'
import { textColorCanvasProperty } from '../../properties/canvas-property-definitions'
import { areCanvasPaintValuesEqual } from '../../properties/canvas-paint-values'
import type { CanvasPaintValue } from '../../properties/canvas-property-types'
import {
  captureCanvasRichTextSelection,
  readCanvasRichTextActiveStyles,
  restoreCanvasRichTextSelection,
} from './canvas-rich-text-blocknote-adapter'
import type { CanvasRichTextSelectionSnapshot } from './canvas-rich-text-blocknote-adapter'
import { applyCanvasRichTextDefaultTextColor } from './canvas-rich-text-default-color'
import { resolveCanvasRichTextSelectionTextColor } from './canvas-rich-text-selection-colors'
import { ColorIcon } from '~/features/editor/components/extensions/selection-toolbar/color-picker/color-icon'

type SupportedBlockType =
  | 'paragraph'
  | 'heading'
  | 'bulletListItem'
  | 'numberedListItem'
  | 'checkListItem'
  | 'quote'
  | 'codeBlock'

type InlineStyle = 'bold' | 'italic' | 'underline' | 'strike'
type TextAlignment = 'left' | 'center' | 'right'

type FormattingEditor = Pick<
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

interface CanvasFloatingFormattingToolbarProps {
  defaultTextColor?: string
  editor: FormattingEditor | null
  onDefaultTextColorChange?: (color: string) => void
  visible: boolean
}

interface BlockTypeOption {
  id: string
  label: string
  type: SupportedBlockType
  props?: Record<string, boolean | number | string>
  icon: LucideIcon
}

interface ToolbarSnapshot {
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
  {
    id: 'paragraph',
    label: 'Paragraph',
    type: 'paragraph',
    icon: Pilcrow,
  },
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
  {
    id: 'bullet-list',
    label: 'Bullet List',
    type: 'bulletListItem',
    icon: List,
  },
  {
    id: 'numbered-list',
    label: 'Numbered List',
    type: 'numberedListItem',
    icon: ListOrdered,
  },
  {
    id: 'check-list',
    label: 'Checklist',
    type: 'checkListItem',
    icon: CheckSquare,
  },
  {
    id: 'quote',
    label: 'Quote',
    type: 'quote',
    icon: Quote,
  },
  {
    id: 'code-block',
    label: 'Code Block',
    type: 'codeBlock',
    icon: Code2,
  },
]

const INLINE_STYLE_OPTIONS: Array<{
  icon: LucideIcon
  id: InlineStyle
  label: string
}> = [
  { id: 'bold', label: 'Bold', icon: Bold },
  { id: 'italic', label: 'Italic', icon: Italic },
  { id: 'underline', label: 'Underline', icon: Underline },
  { id: 'strike', label: 'Strikethrough', icon: Strikethrough },
]

const TEXT_ALIGNMENT_OPTIONS: Array<{
  icon: LucideIcon
  id: TextAlignment
  label: string
}> = [
  { id: 'left', label: 'Align left', icon: AlignLeft },
  { id: 'center', label: 'Align center', icon: AlignCenter },
  { id: 'right', label: 'Align right', icon: AlignRight },
]

const EMPTY_SNAPSHOT: ToolbarSnapshot = {
  activeAlignment: null,
  activeBlockTypeId: null,
  activeStyles: {},
  activeTextColor: { kind: 'value', value: textColorCanvasProperty.defaultValue },
  canAlign: false,
  canFormatInline: false,
  hasTextSelection: false,
  supportedBlockTypes: [],
}
const FLOATING_FORMATTING_TOOLBAR_Z_INDEX = 60
const FLOATING_FORMATTING_COLOR_PALETTE_Z_INDEX = 70

export function CanvasFloatingFormattingToolbar({
  defaultTextColor = textColorCanvasProperty.defaultValue.color,
  editor,
  onDefaultTextColorChange,
  visible,
}: CanvasFloatingFormattingToolbarProps) {
  const snapshotRef = useRef<ToolbarSnapshot>(EMPTY_SNAPSHOT)
  const ignoreOpeningClickCloseRef = useRef(false)
  const selectionSnapshotRef = useRef<CanvasRichTextSelectionSnapshot | null>(null)
  const [blockTypeMenuOpen, setBlockTypeMenuOpen] = useState(false)
  const captureSelection = useCallback(() => {
    selectionSnapshotRef.current = captureCanvasRichTextSelection(editor)
  }, [editor])
  const handleBlockTypeMenuOpenChange = useCallback(
    (nextOpen: boolean, details: BlockTypeMenuChangeDetails) => {
      const nextState = getNextBlockTypeMenuState({
        ignoreOpeningClickClose: ignoreOpeningClickCloseRef.current,
        nextOpen,
        details,
      })
      ignoreOpeningClickCloseRef.current = nextState.ignoreOpeningClickClose
      setBlockTypeMenuOpen(nextState.open)
    },
    [],
  )
  const snapshot = useSyncExternalStore(
    (onStoreChange) => {
      if (!editor || !visible || !editor.isEditable) {
        return () => undefined
      }

      const unsubscribeSelection = editor.onSelectionChange(onStoreChange)
      const unsubscribeChange = editor.onChange(() => {
        onStoreChange()
      })

      return () => {
        unsubscribeSelection()
        unsubscribeChange()
      }
    },
    () => {
      const nextSnapshot = getVisibleToolbarSnapshot(editor, visible, defaultTextColor)
      if (toolbarSnapshotsEqual(snapshotRef.current, nextSnapshot)) {
        return snapshotRef.current
      }

      snapshotRef.current = nextSnapshot
      return nextSnapshot
    },
    () => EMPTY_SNAPSHOT,
  )

  if (!editor || !visible || !editor.isEditable) {
    return null
  }

  const activeBlockType =
    snapshot.supportedBlockTypes.find((option) => option.id === snapshot.activeBlockTypeId) ?? null
  const blockTypeLabel = activeBlockType?.label ?? 'Block type'
  const BlockTypeIcon = activeBlockType?.icon ?? Pilcrow

  const handleBlockTypeChange = (nextTypeId: string) => {
    const nextType = snapshot.supportedBlockTypes.find((option) => option.id === nextTypeId)
    if (!nextType) {
      return
    }

    restoreCanvasRichTextSelection(editor, selectionSnapshotRef.current)
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

  const toggleInlineStyle = (style: InlineStyle) => {
    restoreCanvasRichTextSelection(editor, selectionSnapshotRef.current)
    editor.toggleStyles({ [style]: true })
  }

  const setTextAlignment = (alignment: TextAlignment) => {
    restoreCanvasRichTextSelection(editor, selectionSnapshotRef.current)
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

  const setTextColor = (color: string) => {
    if (snapshot.hasTextSelection) {
      restoreCanvasRichTextSelection(editor, selectionSnapshotRef.current)
      editor.addStyles({ textColor: color })
      return
    }

    restoreCanvasRichTextSelection(editor, selectionSnapshotRef.current)
    applyCanvasRichTextDefaultTextColor(
      editor,
      defaultTextColor,
      color,
      selectionSnapshotRef.current,
    )
    onDefaultTextColorChange?.(color)
  }

  return (
    <div
      className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] pointer-events-auto nodrag nopan nowheel"
      style={{ zIndex: FLOATING_FORMATTING_TOOLBAR_Z_INDEX }}
    >
      <div
        role="toolbar"
        aria-label="Canvas formatting toolbar"
        className="flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-md backdrop-blur-sm"
        onPointerDown={(event) => {
          captureSelection()
          // This relies on DropdownMenuTrigger emitting data-slot="dropdown-menu-trigger".
          if (eventStartedOnDropdownTrigger(event)) {
            return
          }

          preventEditorBlur(event)
        }}
      >
        <DropdownMenu
          modal={false}
          open={blockTypeMenuOpen}
          onOpenChange={handleBlockTypeMenuOpenChange}
        >
          <DropdownMenuTrigger
            nativeButton
            render={
              <Button
                variant="outline"
                size="sm"
                className="min-w-36 justify-between gap-2"
                aria-label="Block type"
                title="Block type"
              >
                <span className="flex items-center gap-2">
                  <BlockTypeIcon className="size-4" />
                  <span className="truncate">{blockTypeLabel}</span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent
            align="center"
            className="min-w-44"
            finalFocus={false}
            onPointerDownCapture={(event) => {
              captureSelection()
              stopPropagation(event)
            }}
            onPointerUpCapture={stopPropagation}
            onClick={stopPropagation}
          >
            <DropdownMenuRadioGroup
              value={snapshot.activeBlockTypeId ?? ''}
              onValueChange={handleBlockTypeChange}
            >
              {snapshot.supportedBlockTypes.map((option) => {
                const Icon = option.icon

                return (
                  <DropdownMenuRadioItem key={option.id} value={option.id} className="gap-2">
                    <Icon className="size-4" />
                    {option.label}
                  </DropdownMenuRadioItem>
                )
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6" />

        <TextColorControls
          activeColor={snapshot.activeTextColor}
          disabled={snapshot.hasTextSelection && !textColorStyleExistsInSchema(editor)}
          onColorChange={setTextColor}
        />

        <Separator orientation="vertical" className="h-6" />

        {INLINE_STYLE_OPTIONS.map(({ id, icon: Icon, label }) => (
          <ToolbarButton
            key={id}
            active={!!snapshot.activeStyles[id]}
            disabled={!snapshot.canFormatInline || !styleExistsInSchema(editor, id)}
            icon={Icon}
            label={label}
            onClick={() => toggleInlineStyle(id)}
          />
        ))}

        <Separator orientation="vertical" className="h-6" />

        {TEXT_ALIGNMENT_OPTIONS.map(({ id, icon: Icon, label }) => (
          <ToolbarButton
            key={id}
            active={snapshot.activeAlignment === id}
            disabled={!snapshot.canAlign}
            icon={Icon}
            label={label}
            onClick={() => setTextAlignment(id)}
          />
        ))}
      </div>
    </div>
  )
}

function ToolbarButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  disabled: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(active && 'bg-accent text-accent-foreground hover:bg-accent')}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      title={label}
      onMouseDown={preventEditorBlur}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  )
}

function getVisibleToolbarSnapshot(
  editor: FormattingEditor | null,
  visible: boolean,
  defaultTextColor: string,
): ToolbarSnapshot {
  if (!editor || !visible || !editor.isEditable) {
    return EMPTY_SNAPSHOT
  }

  return getToolbarSnapshot(editor, defaultTextColor)
}

function toolbarSnapshotsEqual(current: ToolbarSnapshot, next: ToolbarSnapshot) {
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

function TextColorControls({
  activeColor,
  disabled,
  onColorChange,
}: {
  activeColor: ToolbarSnapshot['activeTextColor']
  disabled: boolean
  onColorChange: (color: string) => void
}) {
  const ignoreOpeningClickCloseRef = useRef(false)
  const [open, setOpen] = useState(false)
  const activeValue = activeColor.kind === 'value' ? activeColor.value : undefined
  const activeColorValue = activeValue?.color ?? ''
  const triggerLabel = activeColor.kind === 'mixed' ? 'Text color (mixed values)' : 'Text color'
  const handleOpenChange = (nextOpen: boolean, details: BlockTypeMenuChangeDetails) => {
    const nextState = getNextBlockTypeMenuState({
      ignoreOpeningClickClose: ignoreOpeningClickCloseRef.current,
      nextOpen,
      details,
    })
    ignoreOpeningClickCloseRef.current = nextState.ignoreOpeningClickClose
    setOpen(nextState.open)
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        nativeButton
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2"
            aria-label={triggerLabel}
            disabled={disabled}
            title={triggerLabel}
          >
            <ColorIcon
              textColor={activeColor.kind === 'mixed' ? undefined : activeValue?.color}
              size={18}
            />
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent
        align="center"
        className="w-auto min-w-0 overflow-visible p-2"
        style={{ zIndex: FLOATING_FORMATTING_COLOR_PALETTE_Z_INDEX }}
        aria-label="Text color palette"
      >
        <DropdownMenuRadioGroup
          className="grid grid-cols-5 gap-1"
          value={activeColorValue}
          onValueChange={(color) => {
            onColorChange(color)
            setOpen(false)
          }}
        >
          {textColorCanvasProperty.options.map((preset) => {
            const isActive = activeValue
              ? areCanvasPaintValuesEqual(activeValue, preset.value)
              : false

            return (
              <DropdownMenuRadioItem
                key={`${preset.label}-${preset.value.color}`}
                value={preset.value.color}
                aria-label={`Select ${preset.label} text color`}
                disabled={disabled}
                title={preset.label}
                className="flex h-7 w-7 items-center justify-center rounded-sm border border-border p-0 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
                style={{
                  backgroundColor: preset.value.color,
                  outline: isActive ? '2px solid var(--primary)' : 'none',
                  outlineOffset: '1px',
                }}
              />
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function getSelectedBlocks(editor: FormattingEditor): Array<FormattingBlock> {
  return editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]
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
  const [firstBlock, ...restBlocks] = blocks
  if (!firstBlock) {
    return null
  }

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

function blockTypeSupportsProp(editor: FormattingEditor, blockType: string, propName: string) {
  const blockDefinition = editor.schema.blockSchema[blockType]
  if (!blockDefinition) {
    return false
  }

  return propName in (blockDefinition.propSchema ?? {})
}

function matchesBlockTypeOption(block: FormattingBlock, option: BlockTypeOption) {
  if (block.type !== option.type) {
    return false
  }

  return Object.entries(option.props ?? {}).every(([propName, propValue]) => {
    return block.props[propName] === propValue
  })
}

function styleExistsInSchema(editor: FormattingEditor, style: InlineStyle) {
  const styleDefinition = editor.schema.styleSchema[style]
  return (
    !!styleDefinition && styleDefinition.type === style && styleDefinition.propSchema === 'boolean'
  )
}

function textColorStyleExistsInSchema(editor: FormattingEditor) {
  const styleDefinition = editor.schema.styleSchema.textColor
  return (
    !!styleDefinition &&
    styleDefinition.type === 'textColor' &&
    styleDefinition.propSchema === 'string'
  )
}

function preventEditorBlur(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function eventStartedOnDropdownTrigger(event: SyntheticEvent) {
  // Keep this in sync with the DropdownMenuTrigger data-slot attribute.
  return (
    event.target instanceof Element &&
    event.target.closest('[data-slot="dropdown-menu-trigger"]') !== null
  )
}

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation()
}
