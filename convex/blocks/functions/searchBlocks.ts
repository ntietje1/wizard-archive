import type { CampaignQueryCtx, DmQueryCtx } from '../../functions'
import type { BlockSearchResult } from '../../../shared/search/types'
import type { NoteBlockId, NoteBlockType } from '@wizard-archive/editor/notes/document-contract'
import { asyncMap } from 'convex-helpers'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { hasAtLeastPermissionLevel } from '../../../shared/permissions/hasAtLeastPermissionLevel'
import { enforceBlockSharePermissionsForMembershipOrNull } from '../../blockShares/functions/getBlockPermissionLevel'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { getSidebarItemPermissionLevelForMembership } from '../../sidebarShares/functions/sidebarItemPermissions'
import type { Block } from '../types'
import type { CampaignMemberRow } from '../../../shared/campaigns/types'
import type { Id } from '../../_generated/dataModel'

type VisibleSearchNote = Awaited<ReturnType<typeof getVisibleSearchNote>>

export async function searchBlocks(
  ctx: CampaignQueryCtx,
  { membership = ctx.membership, query }: { membership?: CampaignMemberRow; query: string },
): Promise<Array<BlockSearchResult<NoteBlockType, NoteBlockId>>> {
  if (!query.trim()) return []

  const results = await ctx.db
    .query('blocks')
    .withSearchIndex('search_plainText', (q) =>
      q.search('plainText', query).eq('campaignId', ctx.campaign._id),
    )
    .take(50)

  const visibleNotesById = new Map<Block['noteId'], Promise<VisibleSearchNote>>()
  const visibleResults = await asyncMap(results, (block) =>
    toVisibleBlockSearchResult(ctx, { block, membership, visibleNotesById }),
  )
  return visibleResults.filter((result) => result !== null)
}

export async function searchBlocksAsMember(
  ctx: DmQueryCtx,
  { campaignMemberId, query }: { campaignMemberId: Id<'campaignMembers'>; query: string },
): Promise<Array<BlockSearchResult<NoteBlockType, NoteBlockId>>> {
  const membership = await ctx.db.get('campaignMembers', campaignMemberId)
  if (
    !membership ||
    membership.campaignId !== ctx.campaign._id ||
    membership.role !== CAMPAIGN_MEMBER_ROLE.Player ||
    membership.status !== CAMPAIGN_MEMBER_STATUS.Accepted
  ) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Selected player is not available')
  }
  return await searchBlocks(ctx, { membership, query })
}

async function toVisibleBlockSearchResult(
  ctx: CampaignQueryCtx,
  {
    block,
    membership,
    visibleNotesById,
  }: {
    block: Block
    membership: CampaignMemberRow
    visibleNotesById: Map<Block['noteId'], Promise<VisibleSearchNote>>
  },
): Promise<BlockSearchResult<NoteBlockType, NoteBlockId> | null> {
  const note = await getCachedVisibleSearchNote(
    ctx,
    { membership, noteId: block.noteId },
    visibleNotesById,
  )
  if (!note) return null

  const visibleBlock = await enforceBlockSharePermissionsForMembershipOrNull(ctx, {
    block,
    membership,
    notePermissionLevel: note.permissionLevel,
  })
  if (!visibleBlock) return null

  return {
    blockNoteId: block.blockNoteId,
    noteId: block.noteId,
    plainText: block.plainText,
    type: block.type as NoteBlockType,
  }
}

function getCachedVisibleSearchNote(
  ctx: CampaignQueryCtx,
  input: { membership: CampaignMemberRow; noteId: Block['noteId'] },
  visibleNotesById: Map<Block['noteId'], Promise<VisibleSearchNote>>,
) {
  const cached = visibleNotesById.get(input.noteId)
  if (cached) return cached
  const pending = getVisibleSearchNote(ctx, input)
  visibleNotesById.set(input.noteId, pending)
  return pending
}

async function getVisibleSearchNote(
  ctx: CampaignQueryCtx,
  { membership, noteId }: { membership: CampaignMemberRow; noteId: Block['noteId'] },
) {
  const note = await getSidebarItem(ctx, noteId)
  if (!note || note.type !== 'note') return null
  const permissionLevel = await getSidebarItemPermissionLevelForMembership(ctx, {
    item: note,
    membership,
  })
  if (!hasAtLeastPermissionLevel(permissionLevel, PERMISSION_LEVEL.VIEW)) return null
  return { note, permissionLevel }
}
