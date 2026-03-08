import { useRef, useState } from 'react'
import { TrashPopoverContent } from './trash-popover-content'
import { SidebarRow } from './sidebar-row'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/shadcn/ui/popover'
import { useDndDropTarget } from '~/hooks/useDndDropTarget'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useTrashedSidebarItems } from '~/hooks/useSidebarItems'
import { TRASH_DROP_ZONE_TYPE } from '~/lib/dnd-registry'
import { cn } from '~/lib/shadcn/utils'
import { Trash2 } from '~/lib/icons'

export function TrashButton() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)

  const { parentItemsMap } = useTrashedSidebarItems()
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
              'cursor-pointer',
              isDropTarget &&
                'ring-2 ring-inset ring-destructive/60 bg-destructive/5 text-destructive',
            )}
            rightSlot={
              trashCount > 0 ? (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
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
