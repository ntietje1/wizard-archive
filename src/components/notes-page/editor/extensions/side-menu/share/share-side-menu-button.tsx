import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useComponentsContext } from '@blocknote/react'
import { toast } from 'sonner'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { BLOCK_SHARE_STATUS } from 'convex/blocks/types'
import type { CustomBlock } from '~/lib/editor-schema'
import type { Id } from 'convex/_generated/dataModel'
import type { CampaignMember } from 'convex/campaigns/types'
import type { BlockShareStatus } from 'convex/blocks/types'
import { Share2 } from '~/lib/icons'
import { useCampaign } from '~/hooks/useCampaign'
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
import { isNote } from '~/lib/sidebar-item-utils'

interface ShareSideMenuButtonProps {
  block: CustomBlock
  freezeMenu: () => void
  unfreezeMenu: () => void
}

interface ShareItem {
  key: string
  member: CampaignMember
  isShared: boolean
}

export default function ShareSideMenuButton({
  block,
  freezeMenu,
  unfreezeMenu,
}: ShareSideMenuButtonProps) {
  const { item } = useCurrentItem()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign
  const isPageLayout = item?.type === 'notes'
  const Components = useComponentsContext()!

  // Single query that returns block, shareStatus, shares (if individually_shared), and player members
  const blockWithSharesQuery = useQuery(
    convexQuery(
      api.blocks.queries.getBlockWithShares,
      isNote(item) ? { noteId: item._id, blockId: block.id } : 'skip',
    ),
  )

  // Mutation for setting share status (left-click toggle)
  const setBlockShareStatus = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.setBlockShareStatus),
  })

  // Mutations for individual sharing (right-click menu)
  const shareBlock = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.shareBlock),
  })

  const unshareBlock = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.unshareBlock),
  })

  const isMutating =
    setBlockShareStatus.isPending ||
    shareBlock.isPending ||
    unshareBlock.isPending

  // Extract data from the combined query
  const blockData = blockWithSharesQuery.data

  // Get share status (default to 'not_shared' for legacy blocks)
  const shareStatus: BlockShareStatus =
    blockData?.shareStatus ?? BLOCK_SHARE_STATUS.NOT_SHARED

  const playerMembers: Array<CampaignMember> = useMemo(
    () => blockData?.playerMembers ?? [],
    [blockData?.playerMembers],
  )

  // For individually_shared blocks, we need to check the shares array
  const sharedMemberIds: Set<Id<'campaignMembers'>> = useMemo(() => {
    if (shareStatus !== BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED) {
      return new Set<Id<'campaignMembers'>>()
    }
    const shares = blockData?.shares ?? []
    return new Set<Id<'campaignMembers'>>(shares.map((s) => s.campaignMemberId))
  }, [blockData?.shares, shareStatus])

  // Block is available if the query returned data (block exists in DB)
  const isBlockAvailable = blockData !== null && blockData !== undefined

  // Determine if a member has access based on shareStatus
  const memberHasAccess = (memberId: Id<'campaignMembers'>): boolean => {
    switch (shareStatus) {
      case BLOCK_SHARE_STATUS.ALL_SHARED:
        return true
      case BLOCK_SHARE_STATUS.NOT_SHARED:
        return false
      case BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED:
        return sharedMemberIds.has(memberId)
      default:
        return false
    }
  }

  // Toggle individual share (right-click menu)
  const toggleShareWithMember = async (memberId: Id<'campaignMembers'>) => {
    if (!campaign?._id || !isNote(item) || isMutating || !blockData) return

    const blockId = blockData.block._id
    const isCurrentlyShared = memberHasAccess(memberId)

    try {
      if (isCurrentlyShared) {
        await unshareBlock.mutateAsync({
          campaignId: campaign._id,
          blockId,
          campaignMemberId: memberId,
        })
      } else {
        await shareBlock.mutateAsync({
          campaignId: campaign._id,
          blockId,
          campaignMemberId: memberId,
        })
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to toggle share')
    }
  }

  // Toggle share status (left-click)
  // all_shared -> not_shared
  // not_shared -> all_shared
  // individually_shared -> not_shared
  const toggleShareStatus = async () => {
    if (!campaign?._id || !isNote(item) || isMutating || !blockData) return

    const blockId = blockData.block._id

    let newStatus: BlockShareStatus
    switch (shareStatus) {
      case BLOCK_SHARE_STATUS.ALL_SHARED:
        newStatus = BLOCK_SHARE_STATUS.NOT_SHARED
        break
      case BLOCK_SHARE_STATUS.NOT_SHARED:
        newStatus = BLOCK_SHARE_STATUS.ALL_SHARED
        break
      case BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED:
        newStatus = BLOCK_SHARE_STATUS.NOT_SHARED
        break
      default:
        newStatus = BLOCK_SHARE_STATUS.ALL_SHARED
    }

    try {
      await setBlockShareStatus.mutateAsync({
        campaignId: campaign._id,
        blockId,
        status: newStatus,
      })
    } catch (error) {
      console.error(error)
      toast.error('Failed to toggle share')
    }
  }

  const handleButtonClick = (e: React.MouseEvent) => {
    if (!item || isMutating) return
    if (e.ctrlKey || e.metaKey) return

    if (!isBlockAvailable) {
      toast.error('Block not saved yet. Add content and save first.')
      return
    }

    e.preventDefault()
    e.stopPropagation()
    toggleShareStatus()
  }

  const shareItems: Array<ShareItem> = useMemo(() => {
    return playerMembers.map((member: CampaignMember) => {
      // Inline memberHasAccess logic to avoid lint warning
      let isShared: boolean
      switch (shareStatus) {
        case BLOCK_SHARE_STATUS.ALL_SHARED:
          isShared = true
          break
        case BLOCK_SHARE_STATUS.NOT_SHARED:
          isShared = false
          break
        case BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED:
          isShared = sharedMemberIds.has(member._id)
          break
        default:
          isShared = false
      }
      return {
        key: `player-${member._id}`,
        member,
        isShared,
      }
    })
  }, [playerMembers, shareStatus, sharedMemberIds])

  if (!isPageLayout) {
    return null
  }

  // Visual state classes based on shareStatus
  const getButtonColorClass = (): string => {
    if (!isBlockAvailable) return 'opacity-50 cursor-not-allowed'

    switch (shareStatus) {
      case BLOCK_SHARE_STATUS.ALL_SHARED:
        return '!text-blue-600' // Blue for fully shared
      case BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED:
        return '!text-amber-500' // Amber/orange for partially shared
      case BLOCK_SHARE_STATUS.NOT_SHARED:
      default:
        return '' // Default color for not shared
    }
  }

  // Label based on shareStatus
  const getButtonLabel = (): string => {
    switch (shareStatus) {
      case BLOCK_SHARE_STATUS.ALL_SHARED:
        return 'Shared'
      case BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED:
        return 'Partial'
      case BLOCK_SHARE_STATUS.NOT_SHARED:
      default:
        return 'Share'
    }
  }

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
              label={getButtonLabel()}
              className={`!p-0 !px-0 !h-6 !w-6 ${getButtonColorClass()}`}
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
          {!isBlockAvailable ? (
            <div className="px-2 py-2">
              <div className="text-xs text-muted-foreground">
                Block not saved yet. Add content and save first.
              </div>
            </div>
          ) : playerMembers.length === 0 ? (
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
                    disabled={isMutating}
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
