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
import type { NoteWithContent } from 'shared/notes/types'
import { AGGREGATE_SHARE_STATUS } from '~/features/sharing/utils/block-share-state'
import type { AggregateShareStatus } from '~/features/sharing/utils/block-share-state'
import { useBlocksShare } from '~/features/sharing/hooks/useBlocksShare'
import { assertNever } from '~/shared/utils/utils'
import { useBlockShareMenu } from '~/features/sharing/contexts/useBlockShareMenu'
import {
  getBlockShareTargetBlocks,
  getBlockShareTitle,
} from '~/features/editor/utils/block-share-targets'
import { openBlockNoteContextMenu } from '~/features/editor/hooks/useBlockNoteContextMenu'

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
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor() as CustomBlockNoteEditor
  const sideMenuExtension = useExtension(SideMenuExtension)
  const blockShareMenu = useBlockShareMenu()
  const { block, blocks } = useShareTargetBlocks(editor)

  const { isPending, isMutating, aggregateShareStatus, setAllPlayersPermission, canShare } =
    useBlocksShare(blocks, note)

  const blockCount = blocks.length
  const isBusy = isPending || isMutating

  const handleButtonClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (isBusy || !canShare) return
    if (e.ctrlKey || e.metaKey) return

    e.preventDefault()
    e.stopPropagation()

    if (e.shiftKey) {
      void setAllPlayersPermission('visible')
      return
    }

    openShareMenu(getEventPosition(e))
  }

  const buttonColorClass = getButtonColorClass(aggregateShareStatus)

  if (!block || !canShare) return null

  function openShareMenu(position: { x: number; y: number }) {
    if (isBusy || !canShare) return
    blockShareMenu.open({
      blocks,
      note,
      position,
      sideMenuController: sideMenuExtension,
      title: getBlockShareTitle(blockCount),
    })
  }

  function handleContextMenu(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation?.()

    openBlockNoteContextMenu({
      position: { x: e.clientX, y: e.clientY },
      viewContext: 'note-view',
      note,
      blockNoteId: block?.id,
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
    <span
      className="inline-flex"
      role="presentation"
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      <Components.SideMenu.Button
        label={getShareButtonLabel(blockCount)}
        className={`!p-0 !px-0 !h-6 !w-6 ${buttonColorClass} ${isBusy ? 'opacity-50 cursor-wait' : ''}`}
        icon={<Share2 size={18} />}
        onClick={handleButtonClick}
        data-testid="block-share-button"
      />
    </span>
  )
}

function useShareTargetBlocks(editor: CustomBlockNoteEditor) {
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  }) as CustomBlock | undefined

  const blocks = getBlockShareTargetBlocks(editor, block?.id)

  return { block, blocks }
}

function getShareButtonLabel(blockCount: number) {
  return blockCount > 1 ? `Share ${blockCount} blocks` : 'Share'
}

function getEventPosition(e: React.MouseEvent | React.KeyboardEvent) {
  if ('clientX' in e && 'clientY' in e) {
    return { x: e.clientX, y: e.clientY }
  }

  const rect = e.currentTarget.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}
