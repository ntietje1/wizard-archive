import { SHARE_STATUS } from 'convex/blockShares/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import type { BlockMeta, NoteWithContent } from 'convex/notes/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { assertNever } from '~/shared/utils/utils'

type NoteRenderSource =
  | { kind: 'live'; note: NoteWithContent }
  | { kind: 'raw'; noteId: Id<'sidebarItems'> | undefined; content: Array<CustomBlock> }

export type NoteRenderModel =
  | {
      source: 'raw'
      renderMode: 'static'
      noteId: Id<'sidebarItems'> | undefined
      content: Array<CustomBlock>
    }
  | {
      source: 'live'
      renderMode: 'collaborative' | 'static' | 'static-with-collaboration'
      note: NoteWithContent
      content: Array<CustomBlock>
    }

export function resolveNoteRenderModel({
  source,
  requestedEditable,
  isDm,
  viewAsPlayerId,
  allItemsMap,
}: {
  source: NoteRenderSource
  requestedEditable: boolean
  isDm: boolean | undefined
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  allItemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
}): NoteRenderModel {
  if (source.kind === 'raw') {
    return {
      source: 'raw',
      renderMode: 'static',
      noteId: source.noteId,
      content: source.content,
    }
  }

  const { note } = source
  const hasRealEditAccess = effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.EDIT, {
    isDm,
    viewAsPlayerId: undefined,
    allItemsMap,
  })
  const isViewAs = Boolean(isDm && viewAsPlayerId)
  const canEditSurface = requestedEditable && hasRealEditAccess && !isViewAs

  if (canEditSurface) {
    return {
      source: 'live',
      renderMode: 'collaborative',
      note,
      content: note.content,
    }
  }

  return {
    source: 'live',
    renderMode: requestedEditable && hasRealEditAccess ? 'static-with-collaboration' : 'static',
    note,
    content:
      hasRealEditAccess && !isViewAs
        ? note.content
        : filterViewableBlocks(note, {
            isDm,
            viewAsPlayerId,
          }),
  }
}

function filterViewableBlocks(
  note: NoteWithContent,
  {
    isDm,
    viewAsPlayerId,
  }: {
    isDm: boolean | undefined
    viewAsPlayerId: Id<'campaignMembers'> | undefined
  },
): Array<CustomBlock> {
  if (isDm && viewAsPlayerId) {
    return note.content.filter((block) => {
      const meta = note.blockMeta[block.id]
      if (!meta) return false
      return canViewBlockAsPlayer(meta, viewAsPlayerId)
    })
  }

  return note.content.filter((block) => {
    const meta = note.blockMeta[block.id]
    if (!meta) return false
    return meta.myPermissionLevel !== PERMISSION_LEVEL.NONE
  })
}

function canViewBlockAsPlayer(meta: BlockMeta, viewAsPlayerId: Id<'campaignMembers'>): boolean {
  switch (meta.shareStatus) {
    case SHARE_STATUS.ALL_SHARED:
      return true
    case SHARE_STATUS.INDIVIDUALLY_SHARED:
      return meta.sharedWith.includes(viewAsPlayerId)
    case SHARE_STATUS.NOT_SHARED:
      return false
    default:
      return assertNever(meta.shareStatus)
  }
}
