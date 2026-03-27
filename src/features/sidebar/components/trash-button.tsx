import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import { TrashPopoverContent } from './trash-popover-content'
import { SidebarRow } from './sidebar-row'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/features/shadcn/components/popover'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { TRASH_DROP_ZONE_TYPE } from '~/features/dnd/utils/dnd-registry'
import { cn } from '~/features/shadcn/lib/utils'

export function TrashButton() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)

  const isDragging = useDndStore((s) => s.isDraggingElement)
  useEffect(() => {
    if (isDragging) setOpen(false)
  }, [isDragging])

  const { parentItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
  const rootTrashedItems = parentItemsMap.get(null) ?? []
  const trashCount = rootTrashedItems.length

  const { isDropTarget } = useDndDropTarget({
    ref: buttonRef,
    data: { type: TRASH_DROP_ZONE_TYPE },
    highlightId: TRASH_DROP_ZONE_TYPE,
  })

  const { item, editorSearch } = useCurrentItem()
  const isTrashViewActive = editorSearch.trash === true && !item

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <SidebarRow
            ref={buttonRef}
            role="button"
            icon={Trash2}
            label="Trash"
            isActive={isTrashViewActive || open}
            className={cn(
              'cursor-pointer select-none',
              isDropTarget &&
                'ring-2 ring-inset ring-destructive/60 bg-destructive/5 text-destructive',
            )}
            rightSlot={
              trashCount > 0 ? (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                  {trashCount}
                </span>
              ) : undefined
            }
          />
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
