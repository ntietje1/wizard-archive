import { useState } from 'react'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import { ChevronDown, ChevronUp, Lock, Users } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/features/shadcn/components/popover'
import { SidebarItemsSharePanel } from '~/features/sharing/components/sidebar-items-share-panel'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSidebarItemsShare } from '~/features/sharing/hooks/useSidebarItemsShare'

export function ShareButton() {
  const { item, isLoading: isItemLoading } = useCurrentItem()
  const { isDm } = useCampaign()
  const [open, setOpen] = useState(false)

  const items = item ? [item] : []

  const { isPending, isMutating, aggregateShareStatus, canShare } = useSidebarItemsShare(items)

  if (!isDm) {
    return null
  }

  const isItemTrashed = item?.location === SIDEBAR_ITEM_LOCATION.trash
  const isDisabled = isItemLoading || !item || isItemTrashed || !canShare || isMutating || isPending
  const isShared = Boolean(item && aggregateShareStatus && aggregateShareStatus !== 'not_shared')
  const hasShareData = Boolean(item)

  const Chevron = open ? ChevronUp : ChevronDown
  const StatusIcon = isShared ? Users : Lock
  const label = isShared ? 'Shared' : 'Private'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton
        disabled={isDisabled}
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <StatusIcon className="size-3.5" />
            <span className="text-xs">{label}</span>
            <Chevron className="size-3 text-muted-foreground" />
          </Button>
        }
      />
      {hasShareData && (
        <PopoverContent align="start" side="bottom" sideOffset={4} className="w-auto p-2">
          <SidebarItemsSharePanel items={items} />
        </PopoverContent>
      )}
    </Popover>
  )
}
