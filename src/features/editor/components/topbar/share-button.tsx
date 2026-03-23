import { useState } from 'react'
import { ChevronDown, ChevronUp, Lock, Users } from 'lucide-react'
import { buttonVariants } from '~/features/shadcn/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/features/shadcn/components/popover'
import { SharePermissionMenu } from '~/features/sharing/components/share-permission-menu'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSidebarItemsShare } from '~/features/sharing/hooks/useSidebarItemsShare'
import { cn } from '~/features/shadcn/lib/utils'

export function ShareButton() {
  const { item, isLoading: isItemLoading } = useCurrentItem()
  const { isDm, campaign } = useCampaign()
  const [open, setOpen] = useState(false)

  const items = item ? [item] : []

  const {
    isPending,
    isMutating,
    aggregateShareStatus,
    allPlayersPermissionLevel,
    inheritedAllPermissionLevel,
    inheritedFromFolderName,
    isFolder,
    inheritShares,
    shareItems,
    setMemberPermission,
    clearMemberPermission,
    setAllPlayersPermission,
    setInheritShares,
    canShare,
  } = useSidebarItemsShare(items)

  if (!isDm) {
    return null
  }

  const dmUserProfile = campaign.data?.dmUserProfile
  const isItemTrashed = !!item?.deletionTime
  const isDisabled =
    isItemLoading ||
    !item ||
    isItemTrashed ||
    !canShare ||
    isMutating ||
    isPending
  const isShared = item && aggregateShareStatus !== 'not_shared'
  const hasShareData = Boolean(item)

  const Chevron = open ? ChevronUp : ChevronDown
  const StatusIcon = isShared ? Users : Lock
  const label = isShared ? 'Shared' : 'Private'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={isDisabled}
        render={
          <button
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'gap-1.5',
            )}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            <span className="text-xs">{label}</span>
            <Chevron className="h-3 w-3 text-muted-foreground" />
          </button>
        }
      />
      {hasShareData && (
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="w-auto p-2"
        >
          <SharePermissionMenu
            dmUserProfile={dmUserProfile}
            isPending={isPending}
            isMutating={isMutating}
            shareItems={shareItems}
            allPlayersPermissionLevel={allPlayersPermissionLevel}
            inheritedAllPermissionLevel={inheritedAllPermissionLevel}
            inheritedFromFolderName={inheritedFromFolderName}
            isFolder={isFolder}
            inheritShares={inheritShares}
            onSetMemberPermission={setMemberPermission}
            onClearMemberPermission={clearMemberPermission}
            onSetAllPlayersPermission={setAllPlayersPermission}
            onSetInheritShares={setInheritShares}
          />
        </PopoverContent>
      )}
    </Popover>
  )
}
