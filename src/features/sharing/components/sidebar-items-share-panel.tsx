import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { SharePermissionMenu } from './share-permission-menu'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSidebarItemsShare } from '~/features/sharing/hooks/useSidebarItemsShare'

export function SidebarItemsSharePanel({ items }: { items: Array<AnySidebarItem> }) {
  const { campaign } = useCampaign()
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

  if (items.length === 0) return null

  return (
    <SharePermissionMenu
      title={items.length === 1 ? 'Share' : `Share ${items.length} items`}
      dmUserProfile={campaign?.data?.dmUserProfile}
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
