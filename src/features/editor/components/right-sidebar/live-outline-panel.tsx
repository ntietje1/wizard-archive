import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { BlockNoteId } from 'shared/editor-blocks/types'
import { OutlinePanel } from './outline-panel'
import type { OutlinePanelState } from './outline-panel'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'

function scrollToHeading(
  blockNoteId: BlockNoteId,
  editor: ReturnType<typeof useNoteEditorStore.getState>['editor'],
) {
  const escapedId = CSS.escape(blockNoteId)
  const blockEl = document.querySelector(`[data-id="${escapedId}"]`)
  if (!blockEl) return

  blockEl.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (!editor?._tiptapEditor?.view) return
  editor.focus()
  editor.setTextCursorPosition(blockNoteId, 'end')
}

export function LiveOutlinePanel({ itemId }: { itemId: Id<'sidebarItems'> }) {
  const headingsQuery = useCampaignQuery(api.blocks.queries.getHeadingsByNote, { noteId: itemId })
  const editor = useNoteEditorStore((s) => s.editor)
  const state: OutlinePanelState = headingsQuery.isPending
    ? { status: 'pending' }
    : headingsQuery.isError
      ? { status: 'error' }
      : { status: 'success', headings: headingsQuery.data ?? [] }

  return (
    <OutlinePanel
      onNavigate={(blockNoteId) => scrollToHeading(blockNoteId, editor)}
      state={state}
    />
  )
}
