import { deleteFile } from '../../files/files'
import { deleteFolder } from '../../folders/folders'
import { deleteMap } from '../../gameMaps/gameMaps'
import { deleteNote } from '../../notes/notes'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

export async function deleteCampaign(
  ctx: CampaignMutationCtx,
): Promise<Id<'campaigns'>> {
  const campaignId = ctx.campaign._id

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', undefined),
    )
    .collect()

  for (const folder of folders) {
    await deleteFolder(ctx, folder._id)
  }

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', undefined),
    )
    .collect()

  for (const note of notes) {
    await deleteNote(ctx, note._id)
  }

  const maps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', undefined),
    )
    .collect()

  for (const map of maps) {
    await deleteMap(ctx, map._id)
  }

  const files = await ctx.db
    .query('files')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', undefined),
    )
    .collect()

  for (const file of files) {
    await deleteFile(ctx, file._id)
  }

  // Delete block shares
  const blockShares = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', campaignId),
    )
    .collect()

  for (const share of blockShares) {
    await ctx.db.delete(share._id)
  }

  // Delete sessions
  const sessions = await ctx.db
    .query('sessions')
    .withIndex('by_campaign_startedAt', (q) => q.eq('campaignId', campaignId))
    .collect()

  for (const session of sessions) {
    await ctx.db.delete(session._id)
  }

  // Delete campaign members
  const campaignMembers = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
    .collect()

  for (const member of campaignMembers) {
    await ctx.db.delete(member._id)
  }

  await ctx.db.delete(campaignId)

  return campaignId
}
