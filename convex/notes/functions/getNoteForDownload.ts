import { asyncMap } from 'convex-helpers'
import { getAllBlocksByNote } from '../../blocks/functions/getAllBlocksByNote'
import { enforceBlockSharePermissionsOrNull } from '../../blockShares/functions/getBlockPermissionLevel'
import { reconstructBlockTree } from '../../blocks/functions/reconstructBlockTree'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import type { CampaignQueryCtx } from '../../functions'
import type { AnySidebarItem } from '../../../shared/sidebar-items/model-types'
import type { DownloadItem } from '../../sidebarItems/functions/downloadTypes'

function ensureMdExtension(name: string): string {
  return name.endsWith('.md') ? name : `${name}.md`
}

export async function getNoteForDownload(
  ctx: CampaignQueryCtx,
  item: Extract<AnySidebarItem, { type: typeof SIDEBAR_ITEM_TYPES.notes }>,
  path: string,
): Promise<DownloadItem> {
  const noteName = ensureMdExtension(item.name)
  const allBlocks = await getAllBlocksByNote(ctx, {
    noteId: item._id,
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
    type: SIDEBAR_ITEM_TYPES.notes,
    name: noteName,
    path: ensureMdExtension(path),
    content: permittedBlocks.length === 0 ? [] : reconstructBlockTree(permittedBlocks),
  }
}
