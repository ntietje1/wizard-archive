import { SideMenuExtension } from '@blocknote/core/extensions'
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useExtensionState,
} from '@blocknote/react'
import { Share2 } from 'lucide-react'
import type { CustomBlock, CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { AggregateShareStatus } from '~/features/sharing/hooks/useBlocksShare'
import { AGGREGATE_SHARE_STATUS, useBlocksShare } from '~/features/sharing/hooks/useBlocksShare'
import { assertNever } from '~/shared/utils/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '~/features/shadcn/components/context-menu'
import { ShareMenuContent } from '~/features/sharing/components/share-menu-content'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

const getButtonColorClass = (status: AggregateShareStatus): string => {
  switch (status) {
    case AGGREGATE_SHARE_STATUS.ALL_SHARED:
      return '!text-primary'
    case AGGREGATE_SHARE_STATUS.INDIVIDUALLY_SHARED:
    case AGGREGATE_SHARE_STATUS.MIXED_SHARED:
      return '!text-primary'
    case AGGREGATE_SHARE_STATUS.NOT_SHARED:
      return '!text-muted-foreground'
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

  const selection = editor.getSelection()
  const selectedBlocks =
    selection && selection.blocks.length > 1 ? (selection.blocks as Array<CustomBlock>) : null
  const hoveredBlockInSelection = (block && selectedBlocks?.some((b) => b.id === block.id)) ?? false
  const blocks: Array<CustomBlock> =
    selectedBlocks && hoveredBlockInSelection ? selectedBlocks : block ? [block] : []

  const {
    isPending,
    isMutating,
    aggregateShareStatus,
    shareItems,
    toggleShareStatus,
    toggleShareWithMember,
  } = useBlocksShare(blocks)

  const isMultiBlock = blocks.length > 1
  const blockCount = blocks.length

  const handleButtonClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (!item || isMutating || isPending) return
    if (e.ctrlKey || e.metaKey) return

    if (blocks.length === 0) return

    e.preventDefault()
    e.stopPropagation()
    void toggleShareStatus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleButtonClick(e)
    }
  }

  const buttonColorClass = getButtonColorClass(aggregateShareStatus)

  if (!block || !isDm) return null

  return (
    <ContextMenu
      onOpenChange={(open) =>
        open ? sideMenuExtension.freezeMenu() : sideMenuExtension.unfreezeMenu()
      }
    >
      <div role="button" tabIndex={0} onClick={handleButtonClick} onKeyDown={handleKeyDown}>
        <ContextMenuTrigger
          render={
            <Components.SideMenu.Button
              label={isMultiBlock ? `Share ${blockCount} blocks` : 'Share'}
              className={`!p-0 !px-0 !h-6 !w-6 ${buttonColorClass}`}
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
          shareItems={shareItems}
          onToggleShareWithMember={toggleShareWithMember}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}
