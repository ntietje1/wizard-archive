import { useComponentsContext } from '@blocknote/react'
import { toast } from 'sonner'
import { Minus } from 'lucide-react'
import type { CustomBlock, CustomBlockNoteEditor } from '~/lib/editor-schema'
import type { AggregateShareStatus } from '~/hooks/useBlocksShare'
import { Share2 } from '~/lib/icons'
import { useBlocksShare } from '~/hooks/useBlocksShare'
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

const getButtonColorClass = (status: AggregateShareStatus): string => {
  switch (status) {
    case 'all_shared':
      return '!text-blue-600'
    case 'individually_shared':
    case 'mixed_shared':
      return '!text-amber-500'
    default:
      return ''
  }
}

interface ShareSideMenuButtonProps {
  block: CustomBlock
  editor: CustomBlockNoteEditor
  freezeMenu: () => void
  unfreezeMenu: () => void
}

export default function ShareSideMenuButton({
  block,
  editor,
  freezeMenu,
  unfreezeMenu,
}: ShareSideMenuButtonProps) {
  const { item } = useCurrentItem()
  const Components = useComponentsContext()!

  // Determine blocks to operate on: selection if hovered block is in it, otherwise just the hovered block
  const selection = editor.getSelection()
  const selectedBlocks =
    selection && selection.blocks.length > 1
      ? (selection.blocks as Array<CustomBlock>)
      : null
  const hoveredBlockInSelection =
    selectedBlocks?.some((b) => b.id === block.id) ?? false
  const blocks =
    selectedBlocks && hoveredBlockInSelection ? selectedBlocks : [block]

  const {
    isPending,
    isMutating,
    aggregateShareStatus,
    topLevelBlocks,
    hasNonTopLevelBlocks,
    shareItems,
    toggleShareStatus,
    toggleShareWithMember,
  } = useBlocksShare(blocks)

  const isMultiBlock = blocks.length > 1
  const blockCount = topLevelBlocks.length
  const skippedCount = blocks.length - topLevelBlocks.length

  const handleButtonClick = (e: React.MouseEvent) => {
    if (!item || isMutating || isPending) return
    if (e.ctrlKey || e.metaKey) return

    if (topLevelBlocks.length === 0) {
      toast.error('Cannot share non-top-level blocks.')
      return
    }

    e.preventDefault()
    e.stopPropagation()
    toggleShareStatus()
  }

  const buttonColorClass = getButtonColorClass(aggregateShareStatus)
  const isDisabled = topLevelBlocks.length === 0

  return (
    <ContextMenu
      onOpenChange={(open) => (open ? freezeMenu() : unfreezeMenu())}
    >
      <div onClick={handleButtonClick}>
        <ContextMenuTrigger
          render={
            <Components.SideMenu.Button
              label={isMultiBlock ? `Share ${blockCount} blocks` : 'Share'}
              className={`!p-0 !px-0 !h-6 !w-6 ${buttonColorClass} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              icon={<Share2 size={18} />}
            />
          }
        />
      </div>
      <ContextMenuContent className="w-56 max-h-[var(--radix-context-menu-content-available-height)] overflow-y-auto z-[9999]">
        <ContextMenuGroup>
          <ContextMenuLabel className="pb-0 pt-0.5">
            Share
            {isMultiBlock
              ? ` ${blockCount} block${blockCount !== 1 ? 's' : ''}`
              : ''}{' '}
            with
          </ContextMenuLabel>
          {hasNonTopLevelBlocks && (
            <div className="px-2 py-1">
              <div className="text-xs text-muted-foreground">
                {skippedCount} nested block{skippedCount !== 1 ? 's' : ''} will
                be skipped
              </div>
            </div>
          )}
          <ContextMenuSeparator />
          {isPending ? (
            <div className="px-2 py-2">
              <div className="text-xs text-muted-foreground">Loading...</div>
            </div>
          ) : isDisabled ? (
            <div className="px-2 py-2">
              <div className="text-xs text-muted-foreground">
                No shareable blocks.
              </div>
            </div>
          ) : shareItems.length === 0 ? (
            <div className="px-2 py-2">
              <div className="text-xs text-muted-foreground">
                No players in this campaign yet.
              </div>
            </div>
          ) : (
            shareItems.map((shareItem) => {
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
                  key={shareItem.key}
                  checked={isChecked}
                  disabled={isMutating || isDisabled}
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    await toggleShareWithMember(shareItem.member._id)
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
            })
          )}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}
