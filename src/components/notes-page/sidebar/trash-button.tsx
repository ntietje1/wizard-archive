import { useRef, useState } from 'react'
import { TrashPopoverContent } from './trash-popover-content'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/shadcn/ui/popover'
import { useDndDropTarget } from '~/hooks/useDndDropTarget'
import { useTrashedSidebarItems } from '~/hooks/useSidebarItems'
import { TRASH_DROP_ZONE_TYPE } from '~/lib/dnd-registry'
import { cn } from '~/lib/shadcn/utils'
import { Trash2 } from '~/lib/icons'

export function TrashButton() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const { parentItemsMap } = useTrashedSidebarItems()
  const rootTrashedItems = parentItemsMap.get(null) ?? []
  const trashCount = rootTrashedItems.length

  const { isDropTarget } = useDndDropTarget({
    ref: buttonRef,
    data: { type: TRASH_DROP_ZONE_TYPE },
    highlightId: TRASH_DROP_ZONE_TYPE,
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            ref={buttonRef}
            className={cn(
              'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
              isDropTarget && 'bg-destructive/10 text-destructive',
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
        <TrashPopoverContent onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
