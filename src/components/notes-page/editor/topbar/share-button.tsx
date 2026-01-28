import { useMemo } from 'react'
import type { AggregateShareStatus } from '~/hooks/useBlocksShare'
import { Share2 } from '~/lib/icons'
import { Button } from '~/components/shadcn/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '~/components/shadcn/ui/context-menu'
import { ShareMenuContent } from '~/components/share/share-menu-content'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useCampaign } from '~/hooks/useCampaign'
import { useSidebarItemsShare } from '~/hooks/useSidebarItemsShare'
import { cn } from '~/lib/shadcn/utils'
import { EmptyContextMenu } from '~/components/context-menu/components/EmptyContextMenu'
import { TooltipButton } from '~/components/tooltips/tooltip-button'

const getButtonColorClass = (status: AggregateShareStatus): string => {
  switch (status) {
    case 'all_shared':
      return 'text-blue-600 hover:text-blue-700 aria-expanded:text-blue-600'
    case 'individually_shared':
    case 'mixed_shared':
      return 'text-amber-500 hover:text-amber-600 aria-expanded:text-amber-500'
    default:
      return ''
  }
}

export function ShareButton() {
  const { itemForDm } = useCurrentItem()
  const { isDm } = useCampaign()

  const items = useMemo(() => (itemForDm ? [itemForDm] : []), [itemForDm])

  const {
    isPending,
    isMutating,
    aggregateShareStatus,
    shareItems,
    toggleShareStatus,
    toggleShareWithMember,
    canShare,
    allFolders,
  } = useSidebarItemsShare(items)

  if (!isDm || !itemForDm) {
    return null
  }

  const buttonColorClass = getButtonColorClass(aggregateShareStatus)
  const isDisabled = !canShare || isMutating || allFolders

  const label = allFolders
    ? 'Folders are automatically shared as needed'
    : aggregateShareStatus === 'all_shared'
      ? 'Unshare item'
      : 'Share item'

  const handleClick = () => {
    if (isDisabled || isPending) return
    toggleShareStatus()
  }

  return (
    <EmptyContextMenu>
      <TooltipButton tooltip={label} side="bottom">
        <ContextMenu>
          <ContextMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                disabled={isDisabled}
                aria-label={label}
                title={label}
                className={cn(buttonColorClass)}
                onClick={handleClick}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            }
          />
          <ContextMenuContent
            className="w-56 max-h-[var(--radix-context-menu-content-available-height)] overflow-y-auto z-[9999]"
            side="bottom"
            align="start"
          >
            <ShareMenuContent
              isPending={isPending}
              isMutating={isMutating}
              isDisabled={isDisabled}
              shareItems={shareItems}
              onToggleShareWithMember={toggleShareWithMember}
            />
          </ContextMenuContent>
        </ContextMenu>
      </TooltipButton>
    </EmptyContextMenu>
  )
}
