import { SideMenuExtension } from '@blocknote/core/extensions'
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useExtensionState,
} from '@blocknote/react'
import { GripVertical } from 'lucide-react'
import { useLayoutEffect } from 'react'
import {
  clearInternalNativeDrag,
  markInternalNativeDrag,
} from '@wizard-archive/ui/drag-drop/internal-native-drag'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@wizard-archive/ui/shadcn/components/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@wizard-archive/ui/shadcn/components/tooltip'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { RichTextBlockMenuItems } from '../block-menu/block-menu'
import type { RichTextBlockMenuBlock, RichTextBlockMenuEditor } from '../block-menu/block-menu'

export function BlockDragHandleButton({
  menuOpen,
  onCopyLink,
  onDuplicate,
  onMenuOpenChange,
  variant,
}: {
  menuOpen: boolean
  onCopyLink?: (block: RichTextBlockMenuBlock) => void
  onDuplicate: (editor: RichTextBlockMenuEditor, block: RichTextBlockMenuBlock) => void
  onMenuOpenChange: (open: boolean) => void
  variant: 'canvas-text' | 'note'
}) {
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor() as RichTextBlockMenuEditor
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
  const activeBlock = sideMenuBlock as RichTextBlockMenuBlock

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
                  data-block-drag-actions={variant}
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
      <BlockDragHandleMenu
        block={activeBlock}
        editor={editor}
        onCopyLink={onCopyLink}
        onDuplicate={onDuplicate}
      />
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
  onCopyLink,
  onDuplicate,
}: {
  block: RichTextBlockMenuBlock
  editor: RichTextBlockMenuEditor
  onCopyLink?: (block: RichTextBlockMenuBlock) => void
  onDuplicate: (editor: RichTextBlockMenuEditor, block: RichTextBlockMenuBlock) => void
}) {
  return (
    <DropdownMenuContent
      data-testid="block-drag-handle-menu"
      side="left"
      align="center"
      sideOffset={4}
      className="z-[9999] w-48"
    >
      <RichTextBlockMenuItems
        block={block}
        editor={editor}
        onCopyLink={onCopyLink}
        onDuplicate={onDuplicate}
        surface="dropdown"
      />
    </DropdownMenuContent>
  )
}
