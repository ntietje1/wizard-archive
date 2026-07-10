import { ChevronDown } from 'lucide-react'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@wizard-archive/ui/shadcn/components/dropdown-menu'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import {
  INLINE_STYLE_OPTIONS,
  TEXT_ALIGNMENT_OPTIONS,
  styleExistsInSchema,
} from './formatting-toolbar-model'
import { preventEditorBlur, stopPropagation } from './formatting-toolbar-events'
import type { LucideIcon } from 'lucide-react'
import type { BlockTypeMenuChangeDetails } from './formatting-toolbar-state'
import type {
  InlineStyle,
  RichTextFormattingEditor,
  TextAlignment,
  ToolbarSnapshot,
} from './formatting-toolbar-model'

export function BlockTypeControl({
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
            type="button"
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

export function InlineStyleControls({
  editor,
  onToggleInlineStyle,
  snapshot,
}: {
  editor: RichTextFormattingEditor
  onToggleInlineStyle: (style: InlineStyle) => void
  snapshot: ToolbarSnapshot
}) {
  return renderToolbarOptionButtons({
    options: INLINE_STYLE_OPTIONS,
    isActive: (id) => !!snapshot.activeStyles[id],
    isDisabled: (id) => !snapshot.canFormatInline || !styleExistsInSchema(editor, id),
    onClick: onToggleInlineStyle,
  })
}

export function TextAlignmentControls({
  onTextAlignmentChange,
  snapshot,
}: {
  onTextAlignmentChange: (alignment: TextAlignment) => void
  snapshot: ToolbarSnapshot
}) {
  return renderToolbarOptionButtons({
    options: TEXT_ALIGNMENT_OPTIONS,
    isActive: (id) => snapshot.activeAlignment === id,
    isDisabled: () => !snapshot.canAlign,
    onClick: onTextAlignmentChange,
  })
}

function renderToolbarOptionButtons<TId extends string>({
  isActive,
  isDisabled,
  onClick,
  options,
}: {
  isActive: (id: TId) => boolean
  isDisabled: (id: TId) => boolean
  onClick: (id: TId) => void
  options: ReadonlyArray<{ icon: LucideIcon; id: TId; label: string }>
}) {
  return options.map(({ id, icon: Icon, label }) => (
    <ToolbarButton
      key={id}
      active={isActive(id)}
      disabled={isDisabled(id)}
      icon={Icon}
      label={label}
      onClick={() => onClick(id)}
    />
  ))
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
      className={cn(
        active && 'bg-primary/20 text-foreground hover:bg-primary/10 dark:hover:bg-primary/30',
      )}
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
