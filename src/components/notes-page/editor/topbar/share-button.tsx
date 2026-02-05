import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Lock, Users } from '~/lib/icons'
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

export function ShareButton() {
  const { itemForDm } = useCurrentItem()
  const { isDm, campaignWithMembership } = useCampaign()
  const [open, setOpen] = useState(false)

  const items = useMemo(() => (itemForDm ? [itemForDm] : []), [itemForDm])

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

  if (!isDm || !itemForDm) {
    return null
  }

  const dmUserProfile = campaignWithMembership.data?.campaign.dmUserProfile
  const isDisabled = !canShare || isMutating
  const isShared = aggregateShareStatus !== 'not_shared'

  const Chevron = open ? ChevronUp : ChevronDown
  const StatusIcon = isShared ? Users : Lock

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={isDisabled}
            className="gap-1.5"
          >
            <StatusIcon className="h-3.5 w-3.5" />
            <span className="text-xs">{isShared ? 'Shared' : 'Private'}</span>
            <Chevron className="h-3 w-3 text-muted-foreground" />
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
    </Popover>
  )
}
