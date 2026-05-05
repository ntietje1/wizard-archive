import { ChevronDown, Pilcrow } from 'lucide-react'
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
import {
  applyCanvasToolbarBlockType,
  applyCanvasToolbarTextAlignment,
  applyCanvasToolbarTextColor,
  toggleCanvasToolbarInlineStyle,
} from './canvas-floating-formatting-toolbar-commands'
import {
  EMPTY_TOOLBAR_SNAPSHOT,
  INLINE_STYLE_OPTIONS,
  TEXT_ALIGNMENT_OPTIONS,
  getVisibleToolbarSnapshot,
  styleExistsInSchema,
  textColorStyleExistsInSchema,
  toolbarSnapshotsEqual,
} from './canvas-floating-formatting-toolbar-model'
import type {
  FormattingEditor,
  InlineStyle,
  TextAlignment,
  ToolbarSnapshot,
} from './canvas-floating-formatting-toolbar-model'
import { getNextBlockTypeMenuState } from './canvas-floating-formatting-toolbar-state'
import type { BlockTypeMenuChangeDetails } from './canvas-floating-formatting-toolbar-state'
import { textColorCanvasProperty } from '../../properties/canvas-property-definitions'
import { areCanvasPaintValuesEqual } from '../../properties/canvas-paint-values'
import { captureCanvasRichTextSelection } from './canvas-rich-text-blocknote-adapter'
import type { CanvasRichTextSelectionSnapshot } from './canvas-rich-text-blocknote-adapter'
import { ColorIcon } from '~/features/editor/components/extensions/selection-toolbar/color-picker/color-icon'

interface CanvasFloatingFormattingToolbarProps {
  defaultTextColor?: string
  editor: FormattingEditor | null
  onDefaultTextColorChange?: (color: string) => void
  visible: boolean
}

const FLOATING_FORMATTING_TOOLBAR_Z_INDEX = 60
const FLOATING_FORMATTING_COLOR_PALETTE_Z_INDEX = 70

export function CanvasFloatingFormattingToolbar({
  defaultTextColor = textColorCanvasProperty.defaultValue.color,
  editor,
  onDefaultTextColorChange,
  visible,
}: CanvasFloatingFormattingToolbarProps) {
  const snapshotRef = useRef<ToolbarSnapshot>(EMPTY_TOOLBAR_SNAPSHOT)
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
    () => EMPTY_TOOLBAR_SNAPSHOT,
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

    applyCanvasToolbarBlockType({
      editor,
      nextType,
      selectionSnapshot: selectionSnapshotRef.current,
    })
  }

  const toggleInlineStyle = (style: InlineStyle) => {
    toggleCanvasToolbarInlineStyle({
      editor,
      selectionSnapshot: selectionSnapshotRef.current,
      style,
    })
  }

  const setTextAlignment = (alignment: TextAlignment) => {
    applyCanvasToolbarTextAlignment({
      alignment,
      editor,
      selectionSnapshot: selectionSnapshotRef.current,
    })
  }

  const setTextColor = (color: string) => {
    applyCanvasToolbarTextColor({
      color,
      defaultTextColor,
      editor,
      hasTextSelection: snapshot.hasTextSelection,
      onDefaultTextColorChange,
      selectionSnapshot: selectionSnapshotRef.current,
    })
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
        finalFocus={false}
        onPointerDownCapture={(event) => {
          preventEditorBlur(event)
        }}
        onPointerUpCapture={stopPropagation}
        onClick={stopPropagation}
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
