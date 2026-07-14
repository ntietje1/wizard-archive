import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { normalizeExplicitSharePermissionLevel } from '../../../shared/permissions/share-permissions'
import { resolveInheritedPermissions } from '../../sidebarShares/functions/sidebarItemPermissions'
import type { NoteItemRow } from '@wizard-archive/editor/notes/item-contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { PermissionLevel } from '../../../shared/permissions/types'

type BlockShareEligibilityCtx = Pick<QueryCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id'>
}

export type BlockSharePlayerNoteAccess = {
  memberId: Id<'campaignMembers'>
  notePermissionLevel: PermissionLevel
}

async function getNotePermissionLevelsByMemberId(
  ctx: BlockShareEligibilityCtx,
  {
    note,
    candidateMemberIds,
  }: {
    note: NoteItemRow
    candidateMemberIds: Array<Id<'campaignMembers'>>
  },
): Promise<Map<Id<'campaignMembers'>, PermissionLevel>> {
  const candidateIds = new Set(candidateMemberIds)
  const directPermissionByMemberId = new Map<Id<'campaignMembers'>, PermissionLevel>()

  const directShares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('sidebarItemId', note.id),
    )
    .collect()

  for (const share of directShares) {
    if (!candidateIds.has(share.campaignMemberId)) continue
    directPermissionByMemberId.set(
      share.campaignMemberId,
      normalizeExplicitSharePermissionLevel(share.permissionLevel),
    )
  }

  const inherited = await resolveInheritedPermissions(ctx, {
    parentId: note.parentId,
    memberIds: candidateMemberIds,
  })

  const permissionByMemberId = new Map<Id<'campaignMembers'>, PermissionLevel>()

  for (const memberId of candidateMemberIds) {
    const effectivePermissionLevel =
      directPermissionByMemberId.get(memberId) ??
      note.allPermissionLevel ??
      inherited?.members[memberId]?.level ??
      PERMISSION_LEVEL.NONE

    permissionByMemberId.set(memberId, effectivePermissionLevel)
  }
  return permissionByMemberId
}

export async function getBlockSharePlayerNoteAccess(
  ctx: BlockShareEligibilityCtx,
  {
    note,
    candidateMemberIds,
  }: {
    note: NoteItemRow
    candidateMemberIds: Array<Id<'campaignMembers'>>
  },
): Promise<Array<BlockSharePlayerNoteAccess>> {
  const permissionByMemberId = await getNotePermissionLevelsByMemberId(ctx, {
    note,
    candidateMemberIds,
  })
  return candidateMemberIds.map((memberId) => ({
    memberId,
    notePermissionLevel: permissionByMemberId.get(memberId) ?? PERMISSION_LEVEL.NONE,
  }))
}

export async function getActiveBlockSharePlayerMemberIds(
  ctx: BlockShareEligibilityCtx,
  {
    candidateMemberIds,
  }: {
    candidateMemberIds: Array<Id<'campaignMembers'>>
  },
): Promise<Set<Id<'campaignMembers'>>> {
  const activeMemberIds = new Set<Id<'campaignMembers'>>()
  await Promise.all(
    candidateMemberIds.map(async (memberId) => {
      const member = await ctx.db.get('campaignMembers', memberId)
      if (
        member &&
        member.campaignId === ctx.campaign._id &&
        member.role === CAMPAIGN_MEMBER_ROLE.Player &&
        member.status === CAMPAIGN_MEMBER_STATUS.Accepted
      ) {
        activeMemberIds.add(memberId)
      }
    }),
  )
  return activeMemberIds
}
