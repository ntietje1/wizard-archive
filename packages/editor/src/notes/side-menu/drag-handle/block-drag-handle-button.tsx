import { SideMenuExtension } from '@blocknote/core/extensions'
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useExtensionState,
} from '@blocknote/react'
import {
  Check,
  Copy,
  Files,
  GripVertical,
  MessageSquare,
  Palette,
  Trash2,
  Type,
} from 'lucide-react'
import { useLayoutEffect } from 'react'
import { toast } from 'sonner'
import {
  clearInternalNativeDrag,
  markInternalNativeDrag,
} from '@wizard-archive/ui/drag-drop/internal-native-drag'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@wizard-archive/ui/shadcn/components/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@wizard-archive/ui/shadcn/components/tooltip'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import {
  RICH_TEXT_COLOR_PRESETS,
  RICH_TEXT_HIGHLIGHT_PRESETS,
} from '../../../rich-text/blocknote/rich-text-selection-colors'
import {
  blockTypeSupportsProp,
  getSupportedBlockTypeOptions,
} from '../../../rich-text/formatting-toolbar/formatting-toolbar-model'
import { duplicateNoteBlock } from './duplicate-note-block'
import type { NoteBlockNoteEditor } from '../../note-editor-schema'
import type { BlockTypeOption } from '../../../rich-text/formatting-toolbar/formatting-toolbar-model'

type NoteEditorBlock = NoteBlockNoteEditor['document'][number]

export function BlockDragHandleButton({
  menuOpen,
  onMenuOpenChange,
}: {
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}) {
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor() as NoteBlockNoteEditor
  const sideMenu = useExtension(SideMenuExtension)
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  })

  useLayoutEffect(() => {
    if (!menuOpen) return
    sideMenu.freezeMenu()
    return () => sideMenu.unfreezeMenu()
  }, [menuOpen, sideMenu])

  if (!block) return null
  const sideMenuBlock = block
  const activeBlock = sideMenuBlock as NoteEditorBlock

  function handleDragStart(event: React.DragEvent) {
    sideMenu.freezeMenu()
    sideMenu.blockDragStart(event, sideMenuBlock)
    markInternalNativeDrag(event.dataTransfer)
    showNativeBlockDragPreview(event)
  }

  function handleDragEnd() {
    sideMenu.blockDragEnd()
    if (menuOpen) {
      onMenuOpenChange(false)
    } else {
      sideMenu.unfreezeMenu()
    }
    clearInternalNativeDrag()
  }

  return (
    <DropdownMenu modal open={menuOpen} onOpenChange={onMenuOpenChange}>
      <Tooltip disabled={menuOpen} disableHoverablePopup>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              onClick={() => onMenuOpenChange(!menuOpen)}
              onMouseDown={(event) => event.preventBaseUIHandler()}
              render={
                <Components.SideMenu.Button
                  label="Drag block"
                  draggable
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'bn-button block-drag-handle-button mr-2 cursor-grab active:cursor-grabbing',
                    menuOpen && 'bg-accent',
                  )}
                  icon={<GripVertical size={18} style={{ pointerEvents: 'none' }} />}
                  data-testid="block-drag-handle-button"
                />
              }
            />
          }
        />
        <TooltipContent
          side="bottom"
          positionerClassName="pointer-events-none"
          className="whitespace-pre-line"
        >
          <span className="block">
            <em>Drag</em> to move
          </span>
          <span className="block">
            <em>Click</em> to open menu
          </span>
        </TooltipContent>
      </Tooltip>
      <BlockDragHandleMenu block={activeBlock} editor={editor} />
    </DropdownMenu>
  )
}

function showNativeBlockDragPreview(event: React.DragEvent) {
  const root = event.currentTarget.getRootNode()
  if (!(root instanceof Document || root instanceof ShadowRoot)) return
  const preview = root.querySelector<HTMLElement>('.bn-drag-preview')
  if (!preview) return

  preview.style.opacity = '1'
  preview.style.zIndex = '-1'
  event.dataTransfer.setDragImage(preview, 0, 0)
}

