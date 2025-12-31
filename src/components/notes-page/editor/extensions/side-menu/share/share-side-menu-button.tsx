import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useComponentsContext } from '@blocknote/react'
import { toast } from 'sonner'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import type { CustomBlock } from '~/lib/editor-schema'
import type { Share } from 'convex/shares/types'
import type { Id } from 'convex/_generated/dataModel'
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
import { usePageLayout } from '~/hooks/usePageLayout'
import { isNote } from '~/lib/sidebar-item-utils'

interface ShareSideMenuButtonProps {
  block: CustomBlock
  freezeMenu: () => void
  unfreezeMenu: () => void
}

interface ShareItem {
  key: string
  name?: string
  username?: string
  share: Share
  applied: boolean
}

export default function ShareSideMenuButton({
  block,
  freezeMenu,
  unfreezeMenu,
}: ShareSideMenuButtonProps) {
  const { item } = useCurrentItem()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign
  const campaignId = campaign?._id
  const isPageLayout = item?.type === 'notes' || item?.type === 'tags'
  const { currentPage } = usePageLayout({
    itemId: isPageLayout ? item._id : undefined,
    itemSlug: isPageLayout ? item.slug : undefined,
    campaignId: isPageLayout ? campaignId : undefined,
  })
  const Components = useComponentsContext()!

  const blockTagState = useQuery(
    convexQuery(
      api.blocks.queries.getBlockTagState,
      isNote(currentPage)
        ? { noteId: currentPage._id, blockId: block.id }
        : 'skip',
    ),
  )

  const sharesQuery = useQuery(
    convexQuery(
      api.shares.queries.getShareTagsByCampaign,
      campaign?._id ? { campaignId: campaign._id } : 'skip',
    ),
  )

  const addShareToBlock = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.addShareBlock),
  })

  const removeShareFromBlock = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.removeShareFromBlock),
  })

  const isMutating = addShareToBlock.isPending || removeShareFromBlock.isPending

  const shares = sharesQuery.data ?? []
  const sharedAllTag = shares.find((s: Share) => s.memberId === undefined)
  const playerSharedTags = shares.filter((s: Share) => s.memberId !== undefined)

  const isBlockNotFound = blockTagState.data === null
  const appliedTagIds = useMemo(
    () => new Set<Id<'tags'>>(blockTagState.data?.allTagIds ?? []),
    [blockTagState.data?.allTagIds],
  )
  const isShared = useMemo(() => {
    if (!sharedAllTag || isBlockNotFound) return false
    if (appliedTagIds.has(sharedAllTag.tagId)) return true
    return playerSharedTags.some((share: Share) =>
      appliedTagIds.has(share.tagId),
    )
  }, [appliedTagIds, sharedAllTag, playerSharedTags, isBlockNotFound])

  const isOptimisticShared =
    (isShared && !isMutating) || (!isShared && isMutating)

  const toggleShareTag = async (share: Share) => {
    if (!isNote(currentPage) || isMutating || isBlockNotFound) return

    const isApplied = appliedTagIds.has(share.tagId)
    try {
      if (isApplied) {
        await removeShareFromBlock.mutateAsync({
          noteId: currentPage._id,
          blockId: block.id,
          shareId: share.shareId,
        })
      } else {
        await addShareToBlock.mutateAsync({
          noteId: currentPage._id,
          blockId: block.id,
          shareId: share.shareId,
        })
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to toggle share')
    }
  }

  const handleButtonClick = (e: React.MouseEvent) => {
    if (!item || isMutating) return
    if (e.ctrlKey || e.metaKey) return

    if (isBlockNotFound) {
      toast.error(
        'Sharing is not available for empty notes. Add content to access sharing.',
      )
      return
    }

    e.preventDefault()
    e.stopPropagation()
    if (sharedAllTag) {
      toggleShareTag(sharedAllTag)
    }
  }

  const shareItems: Array<ShareItem> = useMemo(() => {
    const items: Array<ShareItem> = []

    if (sharedAllTag) {
      items.push({
        key: `all-${sharedAllTag._id}`,
        name: 'All players',
        share: sharedAllTag,
        applied: appliedTagIds.has(sharedAllTag._id),
      })
    }

    playerSharedTags.forEach((share: Share) => {
      const profile = share.member?.userProfile
      items.push({
        key: `player-${share._id}`,
        name: profile?.name,
        username: profile?.username,
        share,
        applied: appliedTagIds.has(share.tagId),
      })
    })

    return items
  }, [sharedAllTag, playerSharedTags, appliedTagIds])

  if (!isPageLayout) {
    return null
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
              label={isShared ? 'Shared' : 'Share'}
              className={`!p-0 !px-0 !h-6 !w-6 ${isOptimisticShared ? '!text-blue-600' : ''} ${isBlockNotFound ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          {isBlockNotFound ? (
            <div className="px-2 py-2">
              <div className="text-xs text-muted-foreground">
                Sharing is not available for empty notes. Add content to access
                sharing.
              </div>
            </div>
          ) : (
            shareItems.map((shareItem) => {
              const displayName =
                shareItem.name || shareItem.username || 'Player'
              const displayText = shareItem.name
                ? shareItem.name
                : shareItem.username
                  ? `@${shareItem.username}`
                  : 'Player'

              return (
                <ContextMenuCheckboxItem
                  key={shareItem.key}
                  checked={shareItem.applied}
                  disabled={isMutating}
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    await toggleShareTag(shareItem.share)
                  }}
                  className="pl-2 pr-8 py-1.5 [&>span:first-child]:!left-auto [&>span:first-child]:!right-2"
                >
                  <span className="flex min-w-0 flex-col leading-tight flex-1 pr-6">
                    <span className="truncate font-medium" title={displayName}>
                      {displayText}
                    </span>
                    {shareItem.name && shareItem.username && (
                      <span
                        className="truncate text-xs text-muted-foreground"
                        title={`@${shareItem.username}`}
                      >
                        @{shareItem.username}
                      </span>
                    )}
                  </span>
                </ContextMenuCheckboxItem>
              )
            })
          )}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}
