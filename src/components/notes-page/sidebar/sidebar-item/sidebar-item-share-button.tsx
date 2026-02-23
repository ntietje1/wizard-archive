import { useMemo, useState } from 'react'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { Share2 } from '~/lib/icons'
import { Button } from '~/components/shadcn/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/shadcn/ui/popover'
import { SharePermissionMenu } from '~/components/share/share-permission-menu'
import { useSidebarItemsShare } from '~/hooks/useSidebarItemsShare'
import { useCampaign } from '~/hooks/useCampaign'

function SharePopoverContent({ item }: { item: AnySidebarItem }) {
  const { campaign } = useCampaign()
  const items = useMemo(() => [item], [item])

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
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>
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
