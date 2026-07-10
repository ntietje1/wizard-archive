import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { AnyItemWithContent } from '../../workspace/items'
import type { NoteBlockId, Heading } from '../document/model'
import type { NoteItemWithContent } from '../../notes/item-contract'
import { extractHeadingsFromContent } from '../headings/heading-utils'
import type { useNoteEditorStore } from '../editor-store'
import { useScopedNoteEditorStore } from '../editor-store'
import { getVisibleNoteBlocks } from '../visibility'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { CampaignMemberId } from '../../../../../shared/common/ids'
import type { PermissionLevel } from '../../../../../shared/permissions/types'
import { findNoteBlockElementInEditor } from '../headings/dom'

type ActiveNoteEditor = ReturnType<typeof useNoteEditorStore.getState>['editor']

export function useActiveNoteHeadingNavigation() {
  const editor = useScopedNoteEditorStore((s) => s.editor)

  return (noteBlockId: NoteBlockId) => scrollActiveNoteEditorToHeading(noteBlockId, editor)
}

function scrollActiveNoteEditorToHeading(noteBlockId: NoteBlockId, editor: ActiveNoteEditor) {
  const blockEl = findNoteBlockElementInEditor(editor, noteBlockId)
  if (!blockEl) return

  blockEl.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (!editor?._tiptapEditor?.view) return
  try {
    editor.focus()
    editor.setTextCursorPosition(noteBlockId, 'end')
  } catch {
    // Block might not exist yet or position out of range.
  }
}

export function getProjectedNoteOutlineHeadings(
  item: AnyItemWithContent,
  {
    canAccessItem,
    getMemberItemPermissionLevel,
    viewAsPlayerId,
  }: {
    canAccessItem: (note: NoteItemWithContent, requiredLevel: PermissionLevel) => boolean
    getMemberItemPermissionLevel: (
      note: NoteItemWithContent,
      memberId: CampaignMemberId,
    ) => PermissionLevel
    viewAsPlayerId: CampaignMemberId | undefined
  },
): Array<Heading> {
  if (!isNoteWithContent(item)) {
    return []
  }

  const hasFullContent = canAccessItem(item, PERMISSION_LEVEL.EDIT) && !viewAsPlayerId
  const content = hasFullContent
    ? item.content
    : getVisibleNoteBlocks(item, {
        getMemberItemPermissionLevel,
        viewAsPlayerId,
      })

  return extractHeadingsFromContent(content)
}

function isNoteWithContent(item: AnyItemWithContent): item is NoteItemWithContent {
  return item.type === RESOURCE_TYPES.notes
}
