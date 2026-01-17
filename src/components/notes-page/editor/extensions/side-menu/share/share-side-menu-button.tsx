import { useComponentsContext } from '@blocknote/react'
import { toast } from 'sonner'
import { BLOCK_SHARE_STATUS } from 'convex/blocks/types'
import type { BlockShareStatus } from 'convex/blocks/types'
import type { CustomBlock } from '~/lib/editor-schema'
import { Share2 } from '~/lib/icons'
import { useBlockShare } from '~/hooks/useBlockShare'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '~/components/shadcn/ui/context-menu'
import { useCurrentItem } from '~/hooks/useCurrentItem'

const getButtonColorClass = (shareStatus: BlockShareStatus): string => {
  switch (shareStatus) {
    case BLOCK_SHARE_STATUS.ALL_SHARED:
      return '!text-blue-600'
    case BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED:
      return '!text-amber-500'
    case BLOCK_SHARE_STATUS.NOT_SHARED:
    default:
      return ''
  }
}

interface ShareSideMenuButtonProps {
  block: CustomBlock
  freezeMenu: () => void
  unfreezeMenu: () => void
}

export default function ShareSideMenuButton({
  block,
  freezeMenu,
  unfreezeMenu,
}: ShareSideMenuButtonProps) {
  const { item } = useCurrentItem()
  const Components = useComponentsContext()!
  const {
    blockWithSharesQuery,
    isPending,
    isMutating,
    toggleShareStatus,
    toggleShareWithMember,
    shareItems,
    shareStatus,
  } = useBlockShare(block)

  const handleButtonClick = (e: React.MouseEvent) => {
    if (!item || isMutating || isPending) return
    if (e.ctrlKey || e.metaKey) return

    if (!blockWithSharesQuery.data?.block.isTopLevel) {
      toast.error('Cannot share non-top-level blocks.')
      return
    }

    e.preventDefault()
    e.stopPropagation()
    toggleShareStatus()
  }

  const buttonColorClass = getButtonColorClass(shareStatus)

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) {
          freezeMenu()
        } else {
          unfreezeMenu()
        }
      }}
    >
      <div onClick={handleButtonClick}>
        <ContextMenuTrigger
          render={
            <Components.SideMenu.Button
              label={shareStatus}
              className={`!p-0 !px-0 !h-6 !w-6 ${buttonColorClass} ${!blockWithSharesQuery.data?.block.isTopLevel ? 'opacity-50 cursor-not-allowed' : ''}`}
              icon={<Share2 size={18} />}
            />
          }
        />
      </div>
      <ContextMenuContent className="w-56 max-h-[var(--radix-context-menu-content-available-height)] overflow-y-auto z-[9999]">
        <ContextMenuGroup>
          <ContextMenuLabel className="pb-0 pt-0.5">
            Share with
          </ContextMenuLabel>
          <ContextMenuSeparator />
          {isPending ? (
            <div className="px-2 py-2">
              <div className="text-xs text-muted-foreground">
                Block not saved yet. Add content and save first.
              </div>
            </div>
          ) : shareItems.length === 0 ? (
            <div className="px-2 py-2">
              <div className="text-xs text-muted-foreground">
                No players in this campaign yet.
              </div>
            </div>
          ) : (
            <>
              {shareItems.map((shareItem) => {
                const profile = shareItem.member.userProfile
                const displayName = profile.name || profile.username || 'Player'
                const displayText = profile.name
                  ? profile.name
                  : profile.username
                    ? `@${profile.username}`
                    : 'Player'

                return (
                  <ContextMenuCheckboxItem
                    key={shareItem.key}
                    checked={shareItem.isShared}
                    disabled={
                      isMutating || !blockWithSharesQuery.data?.block.isTopLevel
                    }
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      await toggleShareWithMember(shareItem.member._id)
                    }}
                    className="pl-2 pr-8 py-1.5 [&>span:first-child]:!left-auto [&>span:first-child]:!right-2"
                  >
                    <span className="flex min-w-0 flex-col leading-tight flex-1 pr-6">
                      <span
                        className="truncate font-medium"
                        title={displayName}
                      >
                        {displayText}
                      </span>
                      {profile.name && profile.username && (
                        <span
                          className="truncate text-xs text-muted-foreground"
                          title={`@${profile.username}`}
                        >
                          @{profile.username}
                        </span>
                      )}
                    </span>
                  </ContextMenuCheckboxItem>
                )
              })}
            </>
          )}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}
