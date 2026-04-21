import type { BlockNoteEditor } from '@blocknote/core'
import { Selection } from '@tiptap/pm/state'
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
import type { MouseEvent as ReactMouseEvent, SyntheticEvent } from 'react'
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
  | 'getActiveStyles'
  | 'getSelection'
  | 'getTextCursorPosition'
  | 'isEditable'
  | 'onChange'
  | 'onSelectionChange'
  | 'toggleStyles'
  | 'transact'
  | 'updateBlock'
  | 'schema'
>

type FormattingBlock = ReturnType<FormattingEditor['getTextCursorPosition']>['block']

interface CanvasFloatingFormattingToolbarProps {
  editor: FormattingEditor | null
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
  canAlign: boolean
  canFormatInline: boolean
  supportedBlockTypes: Array<BlockTypeOption>
}

interface EditorViewLike {
  dispatch: (transaction: unknown) => void
  focus: () => void
  state: {
    doc: unknown
    selection: {
      toJSON: () => Record<string, unknown>
    }
    tr: {
      setSelection: (selection: Selection) => unknown
    }
  }
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
  canAlign: false,
  canFormatInline: false,
  supportedBlockTypes: [],
}

export function CanvasFloatingFormattingToolbar({
  editor,
  visible,
}: CanvasFloatingFormattingToolbarProps) {
  const snapshotRef = useRef<ToolbarSnapshot>(EMPTY_SNAPSHOT)
  const ignoreOpeningClickCloseRef = useRef(false)
  const selectionSnapshotRef = useRef<Record<string, unknown> | null>(null)
  const [blockTypeMenuOpen, setBlockTypeMenuOpen] = useState(false)
  const captureSelection = useCallback(() => {
    selectionSnapshotRef.current = getSelectionSnapshot(editor)
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
      const nextSnapshot = getVisibleToolbarSnapshot(editor, visible)
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

    restoreSelectionAndFocus(editor, selectionSnapshotRef.current)
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
    restoreSelectionAndFocus(editor, selectionSnapshotRef.current)
    editor.toggleStyles({ [style]: true })
  }

  const setTextAlignment = (alignment: TextAlignment) => {
    restoreSelectionAndFocus(editor, selectionSnapshotRef.current)
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

  return (
    <div className="absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] pointer-events-auto nodrag nopan nowheel">
      <div
        role="toolbar"
        aria-label="Canvas formatting toolbar"
        className="flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-md backdrop-blur-sm"
        onPointerDownCapture={(event) => {
          captureSelection()
          stopPropagation(event)
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
                onMouseDown={preventEditorBlur}
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
): ToolbarSnapshot {
  if (!editor || !visible || !editor.isEditable) {
    return EMPTY_SNAPSHOT
  }

  return getToolbarSnapshot(editor)
}

function toolbarSnapshotsEqual(current: ToolbarSnapshot, next: ToolbarSnapshot) {
  if (
    current.activeAlignment !== next.activeAlignment ||
    current.activeBlockTypeId !== next.activeBlockTypeId ||
    current.canAlign !== next.canAlign ||
    current.canFormatInline !== next.canFormatInline
  ) {
    return false
  }

  for (const style of INLINE_STYLE_OPTIONS) {
    if (!!current.activeStyles[style.id] !== !!next.activeStyles[style.id]) {
      return false
    }
  }

  if (current.supportedBlockTypes.length !== next.supportedBlockTypes.length) {
    return false
  }

  return current.supportedBlockTypes.every((option, index) => {
    return option.id === next.supportedBlockTypes[index]?.id
  })
}

function getToolbarSnapshot(editor: FormattingEditor): ToolbarSnapshot {
  const selectedBlocks = getSelectedBlocks(editor)
  const supportedBlockTypes = BLOCK_TYPE_OPTIONS.filter((option) =>
    blockTypeOptionExists(editor, option),
  )
  const activeStyles = editor.getActiveStyles() as Partial<Record<InlineStyle, boolean>>
  const alignableBlocks = selectedBlocks.filter((block) =>
    blockTypeSupportsProp(editor, block.type, 'textAlignment'),
  )

  return {
    activeAlignment: getActiveAlignment(alignableBlocks),
    activeBlockTypeId: getActiveBlockTypeId(selectedBlocks, supportedBlockTypes),
    activeStyles,
    canAlign: alignableBlocks.length > 0,
    canFormatInline: selectedBlocks.some((block) => block.content !== undefined),
    supportedBlockTypes,
  }
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

function getSelectionSnapshot(editor: FormattingEditor | null): Record<string, unknown> | null {
  return getTiptapView(editor)?.state.selection.toJSON() ?? null
}

function restoreSelectionAndFocus(
  editor: FormattingEditor,
  selectionSnapshot: Record<string, unknown> | null,
) {
  const view = getTiptapView(editor)
  if (!view) {
    editor.focus()
    return
  }

  if (selectionSnapshot) {
    try {
      const nextSelection = Selection.fromJSON(view.state.doc as never, selectionSnapshot)
      view.dispatch(view.state.tr.setSelection(nextSelection))
    } catch {
      // Fall back to the editor's current selection if the saved snapshot is no longer valid.
    }
  }

  view.focus()
}

function getTiptapView(editor: FormattingEditor | null): EditorViewLike | null {
  const tiptapEditor = (editor as { _tiptapEditor?: { view?: EditorViewLike } } | null)
    ?._tiptapEditor
  return tiptapEditor?.view ?? null
}

function preventEditorBlur(event: ReactMouseEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation()
}
