import { SideMenuExtension } from '@blocknote/core/extensions'
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useExtensionState,
} from '@blocknote/react'
import { Share2 } from 'lucide-react'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { NoteWithContent } from 'convex/notes/types'
import { AGGREGATE_SHARE_STATUS } from '~/features/sharing/utils/block-share-state'
import type { AggregateShareStatus } from '~/features/sharing/utils/block-share-state'
import { useBlocksShare } from '~/features/sharing/hooks/useBlocksShare'
import { assertNever } from '~/shared/utils/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '~/features/shadcn/components/context-menu'
import { ShareMenuContent } from '~/features/sharing/components/share-menu-content'
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

export default function ShareSideMenuButton({ note }: { note: NoteWithContent }) {
  const { isDm } = useCampaign()
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor() as CustomBlockNoteEditor
  const sideMenuExtension = useExtension(SideMenuExtension)
  const { block, blocks } = useShareTargetBlocks(editor)

  const {
    isPending,
    isMutating,
    aggregateShareStatus,
    shareItems,
    toggleShareStatus,
    toggleShareWithMember,
  } = useBlocksShare(blocks, note)

  const isMultiBlock = blocks.length > 1
  const blockCount = blocks.length
  const isBusy = isPending || isMutating

  const handleButtonClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (isBusy) return
    if (e.ctrlKey || e.metaKey) return

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
    <ContextMenu onOpenChange={(open) => setSideMenuFrozen(sideMenuExtension, open)}>
      <div role="button" tabIndex={0} onClick={handleButtonClick} onKeyDown={handleKeyDown}>
        <ContextMenuTrigger
          render={
            <Components.SideMenu.Button
              label={getShareButtonLabel(blockCount)}
              className={`!p-0 !px-0 !h-6 !w-6 ${buttonColorClass} ${isBusy ? 'opacity-50 cursor-wait' : ''}`}
              icon={<Share2 size={18} />}
            />
          }
        />
      </div>
      <ContextMenuContent className="w-56 max-h-[var(--radix-context-menu-content-available-height)] overflow-y-auto z-[9999]">
        <ShareMenuContent
          label={getShareMenuLabel(blockCount, isMultiBlock)}
          isPending={isPending}
          isMutating={isMutating}
          shareItems={shareItems}
          onToggleShareWithMember={toggleShareWithMember}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}

function useShareTargetBlocks(editor: CustomBlockNoteEditor) {
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  }) as CustomBlock | undefined

  const selectedBlocks = getSelectedBlocks(editor)
  const hoveredBlockInSelection = selectedBlocks?.some(
    (selectedBlock) => selectedBlock.id === block?.id,
  )
  const blocks = selectedBlocks && hoveredBlockInSelection ? selectedBlocks : block ? [block] : []

  return { block, blocks }
}

function getSelectedBlocks(editor: CustomBlockNoteEditor): Array<CustomBlock> | null {
  const selection = editor.getSelection()
  return selection && selection.blocks.length > 1 ? (selection.blocks as Array<CustomBlock>) : null
}

function getShareButtonLabel(blockCount: number) {
  return blockCount > 1 ? `Share ${blockCount} blocks` : 'Share'
}

function getShareMenuLabel(blockCount: number, isMultiBlock: boolean) {
  return isMultiBlock ? `Share ${blockCount} blocks with` : 'Share with'
}

function setSideMenuFrozen(sideMenuExtension: SideMenuController, open: boolean) {
  if (open) {
    sideMenuExtension.freezeMenu()
  } else {
    sideMenuExtension.unfreezeMenu()
  }
}

type SideMenuController = {
  freezeMenu: () => void
  unfreezeMenu: () => void
}
