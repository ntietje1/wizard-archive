import { ChevronDown, FilePenLine, FileUp, Highlighter, Pilcrow } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, FormEvent, SyntheticEvent } from 'react'
import {
  applyFormattingToolbarBlockType,
  applyFormattingToolbarStyleColor,
  applyFormattingToolbarTextAlignment,
  toggleFormattingToolbarInlineStyle,
} from './formatting-toolbar-commands'
import {
  EMPTY_TOOLBAR_SNAPSHOT,
  INLINE_STYLE_OPTIONS,
  TEXT_ALIGNMENT_OPTIONS,
  getVisibleToolbarSnapshot,
  stringStyleExistsInSchema,
  styleExistsInSchema,
  toolbarSnapshotsEqual,
} from './formatting-toolbar-model'
import { getNextBlockTypeMenuState } from './formatting-toolbar-state'
import { Button } from '~/features/shadcn/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '~/features/shadcn/components/dropdown-menu'
import { Input } from '~/features/shadcn/components/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/features/shadcn/components/popover'
import { Separator } from '~/features/shadcn/components/separator'
import { textColorCanvasProperty } from '~/features/canvas/properties/canvas-property-definitions'
import { areCanvasPaintValuesEqual } from '~/features/canvas/properties/canvas-paint-values'
import { cn } from '~/features/shadcn/lib/utils'
import {
  blockNoteSelectionSnapshotCollapsedPosition,
  captureBlockNoteSelection,
  setBlockNotePendingTextColor,
} from '~/features/editor/utils/blocknote-selection-adapter'
import { ColorIcon } from '~/features/editor/components/extensions/selection-toolbar/color-picker/color-icon'
import { CheckerboardSwatch } from '~/shared/components/checkerboard-swatch'
import type { BlockTypeMenuChangeDetails } from './formatting-toolbar-state'
import type {
  FormattingEditor,
  FormattingToolbarMode,
  InlineStyle,
  SelectedFileBlock,
  TextAlignment,
  ToolbarSnapshot,
} from './formatting-toolbar-model'
import type { BlockNoteSelectionSnapshot } from '~/features/editor/utils/blocknote-selection-adapter'

interface EditorFormattingToolbarProps {
  className?: string
  defaultTextColor?: string
  editor: FormattingEditor | null
  mode: FormattingToolbarMode
  onApplyCollapsedTextColor?: (
    editor: FormattingEditor,
    color: string,
    selectionSnapshot: BlockNoteSelectionSnapshot | null,
  ) => void
  onDefaultTextColorChange?: (color: string) => void
  visible: boolean
}

const NOTE_TOOLBAR_LABEL = 'Note formatting toolbar'
const CANVAS_TOOLBAR_LABEL = 'Canvas formatting toolbar'
const FLOATING_FORMATTING_COLOR_PALETTE_Z_INDEX = 70
const TEXT_COLOR_SURFACE_COLORS: Record<string, string> = {
  'var(--foreground)': 'var(--border)',
  'var(--border)': 'var(--border)',
  'var(--t-brown)': 'var(--bg-brown)',
  'var(--t-red)': 'var(--bg-red)',
  'var(--t-orange)': 'var(--bg-orange)',
  'var(--t-yellow)': 'var(--bg-yellow)',
  'var(--t-green)': 'var(--bg-green)',
  'var(--t-blue)': 'var(--bg-blue)',
  'var(--t-purple)': 'var(--bg-purple)',
  'var(--t-pink)': 'var(--bg-pink)',
}
const TEXT_COLOR_OPTIONS = textColorCanvasProperty.options.map(({ label, value }) => ({
  label,
  value: value.color,
  surfaceColor: TEXT_COLOR_SURFACE_COLORS[value.color] ?? value.color,
}))
const BACKGROUND_COLOR_OPTIONS = [
  { label: 'No highlight', value: 'default' },
  { label: 'Grey', value: 'var(--border)' },
  { label: 'Brown', value: 'var(--bg-brown)', displayColor: 'var(--t-brown)' },
  { label: 'Red', value: 'var(--bg-red)', displayColor: 'var(--t-red)' },
  { label: 'Orange', value: 'var(--bg-orange)', displayColor: 'var(--t-orange)' },
  { label: 'Yellow', value: 'var(--bg-yellow)', displayColor: 'var(--t-yellow)' },
  { label: 'Green', value: 'var(--bg-green)', displayColor: 'var(--t-green)' },
  { label: 'Blue', value: 'var(--bg-blue)', displayColor: 'var(--t-blue)' },
  { label: 'Purple', value: 'var(--bg-purple)', displayColor: 'var(--t-purple)' },
  { label: 'Pink', value: 'var(--bg-pink)', displayColor: 'var(--t-pink)' },
] as const

