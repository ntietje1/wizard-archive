import { Minus } from 'lucide-react'
import type { ShareItem } from '~/hooks/useBlocksShare'
import type { Id } from 'convex/_generated/dataModel'
import {
  ContextMenuCheckboxItem,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuSeparator,
} from '~/components/shadcn/ui/context-menu'

interface ShareMenuContentProps {
  /**
   * Label to show at the top of the menu.
   * For multi-select, could be "Share 3 items with" etc.
   */
  label?: string
  /**
   * Whether the share data is still loading
   */
  isPending: boolean
  /**
   * Whether a mutation is in progress
   */
  isMutating: boolean
  /**
   * Whether sharing is disabled
   */
  isDisabled: boolean
  /**
   * List of players with their share states.
   * Uses ShareItem from useBlocksShare - same structure for both blocks and sidebar items.
   */
  shareItems: Array<ShareItem>
  /**
   * Callback when toggling share for a specific member
   */
  onToggleShareWithMember: (memberId: Id<'campaignMembers'>) => Promise<void>
  /**
   * Optional message to show when there are unshareable items in the selection
   * (e.g., folders or nested blocks)
   */
  unsharableMessage?: string
}

/**
 * Shared menu content for displaying player share options.
 * Used by the topbar share button and can be adapted for context menus.
 * Designed to support multi-select scenarios with aggregate share states.
 */
export function ShareMenuContent({
  label = 'Share with',
  isPending,
  isMutating,
  isDisabled,
  shareItems,
  onToggleShareWithMember,
  unsharableMessage,
}: ShareMenuContentProps) {
  return (
    <ContextMenuGroup>
      <ContextMenuLabel className="pb-0 pt-0.5">{label}</ContextMenuLabel>
      {unsharableMessage && (
        <div className="px-2 py-1">
          <div className="text-xs text-muted-foreground">
            {unsharableMessage}
          </div>
        </div>
      )}
      <ContextMenuSeparator />
      {isPending ? (
        <div className="px-2 py-2">
          <div className="text-xs text-muted-foreground">Loading...</div>
        </div>
      ) : shareItems.length === 0 ? (
        <div className="px-2 py-2">
          <div className="text-xs text-muted-foreground">
            No players in this campaign yet.
          </div>
        </div>
      ) : (
        shareItems.map((shareItem) => (
          <ShareMenuItem
            key={shareItem.key}
            shareItem={shareItem}
            isMutating={isMutating}
            isDisabled={isDisabled}
            onToggle={onToggleShareWithMember}
          />
        ))
      )}
    </ContextMenuGroup>
  )
}

interface ShareMenuItemProps {
  shareItem: ShareItem
  isMutating: boolean
  isDisabled: boolean
  onToggle: (memberId: Id<'campaignMembers'>) => Promise<void>
}

function ShareMenuItem({
  shareItem,
  isMutating,
  isDisabled,
  onToggle,
}: ShareMenuItemProps) {
  const profile = shareItem.member.userProfile
  const displayText = profile.name
    ? profile.name
    : profile.username
      ? `@${profile.username}`
      : 'Player'
  const isChecked = shareItem.shareState === 'all'
  const isIndeterminate = shareItem.shareState === 'some'

  return (
    <ContextMenuCheckboxItem
      checked={isChecked}
      disabled={isMutating || isDisabled}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        await onToggle(shareItem.member._id)
      }}
      className="pl-2 pr-8 py-1.5 [&>span:first-child]:!left-auto [&>span:first-child]:!right-2"
    >
      <span className="flex min-w-0 flex-col leading-tight flex-1 pr-6">
        <span className="truncate font-medium">{displayText}</span>
        {profile.name && profile.username && (
          <span className="truncate text-xs text-muted-foreground">
            @{profile.username}
          </span>
        )}
      </span>
      {isIndeterminate && (
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
          <Minus className="h-3 w-3" />
        </span>
      )}
    </ContextMenuCheckboxItem>
  )
}
