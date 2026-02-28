import { useEffect, useRef, useState } from 'react'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { TrashPopoverContent } from './trash-popover-content'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/shadcn/ui/popover'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useTrashedSidebarItems } from '~/hooks/useSidebarItems'
import { TRASH_DROP_ZONE_TYPE } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'
import { Trash2 } from '~/lib/icons'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

export function TrashButton() {
  const [open, setOpen] = useState(false)
  const { navigateToTrash } = useEditorNavigation()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const { parentItemsMap } = useTrashedSidebarItems()
  const rootTrashedItems = parentItemsMap.get(undefined) ?? []
  const trashCount = rootTrashedItems.length
  const dragDropAction = useSidebarUIStore((s) => s.dragDropAction)

  const handleOpenFullPage = () => {
    setOpen(false)
    navigateToTrash()
  }

  useEffect(() => {
    const el = buttonRef.current
    if (!el) return

    return dropTargetForElements({
      element: el,
      getData: () => ({ type: TRASH_DROP_ZONE_TYPE }),
      onDragEnter: () => setIsDragOver(true),
      onDragLeave: () => setIsDragOver(false),
      onDrop: () => setIsDragOver(false),
    })
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            ref={buttonRef}
            className={cn(
              'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
              isDragOver &&
                dragDropAction === 'trash' &&
                'bg-destructive/10 text-destructive',
              isDragOver &&
                dragDropAction === 'move' &&
                'bg-accent text-foreground',
            )}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Trash</span>
            {trashCount > 0 && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {trashCount}
              </span>
            )}
          </button>
        }
      />
      <PopoverContent
        side="right"
        sideOffset={8}
        align="end"
        className="p-2 w-auto"
      >
        <TrashPopoverContent
          onClose={() => setOpen(false)}
          onOpenFullPage={handleOpenFullPage}
        />
      </PopoverContent>
    </Popover>
  )
}