type FormattingColorKind = 'background' | 'text'
type PendingStyleColors = Partial<Record<'backgroundColor' | 'textColor', string>>
type FormattingColorOption = {
  displayColor?: string
  label: string
  surfaceColor?: string
  value: string
}
type ActiveTextColorValue = Extract<ToolbarSnapshot['activeTextColor'], { kind: 'value' }>['value']

export function EditorFormattingToolbar({
  className,
  defaultTextColor = textColorCanvasProperty.defaultValue.color,
  editor,
  mode,
  onApplyCollapsedTextColor,
  onDefaultTextColorChange,
  visible,
}: EditorFormattingToolbarProps) {
  const snapshotRef = useRef<ToolbarSnapshot>(EMPTY_TOOLBAR_SNAPSHOT)
  const hasPendingStyleColorsRef = useRef(false)
  const ignoreOpeningClickCloseRef = useRef(false)
  const pendingSelectionPositionRef = useRef<number | null>(null)
  const selectionSnapshotRef = useRef<BlockNoteSelectionSnapshot | null>(null)
  const [blockTypeMenuOpen, setBlockTypeMenuOpen] = useState(false)
  const [pendingStyleColors, setPendingStyleColors] = useState<PendingStyleColors>({})
  const captureSelection = () => {
    selectionSnapshotRef.current = captureBlockNoteSelection(editor)
  }
  const getCurrentSelectionSnapshot = () => {
    const currentSelectionSnapshot = captureBlockNoteSelection(editor)
    if (currentSelectionSnapshot) {
      selectionSnapshotRef.current = currentSelectionSnapshot
      return currentSelectionSnapshot
    }

    return selectionSnapshotRef.current
  }
  const handleBlockTypeMenuOpenChange = (
    nextOpen: boolean,
    details: BlockTypeMenuChangeDetails,
  ) => {
    const nextState = getNextBlockTypeMenuState({
      ignoreOpeningClickClose: ignoreOpeningClickCloseRef.current,
      nextOpen,
      details,
    })
    ignoreOpeningClickCloseRef.current = nextState.ignoreOpeningClickClose
    setBlockTypeMenuOpen(nextState.open)
  }
  const snapshot = useSyncExternalStore(
    (onStoreChange) => {
      if (!editor || !visible || !editor.isEditable) {
        return () => undefined
      }

      const unsubscribeSelection = editor.onSelectionChange(() => {
        const selectionSnapshot = captureBlockNoteSelection(editor)
        selectionSnapshotRef.current = selectionSnapshot
        const collapsedPosition = blockNoteSelectionSnapshotCollapsedPosition(selectionSnapshot)
        const pendingSelectionPosition = pendingSelectionPositionRef.current
        if (
          hasPendingStyleColorsRef.current &&
          (collapsedPosition === null ||
            pendingSelectionPosition === null ||
            collapsedPosition !== pendingSelectionPosition)
        ) {
          hasPendingStyleColorsRef.current = false
          pendingSelectionPositionRef.current = null
          setPendingStyleColors({})
          setBlockNotePendingTextColor(editor, null)
        }
        onStoreChange()
      })
      const unsubscribeChange = editor.onChange(() => {
        onStoreChange()
      })

      return () => {
        unsubscribeSelection()
        unsubscribeChange()
      }
    },
    () => {
      const nextSnapshot = getVisibleToolbarSnapshot({
        defaultTextColor,
        editor,
        mode,
        visible,
      })
      if (toolbarSnapshotsEqual(snapshotRef.current, nextSnapshot)) {
        return snapshotRef.current
      }

      snapshotRef.current = nextSnapshot
      return nextSnapshot
    },
    () => EMPTY_TOOLBAR_SNAPSHOT,
  )
  const pendingTextColor = pendingStyleColors.textColor
  useEffect(() => {
    const visiblePendingTextColor =
      editor && visible && editor.isEditable ? (pendingTextColor ?? null) : null
    setBlockNotePendingTextColor(editor, visiblePendingTextColor)
    return () => setBlockNotePendingTextColor(editor, null)
  }, [editor, pendingTextColor, visible])

  if (!editor || !visible || !editor.isEditable) {
    return null
  }

  const activeBlockType =
    snapshot.supportedBlockTypes.find((option) => option.id === snapshot.activeBlockTypeId) ?? null
  const blockTypeLabel = activeBlockType?.label ?? 'Block type'
  const BlockTypeIcon = activeBlockType?.icon ?? Pilcrow
  const isFull = mode === 'full'

  const handleBlockTypeChange = (nextTypeId: string) => {
    const nextType = snapshot.supportedBlockTypes.find((option) => option.id === nextTypeId)
    if (!nextType) return

    applyFormattingToolbarBlockType({
      editor,
      nextType,
      selectionSnapshot: selectionSnapshotRef.current,
    })
  }

  const toggleInlineStyle = (style: InlineStyle) => {
    toggleFormattingToolbarInlineStyle({
      editor,
      selectionSnapshot: selectionSnapshotRef.current,
      style,
    })
  }

  const setTextAlignment = (alignment: TextAlignment) => {
    applyFormattingToolbarTextAlignment({
      alignment,
      editor,
      selectionSnapshot: selectionSnapshotRef.current,
    })
  }

  const setTextColor = (color: string) => {
    const selectionSnapshot = getCurrentSelectionSnapshot()
    pendingSelectionPositionRef.current =
      blockNoteSelectionSnapshotCollapsedPosition(selectionSnapshot)

    if (!snapshot.hasTextSelection && onApplyCollapsedTextColor) {
      onApplyCollapsedTextColor(editor, color, selectionSnapshot)
      onDefaultTextColorChange?.(color)
      setBlockNotePendingTextColor(editor, color)
      hasPendingStyleColorsRef.current = true
      setPendingStyleColors((current) => ({ ...current, textColor: color }))
      requestAnimationFrame(() => editor.focus())
      return
    }

    applyFormattingToolbarStyleColor({
      color,
      editor,
      selectionSnapshot,
      style: 'textColor',
    })
    setBlockNotePendingTextColor(editor, color)
    hasPendingStyleColorsRef.current = true
    setPendingStyleColors((current) => ({ ...current, textColor: color }))
  }

  const setBackgroundColor = (color: string) => {
    const selectionSnapshot = getCurrentSelectionSnapshot()
    pendingSelectionPositionRef.current =
      blockNoteSelectionSnapshotCollapsedPosition(selectionSnapshot)

    applyFormattingToolbarStyleColor({
      color,
      editor,
      selectionSnapshot,
      style: 'backgroundColor',
    })
    hasPendingStyleColorsRef.current = true
    setPendingStyleColors((current) => ({ ...current, backgroundColor: color }))
  }

  return (
    <div
      role="toolbar"
      aria-label={isFull ? NOTE_TOOLBAR_LABEL : CANVAS_TOOLBAR_LABEL}
      className={cn(
        'flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-md backdrop-blur-sm',
        isFull && 'w-full overflow-x-auto rounded-none border-x-0 border-t-0 px-3 shadow-none',
        className,
      )}
      onPointerDown={(event) => {
        captureSelection()
        if (eventStartedOnToolbarTrigger(event)) return
        preventEditorBlur(event)
      }}
    >
      <BlockTypeControl
        activeBlockTypeId={snapshot.activeBlockTypeId}
        blockTypeIcon={BlockTypeIcon}
        blockTypeLabel={blockTypeLabel}
        captureSelection={captureSelection}
        onBlockTypeChange={handleBlockTypeChange}
        onOpenChange={handleBlockTypeMenuOpenChange}
        open={blockTypeMenuOpen}
        supportedBlockTypes={snapshot.supportedBlockTypes}
      />

      <Separator orientation="vertical" className="h-6" />

      <ColorControls
        activeColor={pendingStyleColors.textColor ?? snapshot.activeTextColor}
        disabled={snapshot.hasTextSelection && !stringStyleExistsInSchema(editor, 'textColor')}
        kind="text"
        label="Text color"
        onColorChange={setTextColor}
      />

      <ColorControls
        activeColor={pendingStyleColors.backgroundColor ?? snapshot.activeBackgroundColor}
        disabled={!stringStyleExistsInSchema(editor, 'backgroundColor')}
        kind="background"
        label="Highlight color"
        onColorChange={setBackgroundColor}
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

      {isFull && snapshot.selectedFileBlock ? (
        <>
          <Separator orientation="vertical" className="h-6" />
          <FileCaptionPopover editor={editor} fileBlock={snapshot.selectedFileBlock} />
          <FileReplacePopover editor={editor} fileBlock={snapshot.selectedFileBlock} />
        </>
      ) : null}
    </div>
  )
}

