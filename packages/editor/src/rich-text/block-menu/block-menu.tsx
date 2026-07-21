import type { BlockNoteEditor } from '@blocknote/core'
import { Check, ChevronRight, Copy, Files, Palette, Share2, Trash2, Type } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@wizard-archive/ui/shadcn/components/context-menu'
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@wizard-archive/ui/shadcn/components/dropdown-menu'
import {
  RICH_TEXT_COLOR_PRESETS,
  RICH_TEXT_HIGHLIGHT_PRESETS,
} from '../blocknote/rich-text-selection-colors'
import {
  blockTypeSupportsProp,
  getSupportedBlockTypeOptions,
} from '../formatting-toolbar/formatting-toolbar-model'
import type { BlockTypeOption } from '../formatting-toolbar/formatting-toolbar-model'

export type RichTextBlockMenuEditor = BlockNoteEditor<any, any, any>
export type RichTextBlockMenuBlock = RichTextBlockMenuEditor['document'][number]

type BlockMenuSurface = 'context' | 'dropdown'

export function RichTextBlockMenuItems({
  block,
  editor,
  onCopyLink,
  onDuplicate,
  onOpenVisibility,
  surface,
}: {
  block: RichTextBlockMenuBlock
  editor: RichTextBlockMenuEditor
  onCopyLink?: (block: RichTextBlockMenuBlock) => void
  onDuplicate: (editor: RichTextBlockMenuEditor, block: RichTextBlockMenuBlock) => void
  onOpenVisibility?: (block: RichTextBlockMenuBlock) => void
  surface: BlockMenuSurface
}) {
  return (
    <>
      <BlockTypeSubmenu block={block} editor={editor} surface={surface} />
      <BlockColorSubmenu block={block} editor={editor} surface={surface} />
      <MenuSeparator surface={surface} />
      {onOpenVisibility && (
        <MenuItem
          icon={<Share2 className="size-4" />}
          label="Visibility..."
          onClick={() => onOpenVisibility(block)}
          surface={surface}
        />
      )}
      {onCopyLink && (
        <MenuItem
          icon={<Copy className="size-4" />}
          label="Copy link to block"
          onClick={() => onCopyLink(block)}
          surface={surface}
        />
      )}
      <MenuItem
        icon={<Files className="size-4" />}
        label="Duplicate"
        onClick={() => onDuplicate(editor, block)}
        surface={surface}
      />
      <MenuItem
        destructive
        icon={<Trash2 className="size-4" />}
        label="Delete"
        onClick={() => editor.removeBlocks([block])}
        surface={surface}
      />
    </>
  )
}

function BlockTypeSubmenu({
  block,
  editor,
  surface,
}: {
  block: RichTextBlockMenuBlock
  editor: RichTextBlockMenuEditor
  surface: BlockMenuSurface
}) {
  const options = getSupportedBlockTypeOptions(editor, 'full')
  const canChangeType = Array.isArray(block.content)

  return (
    <MenuSub surface={surface}>
      <MenuSubTrigger disabled={!canChangeType} surface={surface}>
        <Type className="size-4" />
        <span className="min-w-0 flex-1 truncate text-left">Turn into</span>
      </MenuSubTrigger>
      <MenuSubContent surface={surface}>
        {options.map((option) => (
          <BlockTypeMenuItem
            key={option.id}
            block={block}
            editor={editor}
            option={option}
            surface={surface}
          />
        ))}
      </MenuSubContent>
    </MenuSub>
  )
}

function BlockTypeMenuItem({
  block,
  editor,
  option,
  surface,
}: {
  block: RichTextBlockMenuBlock
  editor: RichTextBlockMenuEditor
  option: BlockTypeOption
  surface: BlockMenuSurface
}) {
  const active =
    block.type === option.type &&
    Object.entries(option.props ?? {}).every(([name, value]) => getBlockProp(block, name) === value)
  const Icon = option.icon

  return (
    <MenuItem
      icon={<Icon className="size-4" />}
      label={option.label}
      onClick={() => editor.updateBlock(block, { type: option.type, props: option.props })}
      selected={active}
      surface={surface}
    />
  )
}

