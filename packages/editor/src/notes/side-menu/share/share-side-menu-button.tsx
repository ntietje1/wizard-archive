import { SideMenuExtension } from '@blocknote/core/extensions'
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useExtensionState,
} from '@blocknote/react'
import { use } from 'react'
import { Share2 } from 'lucide-react'
import type { NoteBlock } from '../../document/model'
import type { NoteItemWithContent } from '../../../notes/item-contract'
import type { CustomBlockNoteEditor } from '../../editor-schema'
import {
  getBlockShareButtonLabel,
  getBlockShareTargetBlocks,
  getBlockShareTitle,
} from '../../sharing/block-share-targets'
import { openNoteBlockContextMenuFromEvent } from '../../context-menu/open-note-block-context-menu-from-event'
import { BlockNoteContextMenuContext } from '../../context-menu/blocknote-context-menu'
import type { BlocksShareSource } from '../../../sharing/contracts'
import { useBlockShareMenu } from '../../../sharing/block/use-menu'
import { useBlocksShare } from '../../../sharing/block/use-share'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@wizard-archive/ui/shadcn/components/tooltip'
import { AGGREGATE_SHARE_STATUS } from '../../../sharing/share-state'
import type { AggregateShareStatus } from '../../../sharing/share-state'

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

function assertNever(value: never): never {
  throw new Error(`Unsupported share status: ${String(value)}`)
}

export default function ShareSideMenuButton({
  blockSharing,
  note,
  tooltipDisabled,
}: {
  blockSharing: BlocksShareSource
  note: NoteItemWithContent
  tooltipDisabled: boolean
}) {
  if (blockSharing.status !== 'available') return null

  return (
    <AvailableShareSideMenuButton
      blockSharing={blockSharing}
      note={note}
      tooltipDisabled={tooltipDisabled}
    />
  )
}

function AvailableShareSideMenuButton({
  blockSharing,
  note,
  tooltipDisabled,
}: {
  blockSharing: Extract<BlocksShareSource, { status: 'available' }>
  note: NoteItemWithContent
  tooltipDisabled: boolean
}) {
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor() as CustomBlockNoteEditor
  const sideMenuExtension = useExtension(SideMenuExtension)
  const blockShareMenu = useBlockShareMenu()
  const contextMenu = use(BlockNoteContextMenuContext)
  const { block, blocks } = useShareTargetBlocks(editor)

  const blockShare = useBlocksShare(blockSharing, blocks, note)
  if (blockShare.status !== 'available') return null
  if (blockShare.state.status !== 'ready') return null

  const { isMutating, aggregateShareStatus, setDefaultPermission } = blockShare.state

  const blockCount = blocks.length
  const isBusy = isMutating

  const handleButtonClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (isBusy) return
    if (e.ctrlKey || e.metaKey) return

    e.preventDefault()
    e.stopPropagation()

    if (e.shiftKey) {
      void setDefaultPermission('visible')
      return
    }

    openShareMenu(getEventPosition(e))
  }

  const buttonColorClass = getButtonColorClass(aggregateShareStatus)

  if (!block) return null

  function openShareMenu(position: { x: number; y: number }) {
    if (isBusy) return
    blockShareMenu.open({
      blocks,
      note,
      position,
      sideMenuController: sideMenuExtension,
      title: getBlockShareTitle(blockCount),
    })
  }

  function handleContextMenu(e: React.MouseEvent<HTMLElement>) {
    if (!contextMenu) return
    openNoteBlockContextMenuFromEvent({
      event: e,
      note,
      noteBlockId: block?.id,
      openMenu: contextMenu.openMenu,
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key !== 'ContextMenu' && !(e.shiftKey && e.key === 'F10')) return
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    openShareMenu({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }

  return (
    <Tooltip disabled={tooltipDisabled}>
      <TooltipTrigger
        render={(triggerProps) => (
          <span
            {...triggerProps}
            className="inline-flex"
            role="presentation"
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
          >
            <Components.SideMenu.Button
              label={getBlockShareButtonLabel(blockCount)}
              className={`!p-0 !px-0 !h-6 !w-6 ${buttonColorClass} ${isBusy ? 'opacity-50 cursor-wait' : ''}`}
              icon={<Share2 size={18} />}
              onClick={handleButtonClick}
              data-testid="block-share-button"
            />
          </span>
        )}
      />
      <TooltipContent side="bottom" className="whitespace-pre-line">
        <span className="block">
          <em>Click</em> to open share menu
        </span>
        <span className="block">
          <em>Shift Click</em> to share to all
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

function useShareTargetBlocks(editor: CustomBlockNoteEditor) {
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  }) as NoteBlock | undefined

  const blocks = getBlockShareTargetBlocks(editor, block?.id)

  return { block, blocks }
}

function getEventPosition(e: React.MouseEvent | React.KeyboardEvent) {
  if ('clientX' in e && 'clientY' in e && e.nativeEvent instanceof MouseEvent && e.detail > 0) {
    return { x: e.clientX, y: e.clientY }
  }

  const rect = e.currentTarget.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}
