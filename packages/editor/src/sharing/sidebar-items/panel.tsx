import type { AnyItem } from '../../workspace/items'
import type { ResourceShareState } from '../contracts'
import { SharePermissionMenu } from './permission-menu'

type ShareMenuStatus = Parameters<typeof SharePermissionMenu>[0]['status']

export function SidebarItemsSharePanel({
  items,
  state,
}: {
  items: Array<AnyItem>
  state: ResourceShareState
}) {
  const {
    isMutating,
    status,
    shareItems,
    defaultPermissionLevel,
    inheritedAllPermissionLevel,
    inheritedFromFolderName,
    isFolderItem,
    inheritShares,
  } = state
  const menuStatus = getShareMenuStatus(status, isMutating)
  const canMutate = status === 'ready'

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
      status={menuStatus}
      shareItems={shareItems}
      defaultPermissionLevel={defaultPermissionLevel}
      inheritedAllPermissionLevel={inheritedAllPermissionLevel}
      inheritedFromFolderName={inheritedFromFolderName}
      folder={
        canMutate && isFolderItem
          ? {
              inheritShares,
              onSetInheritShares: state.setInheritShares,
            }
          : undefined
      }
      onSetParticipantPermission={canMutate ? state.setParticipantPermission : undefined}
      onClearParticipantPermission={canMutate ? state.clearParticipantPermission : undefined}
      onSetDefaultPermission={canMutate ? state.setDefaultPermission : undefined}
    />
  )
}

function getShareMenuStatus(
  status: ResourceShareState['status'],
  isMutating: boolean,
): ShareMenuStatus {
  switch (status) {
    case 'ready':
      return isMutating ? 'mutating' : 'ready'
    case 'unavailable':
      return 'unavailable'
    case 'loading':
      return 'pending'
    case 'incomplete':
      return 'incomplete'
    case 'failed':
      return 'failed'
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}
