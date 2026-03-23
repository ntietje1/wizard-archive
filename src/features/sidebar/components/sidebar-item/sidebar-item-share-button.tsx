import { useState } from 'react'
import { Share2 } from 'lucide-react'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { buttonVariants } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/features/shadcn/components/popover'
import { SharePermissionMenu } from '~/features/sharing/components/share-permission-menu'
import { useSidebarItemsShare } from '~/features/sharing/hooks/useSidebarItemsShare'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

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

export function SidebarShareButton({ item }: { item: AnySidebarItem }) {
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
          render={
            <button
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm',
              )}
              onClick={(e) => e.stopPropagation()}
              aria-label="Share"
              type="button"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          }
        />
        <PopoverContent
          align="start"
          side="right"
          sideOffset={4}
          className="w-auto p-2"
        >
          {open && <SharePopoverContent item={item} />}
        </PopoverContent>
      </Popover>
    </div>
  )
}
