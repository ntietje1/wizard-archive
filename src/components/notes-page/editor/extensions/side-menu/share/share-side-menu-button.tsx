import { SideMenuExtension } from '@blocknote/core/extensions'
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useExtensionState,
} from '@blocknote/react'
import { toast } from 'sonner'
import type {
  CustomBlock,
  CustomBlockNoteEditor,
} from 'convex/notes/editorSpecs'
import type { AggregateShareStatus } from '~/hooks/useBlocksShare'
import { Share2 } from '~/lib/icons'
import { AGGREGATE_SHARE_STATUS, useBlocksShare } from '~/hooks/useBlocksShare'
import { assertNever } from '~/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '~/components/shadcn/ui/context-menu'
import { ShareMenuContent } from '~/components/share/share-menu-content'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useCampaign } from '~/hooks/useCampaign'

const getButtonColorClass = (status: AggregateShareStatus): string => {
  switch (status) {
    case AGGREGATE_SHARE_STATUS.ALL_SHARED:
      return '!text-blue-600'
    case AGGREGATE_SHARE_STATUS.INDIVIDUALLY_SHARED:
    case AGGREGATE_SHARE_STATUS.MIXED_SHARED:
      return '!text-amber-500'
    case AGGREGATE_SHARE_STATUS.NOT_SHARED:
      return '!text-gray-500'
    default:
      return assertNever(status)
  }
}

export default function ShareSideMenuButton() {
  const { isDm } = useCampaign()
  const { item } = useCurrentItem()
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor() as CustomBlockNoteEditor
  const sideMenuExtension = useExtension(SideMenuExtension)
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  }) as CustomBlock | undefined

  // Determine blocks to operate on: selection if hovered block is in it, otherwise just the hovered block
  const selection = editor.getSelection()
  const selectedBlocks =
    selection && selection.blocks.length > 1
      ? (selection.blocks as Array<CustomBlock>)
      : null
  const hoveredBlockInSelection =
    (block && selectedBlocks?.some((b) => b.id === block.id)) ?? false
  const blocks: Array<CustomBlock> =
    selectedBlocks && hoveredBlockInSelection
      ? selectedBlocks
      : block
        ? [block]
        : []

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

  if (!block || !isDm) return null

  return (
    <ContextMenu
      onOpenChange={(open) =>
        open ? sideMenuExtension.freezeMenu() : sideMenuExtension.unfreezeMenu()
      }
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
        <ShareMenuContent
          label={
            isMultiBlock
              ? `Share ${blockCount} block${blockCount !== 1 ? 's' : ''} with`
              : 'Share with'
          }
          isPending={isPending}
          isMutating={isMutating}
          isDisabled={isDisabled}
          shareItems={shareItems}
          onToggleShareWithMember={toggleShareWithMember}
          unsharableMessage={
            hasNonTopLevelBlocks
              ? `${skippedCount} nested block${skippedCount !== 1 ? 's' : ''} will be skipped`
              : isDisabled && !isPending
                ? 'No shareable blocks.'
                : undefined
          }
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}
