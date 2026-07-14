import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import { getVisibleNoteBlocks } from './visibility'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { CampaignMemberId } from '../resources/domain-id'
import type { NoteBlock } from './document/model'
import type { NoteItemWithContent } from '../notes/item-contract'
import type { PermissionLevel } from '../../../../shared/permissions/types'

type NoteRenderState =
  | { kind: 'editable'; note: NoteItemWithContent }
  | {
      kind: 'static'
      note?: NoteItemWithContent
      noteId?: SidebarItemId
      content: Array<NoteBlock>
      evaluateValuesFromEditor: boolean
    }

export function getNoteRenderState({
  canAccessItem,
  editable,
  getMemberItemPermissionLevel,
  note,
  viewAsPlayerId,
}: {
  canAccessItem: (note: NoteItemWithContent, requiredLevel: PermissionLevel) => boolean
  editable: boolean
  getMemberItemPermissionLevel: (
    note: NoteItemWithContent,
    memberId: CampaignMemberId,
  ) => PermissionLevel
  note: NoteItemWithContent
  viewAsPlayerId: CampaignMemberId | undefined
}): NoteRenderState {
  const hasEditAccess = canAccessItem(note, PERMISSION_LEVEL.EDIT)
  const isViewAs = viewAsPlayerId !== undefined

  if (editable && hasEditAccess && !isViewAs) {
    return { kind: 'editable', note }
  }

  const hasFullContent = hasEditAccess && !isViewAs

  return {
    kind: 'static',
    note,
    noteId: note.id,
    content: hasFullContent
      ? note.content
      : getVisibleNoteBlocks(note, {
          getMemberItemPermissionLevel,
          viewAsPlayerId,
        }),
    evaluateValuesFromEditor: hasFullContent,
  }
}
