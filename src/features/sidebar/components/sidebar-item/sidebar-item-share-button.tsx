import { useState } from 'react'
import { Share2 } from 'lucide-react'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { Button } from '~/features/shadcn/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/features/shadcn/components/popover'
import { SidebarItemsSharePanel } from '~/features/sharing/components/sidebar-items-share-panel'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { cn } from '~/features/shadcn/lib/utils'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { resolveClickedSidebarOperationItems } from '~/features/filesystem/filesystem-operation-selection'
import { useFileSystemReadModel } from '~/features/filesystem/useFileSystemReadModel'

export function SidebarShareButton({
  item,
  buttonClassName,
}: {
  item: AnySidebarItem
  /**
   * Optional color/state classes for the inner button. Avoid overriding size-6 or padding classes;
   * the surrounding action slot is fixed at size-6.
   */
  buttonClassName?: string
}) {
  const { isDm } = useCampaign()

  if (!isDm) return null

  return <SidebarShareButtonPopover item={item} buttonClassName={buttonClassName} />
}

function SidebarShareButtonPopover({
  item,
  buttonClassName,
}: {
  item: AnySidebarItem
  buttonClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const filesystemReadModel = useFileSystemReadModel()
  const shareItems = resolveClickedSidebarOperationItems({
    item,
    selectedItemIds,
    activeItemsMap: filesystemReadModel.activeItemsById,
    trashedItemsMap: filesystemReadModel.trashedItemsById,
    canUseItemSelection: true,
  })

  return (
    <div
      className="relative size-6 shrink-0 flex items-center justify-center"
      {...(open ? { 'data-share-open': '' } : {})}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          nativeButton
          render={
            <Button
              variant="ghost"
              size="sm"
              className={cn('size-6 p-0 hover:bg-item-action-hover rounded-sm', buttonClassName)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Share"
            >
              <Share2 className="size-3.5" />
            </Button>
          }
        />
        <PopoverContent align="start" side="right" sideOffset={4} className="w-auto p-2">
          {open && <SidebarItemsSharePanel items={shareItems} />}
        </PopoverContent>
      </Popover>
    </div>
  )
}