function BlockTypeControl({
  activeBlockTypeId,
  blockTypeIcon: BlockTypeIcon,
  blockTypeLabel,
  captureSelection,
  onBlockTypeChange,
  onOpenChange,
  open,
  supportedBlockTypes,
}: {
  activeBlockTypeId: string | null
  blockTypeIcon: LucideIcon
  blockTypeLabel: string
  captureSelection: () => void
  onBlockTypeChange: (nextTypeId: string) => void
  onOpenChange: (nextOpen: boolean, details: BlockTypeMenuChangeDetails) => void
  open: boolean
  supportedBlockTypes: ToolbarSnapshot['supportedBlockTypes']
}) {
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={onOpenChange}>
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
            <span className="flex min-w-0 items-center gap-2">
              <BlockTypeIcon className="size-4" />
              <span className="truncate">{blockTypeLabel}</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent
        align="center"
        className="w-max min-w-0"
        finalFocus={false}
        onPointerDownCapture={(event) => {
          captureSelection()
          stopPropagation(event)
        }}
        onPointerUpCapture={stopPropagation}
        onClick={stopPropagation}
      >
        <DropdownMenuRadioGroup
          className="w-max"
          value={activeBlockTypeId ?? ''}
          onValueChange={onBlockTypeChange}
        >
          {supportedBlockTypes.map((option) => {
            const Icon = option.icon

            return (
              <DropdownMenuRadioItem
                key={option.id}
                value={option.id}
                className="gap-2 whitespace-nowrap"
              >
                <Icon className="size-4 shrink-0" />
                {option.label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
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

function ColorControls({
  activeColor,
  disabled,
  kind,
  label,
  onColorChange,
}: {
  activeColor: ToolbarSnapshot['activeTextColor'] | string
  disabled: boolean
  kind: 'background' | 'text'
  label: string
  onColorChange: (color: string) => void
}) {
  const [open, setOpen] = useState(false)
  const activeTextValue =
    typeof activeColor === 'string'
      ? undefined
      : activeColor.kind === 'value'
        ? activeColor.value
        : undefined
  const activeValue = typeof activeColor === 'string' ? activeColor : activeTextValue?.color
  const mixed = typeof activeColor !== 'string' && activeColor.kind === 'mixed'
  const triggerLabel = mixed ? `${label} (mixed values)` : label
  const options: ReadonlyArray<FormattingColorOption> =
    kind === 'text' ? TEXT_COLOR_OPTIONS : BACKGROUND_COLOR_OPTIONS

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2"
            aria-label={triggerLabel}
            disabled={disabled}
            title={triggerLabel}
            onMouseDown={preventEditorBlur}
          >
            {kind === 'background' ? (
              <Highlighter
                className="size-4"
                style={{ color: getHighlighterIconColor(activeValue, options) }}
              />
            ) : (
              <ColorIcon textColor={!mixed ? activeValue : undefined} size={18} />
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent
        align="center"
        className="w-auto min-w-0 overflow-visible p-2"
        style={{ zIndex: FLOATING_FORMATTING_COLOR_PALETTE_Z_INDEX }}
        aria-label={`${label} palette`}
        data-formatting-color-palette=""
        role="menu"
        initialFocus={false}
        finalFocus={false}
        onMouseDownCapture={preventEditorBlur}
        onPointerDownCapture={preventEditorBlur}
        onPointerUpCapture={stopPropagation}
        onClick={stopPropagation}
      >
        <div className="grid grid-cols-5 gap-1">
          {options.map((preset) => {
            const isActive = colorOptionIsActive({
              activeTextValue,
              activeValue,
              kind,
              preset,
            })

            return (
              <button
                key={`${preset.label}-${preset.value}`}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                aria-label={getColorOptionAriaLabel(kind, preset)}
                disabled={disabled}
                title={preset.label}
                className="group/formatting-color-option flex size-10 items-center justify-center overflow-hidden rounded-md border p-0 outline-none hover:bg-(--formatting-color-surface) focus:bg-(--formatting-color-surface) focus:text-foreground active:bg-(--formatting-color-pressed) aria-checked:bg-(--formatting-color-surface) focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1"
                style={getColorOptionStyle(kind, preset, isActive)}
                onMouseDown={preventEditorBlur}
                onPointerDown={preventEditorBlur}
                onClick={(event) => {
                  stopPropagation(event)
                  onColorChange(preset.value)
                }}
              >
                <ColorOptionPreview kind={kind} preset={preset} />
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function getHighlighterIconColor(
  activeValue: string | undefined,
  options: ReadonlyArray<FormattingColorOption>,
) {
  if (!activeValue || activeValue === 'default') {
    return 'var(--muted-foreground)'
  }

  const activeOption = options.find((option) => option.value === activeValue)
  return activeOption ? getColorOptionDisplayColor(activeOption) : activeValue
}

function colorOptionIsActive({
  activeTextValue,
  activeValue,
  kind,
  preset,
}: {
  activeTextValue: ActiveTextColorValue | undefined
  activeValue: string | undefined
  kind: FormattingColorKind
  preset: FormattingColorOption
}) {
  if (kind === 'text' && activeTextValue) {
    return areCanvasPaintValuesEqual(activeTextValue, {
      color: preset.value,
      opacity: 100,
    })
  }

  return activeValue === preset.value
}

function getColorOptionAriaLabel(kind: FormattingColorKind, preset: FormattingColorOption) {
  if (isClearHighlightOption(kind, preset)) {
    return 'Select No highlight'
  }

  return `Select ${preset.label} ${kind === 'text' ? 'text' : 'highlight'} color`
}

function getColorOptionStyle(
  kind: FormattingColorKind,
  preset: FormattingColorOption,
  isActive: boolean,
): CSSProperties {
  const borderColor = getColorOptionBorderColor(kind, preset)

  return {
    borderColor,
    ...getColorOptionStateVariables(kind, preset),
    boxShadow: isActive ? `0 0 0 2px ${borderColor}` : 'none',
  }
}

function getColorOptionStateVariables(
  kind: FormattingColorKind,
  preset: FormattingColorOption,
): CSSProperties {
  if (isClearHighlightOption(kind, preset)) {
    return {
      '--formatting-color-pressed': 'color-mix(in srgb, var(--border) 40%, transparent)',
      '--formatting-color-surface': 'color-mix(in srgb, var(--border) 24%, transparent)',
    } as CSSProperties
  }

  const hoverIntensity = 40
  const pressedIntensity = 52

  return {
    '--formatting-color-pressed': getTransparentColor(
      getColorOptionSurfaceColor(kind, preset),
      pressedIntensity,
    ),
    '--formatting-color-surface': getTransparentColor(
      getColorOptionSurfaceColor(kind, preset),
      hoverIntensity,
    ),
  } as CSSProperties
}

function getColorOptionBorderColor(kind: FormattingColorKind, preset: FormattingColorOption) {
  const borderColor = isClearHighlightOption(kind, preset)
    ? 'var(--border)'
    : getColorOptionDisplayColor(preset)

  return `color-mix(in srgb, ${borderColor} 70%, transparent)`
}

function getColorOptionDisplayColor(preset: FormattingColorOption) {
  return preset.displayColor ?? preset.value
}

function getColorOptionSurfaceColor(kind: FormattingColorKind, preset: FormattingColorOption) {
  return kind === 'background' ? preset.value : (preset.surfaceColor ?? preset.value)
}

function ColorOptionPreview({
  kind,
  preset,
}: {
  kind: FormattingColorKind
  preset: FormattingColorOption
}) {
  if (isClearHighlightOption(kind, preset)) {
    return <CheckerboardSwatch className="size-full" />
  }

  if (kind === 'background') {
    return (
      <span
        className="flex size-full items-center justify-center"
        style={{ backgroundColor: getTransparentColor(preset.value, 28) }}
      >
        <Highlighter
          className="size-4"
          stroke={getColorOptionDisplayColor(preset)}
          style={{ color: getColorOptionDisplayColor(preset) }}
        />
      </span>
    )
  }

  return (
    <span className="text-lg font-semibold leading-none" style={{ color: preset.value }}>
      A
    </span>
  )
}

function getTransparentColor(color: string, intensity: number) {
  return `color-mix(in srgb, ${color} ${intensity}%, transparent)`
}

function isClearHighlightOption(kind: FormattingColorKind, preset: FormattingColorOption) {
  return kind === 'background' && preset.value === 'default'
}

function FileCaptionPopover({
  editor,
  fileBlock,
}: {
  editor: FormattingEditor
  fileBlock: SelectedFileBlock
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const caption = readFormString(event.currentTarget, 'caption')
    editor.updateBlock(fileBlock.id, {
      props: { caption },
    })
  }

  return (
    <Popover>
      <PopoverTrigger
        nativeButton
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit file caption">
            <FilePenLine className="size-4" />
          </Button>
        }
      />
      <PopoverContent onPointerDownCapture={stopPropagation}>
        <form aria-label="Edit file caption form" onSubmit={handleSubmit}>
          <Input
            key={`${fileBlock.id}-${fileBlock.caption}`}
            aria-label="File caption"
            name="caption"
            defaultValue={fileBlock.caption}
            placeholder="File caption"
          />
        </form>
      </PopoverContent>
    </Popover>
  )
}

function FileReplacePopover({
  editor,
  fileBlock,
}: {
  editor: FormattingEditor
  fileBlock: SelectedFileBlock
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const url = readFormString(event.currentTarget, 'url')
    if (!url.trim()) return
    editor.updateBlock(fileBlock.id, {
      props: { url: url.trim() },
    })
  }

  return (
    <Popover>
      <PopoverTrigger
        nativeButton
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Replace file">
            <FileUp className="size-4" />
          </Button>
        }
      />
      <PopoverContent onPointerDownCapture={stopPropagation}>
        <form aria-label="Replace file form" onSubmit={handleSubmit}>
          <Input
            key={`${fileBlock.id}-${fileBlock.url}`}
            aria-label="Replacement file URL"
            name="url"
            defaultValue={fileBlock.url}
            placeholder="File URL"
          />
        </form>
      </PopoverContent>
    </Popover>
  )
}

function readFormString(form: HTMLFormElement, name: string) {
  const value = new FormData(form).get(name)
  return typeof value === 'string' ? value : ''
}

function preventEditorBlur(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function eventStartedOnToolbarTrigger(event: SyntheticEvent) {
  return (
    event.target instanceof Element &&
    (event.target.closest('[data-slot="dropdown-menu-trigger"]') !== null ||
      event.target.closest('[data-slot="popover-trigger"]') !== null)
  )
}

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation()
}
