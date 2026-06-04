import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { SharePermissionMenu } from './share-permission-menu'
import { useSidebarItemsShare } from '~/features/sharing/hooks/useSidebarItemsShare'

export function SidebarItemsSharePanel({ items }: { items: Array<AnySidebarItem> }) {
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
      title={
        items.length === 1 ? (
          <>
            Share <span className="text-muted-foreground">"{items[0]!.name}"</span>
          </>
        ) : (
          `Share ${items.length} items`
        )
      }
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
