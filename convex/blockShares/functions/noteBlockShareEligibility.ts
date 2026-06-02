import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { ERROR_CODE } from '../../../shared/errors/client'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { hasPermissionForRequirement } from '../../../shared/permissions/requirements'
import { normalizeExplicitSharePermissionLevel } from '../../../shared/permissions/share-permissions'
import { throwClientError } from '../../errors'
import { resolveInheritedPermissions } from '../../sidebarShares/functions/sidebarItemPermissions'
import type { NoteFromDb } from '../../../shared/notes/types'
import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { PermissionLevel } from '../../../shared/permissions/types'

type BlockShareEligibilityCtx = Pick<QueryCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id'>
}

function grantsView(level: Parameters<typeof hasPermissionForRequirement>[0]): boolean {
  return hasPermissionForRequirement(level, PERMISSION_LEVEL.VIEW)
}

export async function getNoteEligibleBlockShareMemberIds(
  ctx: BlockShareEligibilityCtx,
  {
    note,
    candidateMemberIds,
  }: {
    note: NoteFromDb
    candidateMemberIds: Array<Id<'campaignMembers'>>
  },
): Promise<Set<Id<'campaignMembers'>>> {
  const candidateIds = new Set(candidateMemberIds)
  const eligibleMemberIds = new Set<Id<'campaignMembers'>>()
  const directPermissionByMemberId = new Map<Id<'campaignMembers'>, PermissionLevel>()

  const directShares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', note.campaignId).eq('sidebarItemId', note._id),
    )
    .collect()

  for (const share of directShares) {
    if (!candidateIds.has(share.campaignMemberId)) continue
    directPermissionByMemberId.set(
      share.campaignMemberId,
      normalizeExplicitSharePermissionLevel(share.permissionLevel),
    )
  }

  const inherited =
    note.allPermissionLevel === null
      ? await resolveInheritedPermissions(ctx, {
          parentId: note.parentId,
          campaignId: note.campaignId,
          memberIds: candidateMemberIds,
        })
      : null

  for (const memberId of candidateMemberIds) {
    const effectivePermissionLevel =
      directPermissionByMemberId.get(memberId) ??
      note.allPermissionLevel ??
      inherited?.members[memberId]?.level ??
      PERMISSION_LEVEL.NONE

    if (grantsView(effectivePermissionLevel)) eligibleMemberIds.add(memberId)
  }
  return eligibleMemberIds
}

export async function assertMemberCanReceiveBlockShare(
  ctx: BlockShareEligibilityCtx,
  {
    note,
    campaignMemberId,
  }: {
    note: NoteFromDb
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<void> {
  const member = await ctx.db.get('campaignMembers', campaignMemberId)
  if (!member || member.campaignId !== note.campaignId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Member does not belong to this campaign')
  }

  if (
    member.role !== CAMPAIGN_MEMBER_ROLE.Player ||
    member.status !== CAMPAIGN_MEMBER_STATUS.Accepted
  ) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only active player members can receive blocks')
  }

  const eligibleMemberIds = await getNoteEligibleBlockShareMemberIds(ctx, {
    note,
    candidateMemberIds: [campaignMemberId],
  })
  if (!eligibleMemberIds.has(campaignMemberId)) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Member cannot view this note')
  }
}
