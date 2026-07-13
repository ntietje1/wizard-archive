import { SideMenuExtension } from '@blocknote/core/extensions'
import { useComponentsContext, useExtension, useExtensionState } from '@blocknote/react'
import { Copy, Files, GripVertical, MessageSquare, Palette, Trash2, Type } from 'lucide-react'
import { use, useLayoutEffect } from 'react'
import { toast } from 'sonner'
import type { NoteBlockId } from '../../../resources/domain-id'
import type { NoteItemWithContent } from '../../../notes/item-contract'
import {
  clearInternalNativeDrag,
  markInternalNativeDrag,
} from '@wizard-archive/ui/drag-drop/internal-native-drag'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { openNoteBlockContextMenuFromEvent } from '../../context-menu/open-note-block-context-menu-from-event'
import { BlockNoteContextMenuContext } from '../../context-menu/blocknote-context-menu'

export function BlockDragHandleButton({
  menuOpen,
  note,
  onMenuOpenChange,
}: {
  menuOpen: boolean
  note: NoteItemWithContent
  onMenuOpenChange: (open: boolean) => void
}) {
  const Components = useComponentsContext()!
  const sideMenu = useExtension(SideMenuExtension)
  const contextMenu = use(BlockNoteContextMenuContext)
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  })
  useLayoutEffect(() => {
    if (!menuOpen) return
    sideMenu.freezeMenu()
    return () => sideMenu.unfreezeMenu()
  }, [menuOpen, sideMenu])

  if (!block) return null
  const activeBlock = block

  function handleContextMenu(event: React.MouseEvent<HTMLElement>) {
    if (!contextMenu) return
    openNoteBlockContextMenuFromEvent({
      event,
      note,
      noteBlockId: activeBlock.id as NoteBlockId,
      openMenu: contextMenu.openMenu,
    })
  }

  function handleDragStart(event: React.DragEvent) {
    sideMenu.freezeMenu()
    sideMenu.blockDragStart(event, activeBlock)
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
              onContextMenu={handleContextMenu}
              onMouseDown={(event) => event.preventBaseUIHandler()}
              render={
                <Components.SideMenu.Button
                  label="Drag block"
                  draggable
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'bn-button block-drag-handle-button cursor-grab mr-2 active:cursor-grabbing',
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
      <BlockDragHandleMenu />
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

function BlockDragHandleMenu() {
  return (
    <DropdownMenuContent
      data-testid="block-drag-handle-menu"
      side="left"
      align="center"
      sideOffset={4}
      className="z-[9999] w-48"
    >
      <SubmenuItem icon={<Type className="size-4" />} label="Turn into" />
      <SubmenuItem icon={<Palette className="size-4" />} label="Color" />
      <DropdownMenuSeparator />
      <MenuItem icon={<Copy className="size-4" />} label="Copy link to block" />
      <MenuItem icon={<Files className="size-4" />} label="Duplicate" />
      <MenuItem icon={<Trash2 className="size-4" />} label="Delete" destructive />
      <MenuItem icon={<MessageSquare className="size-4" />} label="Comment" />
    </DropdownMenuContent>
  )
}

function SubmenuItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={menuItemClassName()}>
        {icon}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="z-[10000] w-40">
        <MenuItem label="Coming soon" />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function MenuItem({
  destructive = false,
  icon,
  label,
}: {
  destructive?: boolean
  icon?: React.ReactNode
  label: string
}) {
  return (
    <DropdownMenuItem
      variant={destructive ? 'destructive' : 'default'}
      className={menuItemClassName(destructive)}
      onClick={showComingSoon}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </DropdownMenuItem>
  )
}

function menuItemClassName(destructive = false) {
  return cn(
    'flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
    destructive
      ? 'text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive'
      : 'text-popover-foreground',
  )
}

function showComingSoon() {
  toast.info('Coming soon')
}
