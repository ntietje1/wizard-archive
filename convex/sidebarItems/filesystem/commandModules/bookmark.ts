import { RESOURCE_EVENT_TYPE } from '@wizard-archive/editor/resources/transaction-contract'
import type { ResourceCommand } from '@wizard-archive/editor/resources/transaction-contract'
import { createFileSystemWriteSession } from '../deltas'
import { toggleItemBookmark } from '../../../bookmarks/functions/toggleItemBookmark'
import type { Bookmark } from '../../../bookmarks/types'
import type { CampaignMutationCtx } from '../../../functions'
import type { StoredResourceDelta } from '../deltas'

type ToggleBookmarksFileSystemCommand = Extract<ResourceCommand, { type: 'toggleBookmarks' }>
type BookmarkStateChangeRow = {
  sidebarItemId: Bookmark['sidebarItemId']
  campaignMemberId: Bookmark['campaignMemberId']
}

function toBookmarkStateChangeRow(bookmark: Bookmark | null): BookmarkStateChangeRow | null {
  if (!bookmark) return null
  return {
    campaignMemberId: bookmark.campaignMemberId,
    sidebarItemId: bookmark.sidebarItemId,
  }
}

export async function executeToggleBookmarksCommand(
  ctx: CampaignMutationCtx,
  { command }: { command: ToggleBookmarksFileSystemCommand },
): Promise<StoredResourceDelta> {
  const session = createFileSystemWriteSession(ctx)
  const changes = await Promise.all(
    command.itemIds.map((itemId) => toggleItemBookmark(ctx, { sidebarItemId: itemId })),
  )

  for (const { before, after } of changes) {
    session.recordBookmarkChange(toBookmarkStateChangeRow(before), toBookmarkStateChangeRow(after))
  }

  return await session.build({
    command,
    events: command.itemIds.map((itemId) => ({ type: RESOURCE_EVENT_TYPE.updated, itemId })),
  })
}
