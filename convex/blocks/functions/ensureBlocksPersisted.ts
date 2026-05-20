import { syncNoteDerivedDataFromYDoc } from '../../notes/functions/syncNoteDerivedData'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function ensureBlocksPersisted(
  ctx: CampaignMutationCtx,
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<void> {
  await syncNoteDerivedDataFromYDoc(ctx, { noteId })
}
