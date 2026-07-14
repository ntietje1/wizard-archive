import { asyncMap } from 'convex-helpers'
import { getAllBlocksByNote } from '../../blocks/functions/getAllBlocksByNote'
import { enforceBlockSharePermissionsOrNull } from '../../blockShares/functions/getBlockPermissionLevel'
import { reconstructBlockTree } from '../../blocks/functions/reconstructBlockTree'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { NoteItem } from '@wizard-archive/editor/notes/item-contract'
import type { CampaignQueryCtx } from '../../functions'
import type { DownloadItem } from '../../sidebarItems/functions/downloadTypes'
import { requireSidebarItemRow } from '../../sidebarItems/functions/sidebarItemIdentity'

function ensureMdExtension(name: string): string {
  return name.endsWith('.md') ? name : `${name}.md`
}

export async function getNoteForDownload(
  ctx: CampaignQueryCtx,
  item: NoteItem,
  path: string,
): Promise<DownloadItem> {
  const noteName = ensureMdExtension(item.name)
  const note = await requireSidebarItemRow(ctx, item.id)
  const allBlocks = await getAllBlocksByNote(ctx, {
    noteId: note._id,
  })
  const results = await asyncMap(allBlocks, (block) =>
    enforceBlockSharePermissionsOrNull(ctx, {
      block,
      notePermissionLevel: item.myPermissionLevel,
    }),
  )
  const permittedBlocks = results
    .filter((result): result is NonNullable<typeof result> => result !== null)
    .map((result) => result.block)
  return {
    type: RESOURCE_TYPES.notes,
    name: noteName,
    path: ensureMdExtension(path),
    content: permittedBlocks.length === 0 ? [] : reconstructBlockTree(permittedBlocks),
  }
}