function BlockColorSubmenu({
  block,
  editor,
  surface,
}: {
  block: RichTextBlockMenuBlock
  editor: RichTextBlockMenuEditor
  surface: BlockMenuSurface
}) {
  const supportsTextColor = blockTypeSupportsProp(editor, block.type, 'textColor')
  const supportsBackgroundColor = blockTypeSupportsProp(editor, block.type, 'backgroundColor')

  return (
    <MenuSub surface={surface}>
      <MenuSubTrigger disabled={!supportsTextColor && !supportsBackgroundColor} surface={surface}>
        <Palette className="size-4" />
        <span className="min-w-0 flex-1 truncate text-left">Color</span>
      </MenuSubTrigger>
      <MenuSubContent surface={surface}>
        {supportsTextColor && (
          <MenuGroup ariaLabel="Text color" surface={surface}>
            <MenuLabel surface={surface}>Text color</MenuLabel>
            {RICH_TEXT_COLOR_PRESETS.map((preset) => (
              <BlockColorMenuItem
                key={`text-${preset.label}`}
                active={getBlockProp(block, 'textColor') === preset.value.color}
                color={preset.value.color}
                label={preset.label}
                onClick={() =>
                  editor.updateBlock(block, { props: { textColor: preset.value.color } })
                }
                surface={surface}
              />
            ))}
          </MenuGroup>
        )}
        {supportsTextColor && supportsBackgroundColor && <MenuSeparator surface={surface} />}
        {supportsBackgroundColor && (
          <MenuGroup ariaLabel="Background color" surface={surface}>
            <MenuLabel surface={surface}>Background color</MenuLabel>
            {RICH_TEXT_HIGHLIGHT_PRESETS.map((preset) => (
              <BlockColorMenuItem
                key={`background-${preset.label}`}
                active={getBlockProp(block, 'backgroundColor') === preset.value}
                color={preset.value}
                label={preset.label}
                onClick={() =>
                  editor.updateBlock(block, { props: { backgroundColor: preset.value } })
                }
                surface={surface}
              />
            ))}
          </MenuGroup>
        )}
      </MenuSubContent>
    </MenuSub>
  )
}

function BlockColorMenuItem({
  active,
  color,
  label,
  onClick,
  surface,
}: {
  active: boolean
  color: string
  label: string
  onClick: () => void
  surface: BlockMenuSurface
}) {
  return (
    <MenuItem
      icon={
        <span
          aria-hidden
          className="size-4 rounded-sm border border-border"
          style={{ backgroundColor: color === 'default' ? 'transparent' : color }}
        />
      }
      label={label}
      onClick={onClick}
      selected={active}
      surface={surface}
    />
  )
}

function MenuItem({
  destructive = false,
  icon,
  label,
  onClick,
  selected = false,
  surface,
}: {
  destructive?: boolean
  icon: ReactNode
  label: string
  onClick: () => void
  selected?: boolean
  surface: BlockMenuSurface
}) {
  const children = (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {selected && <Check className="ml-auto size-4" />}
    </>
  )
  return surface === 'dropdown' ? (
    <DropdownMenuItem variant={destructive ? 'destructive' : 'default'} onClick={onClick}>
      {children}
    </DropdownMenuItem>
  ) : (
    <ContextMenuItem variant={destructive ? 'destructive' : 'default'} onClick={onClick}>
      {children}
    </ContextMenuItem>
  )
}

function MenuSub({ children, surface }: { children: ReactNode; surface: BlockMenuSurface }) {
  return surface === 'dropdown' ? (
    <DropdownMenuSub>{children}</DropdownMenuSub>
  ) : (
    <ContextMenuSub>{children}</ContextMenuSub>
  )
}

function MenuSubTrigger({
  children,
  disabled,
  surface,
}: {
  children: ReactNode
  disabled: boolean
  surface: BlockMenuSurface
}) {
  return surface === 'dropdown' ? (
    <DropdownMenuSubTrigger disabled={disabled}>{children}</DropdownMenuSubTrigger>
  ) : (
    <ContextMenuSubTrigger disabled={disabled}>
      {children}
      <ChevronRight className="ml-auto size-4" />
    </ContextMenuSubTrigger>
  )
}

function MenuSubContent({ children, surface }: { children: ReactNode; surface: BlockMenuSurface }) {
  return surface === 'dropdown' ? (
    <DropdownMenuSubContent className="z-[10000] w-52">{children}</DropdownMenuSubContent>
  ) : (
    <ContextMenuSubContent className="w-52">{children}</ContextMenuSubContent>
  )
}

function MenuGroup({
  ariaLabel,
  children,
  surface,
}: {
  ariaLabel: string
  children: ReactNode
  surface: BlockMenuSurface
}) {
  return surface === 'dropdown' ? (
    <DropdownMenuGroup aria-label={ariaLabel}>{children}</DropdownMenuGroup>
  ) : (
    <ContextMenuGroup aria-label={ariaLabel}>{children}</ContextMenuGroup>
  )
}

function MenuLabel({ children, surface }: { children: ReactNode; surface: BlockMenuSurface }) {
  return surface === 'dropdown' ? (
    <DropdownMenuLabel>{children}</DropdownMenuLabel>
  ) : (
    <ContextMenuLabel>{children}</ContextMenuLabel>
  )
}

function MenuSeparator({ surface }: { surface: BlockMenuSurface }) {
  return surface === 'dropdown' ? <DropdownMenuSeparator /> : <ContextMenuSeparator />
}

function getBlockProp(block: RichTextBlockMenuBlock, name: string) {
  return (block.props as Record<string, unknown>)[name]
}
