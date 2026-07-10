import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { TrashPopoverContent } from './trash-popover-content'
import { SidebarRow } from './sidebar-row'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@wizard-archive/ui/shadcn/components/popover'
import { useDndDropTarget } from '../../../drag-drop/use-drop-target'
import { useDndStoreApi } from '../../../drag-drop/store'
import { TRASH_DROP_ZONE_TYPE } from '../../../drag-drop/drop-target-data'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { dropTargetChromeClass } from '@wizard-archive/ui/drag-drop/drop-target-visual-state'
import type { TrashSource } from '../../../filesystem/trash/source'
import type { TrashPopoverContentSource } from './trash-popover-content'

type TrashButtonSource = TrashPopoverContentSource &
  Pick<TrashSource, 'getItemCount' | 'isTrashActive'>

export function TrashButton({ source }: { source: TrashButtonSource }) {
  const [open, setOpen] = useState(false)
  const dndStore = useDndStoreApi()

  useEffect(() => {
    return dndStore.subscribe((state) => {
      if (state.isDraggingElement) setOpen(false)
    })
  }, [dndStore])

  const trashCount = source.getItemCount()

  const { dropTargetRef, isDropTarget } = useDndDropTarget({
    data: { type: TRASH_DROP_ZONE_TYPE },
  })

  const isTrashViewActive = source.isTrashActive()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <SidebarRow
            ref={dropTargetRef}
            role="button"
            icon={Trash2}
            label="Trash"
            isActive={isTrashViewActive || open}
            className={cn(
              'cursor-pointer select-none',
              isDropTarget && `${dropTargetChromeClass('destructive')} text-destructive`,
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
      <PopoverContent side="right" sideOffset={8} align="end" className="p-2 w-auto">
        <TrashPopoverContent source={source} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
