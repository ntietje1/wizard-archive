import { useState } from 'react'
import { Share2 } from 'lucide-react'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { Button } from '~/features/shadcn/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/features/shadcn/components/popover'
import { SharePermissionMenu } from '~/features/sharing/components/share-permission-menu'
import { useSidebarItemsShare } from '~/features/sharing/hooks/useSidebarItemsShare'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { cn } from '~/features/shadcn/lib/utils'

function SharePopoverContent({ item }: { item: AnySidebarItem }) {
  const { campaign } = useCampaign()
  const items = [item]

  const {
    isPending,
    isMutating,
    shareItems,
    allPlayersPermissionLevel,
    inheritedAllPermissionLevel,
    inheritedFromFolderName,
    isFolder,
    inheritShares,
    setMemberPermission,
    clearMemberPermission,
    setAllPlayersPermission,
    setInheritShares,
  } = useSidebarItemsShare(items)

  const dmUserProfile = campaign.data?.dmUserProfile

  return (
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
  )
}

export function SidebarShareButton({
  item,
  buttonClassName,
}: {
  item: AnySidebarItem
  /**
   * Optional color/state classes for the inner button. Avoid overriding size-6 or padding classes;
   * the surrounding action slot is fixed at h-6 w-6.
   */
  buttonClassName?: string
}) {
  const { isDm } = useCampaign()
  const [open, setOpen] = useState(false)

  if (!isDm) return null

  return (
    <div
      className="relative h-6 w-6 shrink-0 flex items-center justify-center"
      {...(open ? { 'data-share-open': '' } : {})}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          nativeButton
          render={
            <Button
              variant="ghost"
              size="sm"
              className={cn('size-6 p-0 hover:bg-muted-foreground/10 rounded-sm', buttonClassName)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Share"
            >
              <Share2 className="size-3.5" />
            </Button>
          }
        />
        <PopoverContent align="start" side="right" sideOffset={4} className="w-auto p-2">
          {open && <SharePopoverContent item={item} />}
        </PopoverContent>
      </Popover>
    </div>
  )
}
