import { useState } from 'react'
import { Share2 } from 'lucide-react'
import type { AnyItem } from '../../../items'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@wizard-archive/ui/shadcn/components/popover'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { SidebarItemsSharePanel } from '../../../../sharing/sidebar-items/panel'
import type { SidebarShareButtonSource } from '../../sidebar-share-button-source'

export function SidebarShareButton({
  item,
  source,
  buttonClassName,
}: {
  item: AnyItem
  source: SidebarShareButtonSource
  /**
   * Optional color/state classes for the inner button. Avoid overriding size-6 or padding classes;
   * the surrounding action slot is fixed at size-6.
   */
  buttonClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [shareItems, setShareItems] = useState<Array<AnyItem>>([])
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setShareItems(source.getShareItems(item))
    }
    setOpen(nextOpen)
  }

  return (
    <div
      className="relative size-6 shrink-0 flex items-center justify-center"
      {...(open ? { 'data-share-open': '' } : {})}
    >
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          nativeButton
          render={
            <Button
              variant="ghost"
              size="sm"
              className={cn('size-6 p-0 hover:bg-item-action-hover rounded-sm', buttonClassName)}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              aria-label="Share"
            >
              <Share2 className="size-3.5" />
            </Button>
          }
        />
        <PopoverContent align="start" side="right" sideOffset={4} className="w-auto p-2">
          {open && <SidebarSharePanel items={shareItems} source={source} />}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function SidebarSharePanel({
  items,
  source,
}: {
  items: Array<AnyItem>
  source: SidebarShareButtonSource
}) {
  return source.renderItemsShareState(items, (state) => (
    <SidebarItemsSharePanel items={items} state={state} />
  ))
}