function BlockDragHandleMenu({
  block,
  editor,
}: {
  block: NoteEditorBlock
  editor: NoteBlockNoteEditor
}) {
  return (
    <DropdownMenuContent
      data-testid="block-drag-handle-menu"
      side="left"
      align="center"
      sideOffset={4}
      className="z-[9999] w-48"
    >
      <BlockTypeSubmenu block={block} editor={editor} />
      <BlockColorSubmenu block={block} editor={editor} />
      <DropdownMenuSeparator />
      <MenuItem
        icon={<Copy className="size-4" />}
        label="Copy link to block"
        onClick={comingSoon}
      />
      <MenuItem
        icon={<Files className="size-4" />}
        label="Duplicate"
        onClick={() => duplicateNoteBlock(editor, block)}
      />
      <MenuItem
        destructive
        icon={<Trash2 className="size-4" />}
        label="Delete"
        onClick={() => editor.removeBlocks([block])}
      />
      <MenuItem icon={<MessageSquare className="size-4" />} label="Comment" onClick={comingSoon} />
    </DropdownMenuContent>
  )
}

function BlockTypeSubmenu({
  block,
  editor,
}: {
  block: NoteEditorBlock
  editor: NoteBlockNoteEditor
}) {
  const options = getSupportedBlockTypeOptions(editor, 'full')
  const canChangeType = Array.isArray(block.content)

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={!canChangeType}>
        <Type className="size-4" />
        <span className="min-w-0 flex-1 truncate text-left">Turn into</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="z-[10000] w-52">
        {options.map((option) => (
          <BlockTypeMenuItem key={option.id} block={block} editor={editor} option={option} />
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function BlockTypeMenuItem({
  block,
  editor,
  option,
}: {
  block: NoteEditorBlock
  editor: NoteBlockNoteEditor
  option: BlockTypeOption
}) {
  const active =
    block.type === option.type &&
    Object.entries(option.props ?? {}).every(([name, value]) => getBlockProp(block, name) === value)
  const Icon = option.icon

  return (
    <DropdownMenuItem
      onClick={() => editor.updateBlock(block, { type: option.type, props: option.props })}
    >
      <Icon className="size-4" />
      <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
      {active && <Check className="ml-auto size-4" />}
    </DropdownMenuItem>
  )
}

function BlockColorSubmenu({
  block,
  editor,
}: {
  block: NoteEditorBlock
  editor: NoteBlockNoteEditor
}) {
  const supportsTextColor = blockTypeSupportsProp(editor, block.type, 'textColor')
  const supportsBackgroundColor = blockTypeSupportsProp(editor, block.type, 'backgroundColor')

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={!supportsTextColor && !supportsBackgroundColor}>
        <Palette className="size-4" />
        <span className="min-w-0 flex-1 truncate text-left">Color</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="z-[10000] w-52">
        {supportsTextColor && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Text color</DropdownMenuLabel>
            {RICH_TEXT_COLOR_PRESETS.map((preset) => (
              <BlockColorMenuItem
                key={`text-${preset.label}`}
                active={getBlockProp(block, 'textColor') === preset.value.color}
                color={preset.value.color}
                label={`${preset.label} text`}
                onClick={() =>
                  editor.updateBlock(block, { props: { textColor: preset.value.color } })
                }
              />
            ))}
          </DropdownMenuGroup>
        )}
        {supportsTextColor && supportsBackgroundColor && <DropdownMenuSeparator />}
        {supportsBackgroundColor && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Background color</DropdownMenuLabel>
            {RICH_TEXT_HIGHLIGHT_PRESETS.map((preset) => (
              <BlockColorMenuItem
                key={`background-${preset.label}`}
                active={getBlockProp(block, 'backgroundColor') === preset.value}
                color={preset.value}
                label={
                  preset.label === 'No highlight' ? preset.label : `${preset.label} background`
                }
                onClick={() =>
                  editor.updateBlock(block, { props: { backgroundColor: preset.value } })
                }
              />
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function BlockColorMenuItem({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean
  color: string
  label: string
  onClick: () => void
}) {
  return (
    <DropdownMenuItem onClick={onClick}>
      <span
        aria-hidden
        className="size-4 rounded-sm border border-border"
        style={{ backgroundColor: color === 'default' ? 'transparent' : color }}
      />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {active && <Check className="ml-auto size-4" />}
    </DropdownMenuItem>
  )
}

function MenuItem({
  destructive = false,
  icon,
  label,
  onClick,
}: {
  destructive?: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <DropdownMenuItem variant={destructive ? 'destructive' : 'default'} onClick={onClick}>
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </DropdownMenuItem>
  )
}

function comingSoon() {
  toast.info('Coming soon')
}

function getBlockProp(block: NoteEditorBlock, name: string) {
  return (block.props as Record<string, unknown>)[name]
}
