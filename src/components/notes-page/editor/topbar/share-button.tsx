import { useMemo } from 'react'
import type { AggregateShareStatus } from '~/hooks/useBlocksShare'
import { Share2 } from '~/lib/icons'
import { Button } from '~/components/shadcn/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/shadcn/ui/popover'
import { SharePermissionMenu } from '~/components/share/share-permission-menu'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useCampaign } from '~/hooks/useCampaign'
import { useSidebarItemsShare } from '~/hooks/useSidebarItemsShare'
import { cn } from '~/lib/shadcn/utils'
import { TooltipButton } from '~/components/tooltips/tooltip-button'

const getButtonColorClass = (status: AggregateShareStatus): string => {
  switch (status) {
    case 'all_shared':
      return 'text-blue-600 hover:text-blue-700 aria-expanded:text-blue-600'
    case 'individually_shared':
    case 'mixed_shared':
      return 'text-amber-500 hover:text-amber-600 aria-expanded:text-amber-500'
    default:
      return ''
  }
}

export function ShareButton() {
  const { itemForDm } = useCurrentItem()
  const { isDm, dmUsername } = useCampaign()

  const items = useMemo(() => (itemForDm ? [itemForDm] : []), [itemForDm])

  const {
    isPending,
    isMutating,
    aggregateShareStatus,
    allPlayersPermissionLevel,
    shareItems,
    setMemberPermission,
    setAllPlayersPermission,
    canShare,
    allFolders,
  } = useSidebarItemsShare(items)

  if (!isDm || !itemForDm) {
    return null
  }

  const buttonColorClass = getButtonColorClass(aggregateShareStatus)
  const isDisabled = !canShare || isMutating || allFolders

  const label = allFolders
    ? 'Folders are automatically shared as needed'
    : aggregateShareStatus === 'all_shared'
      ? 'Shared with all players'
      : aggregateShareStatus === 'individually_shared' ||
          aggregateShareStatus === 'mixed_shared'
        ? 'Shared with some players'
        : 'Share item'

  return (
    <TooltipButton tooltip={label} side="bottom">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              disabled={isDisabled}
              aria-label={label}
              title={label}
              className={cn(buttonColorClass)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          }
        />
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="w-auto p-2"
        >
          <SharePermissionMenu
            dmName={dmUsername}
            isPending={isPending}
            isMutating={isMutating}
            shareItems={shareItems}
            allPlayersPermissionLevel={allPlayersPermissionLevel}
            onSetMemberPermission={setMemberPermission}
            onSetAllPlayersPermission={setAllPlayersPermission}
          />
        </PopoverContent>
      </Popover>
    </TooltipButton>
  )
}
