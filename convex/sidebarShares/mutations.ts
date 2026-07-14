import { v } from 'convex/values'
import { dmMutation } from '../functions'
import { permissionLevelValidator } from '../sidebarItems/schema/validators'
import { setResourceAudiencePermissionForSidebarItems as setResourceAudiencePermissionForSidebarItemsFn } from './functions/setResourceAudiencePermissionForSidebarItems'
import { setFolderInheritShares as setFolderInheritSharesFn } from './functions/setFolderInheritShares'
import {
  clearResourcesMemberPermission as clearResourcesMemberPermissionFn,
  setResourcesMemberPermission as setResourcesMemberPermissionFn,
} from './functions/sidebarItemShareMutations'
import { campaignMemberIdValidator } from '../campaigns/schema'
import { requireCampaignMemberRowForCampaign } from '../campaigns/functions/campaignIdentity'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { resourceIdValidator } from '../resources/validators'
import {
  requireSidebarItemRow,
  requireSidebarItemRows,
} from '../sidebarItems/functions/sidebarItemIdentity'

async function resolveCampaignMemberRowId(
  ctx: Parameters<typeof setResourcesMemberPermissionFn>[0],
  campaignMemberId: Parameters<typeof requireCampaignMemberRowForCampaign>[2],
) {
  const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, ctx.campaign.campaignUuid)
  return (await requireCampaignMemberRowForCampaign(ctx, campaignId, campaignMemberId))._id
}

async function resolveMemberPermissionTargets(
  ctx: Parameters<typeof setResourcesMemberPermissionFn>[0],
  campaignMemberId: CampaignMemberId,
  resourceIds: Array<ResourceId>,
) {
  const [memberRowId, resourceRows] = await Promise.all([
    resolveCampaignMemberRowId(ctx, campaignMemberId),
    requireSidebarItemRows(ctx, resourceIds),
  ])
  return {
    campaignMemberId: memberRowId,
    sidebarItemIds: resourceRows.map((item) => item._id),
  }
}

export const setResourcesMemberPermission = dmMutation({
  args: {
    sidebarItemIds: v.array(resourceIdValidator),
    campaignMemberId: campaignMemberIdValidator,
    permissionLevel: permissionLevelValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const targets = await resolveMemberPermissionTargets(
      ctx,
      args.campaignMemberId,
      args.sidebarItemIds,
    )
    await setResourcesMemberPermissionFn(ctx, {
      ...targets,
      permissionLevel: args.permissionLevel,
    })
    return null
  },
})

export const clearResourcesMemberPermission = dmMutation({
  args: {
    sidebarItemIds: v.array(resourceIdValidator),
    campaignMemberId: campaignMemberIdValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const targets = await resolveMemberPermissionTargets(
      ctx,
      args.campaignMemberId,
      args.sidebarItemIds,
    )
    await clearResourcesMemberPermissionFn(ctx, targets)
    return null
  },
})

export const setResourceAudiencePermissionForSidebarItems = dmMutation({
  args: {
    sidebarItemIds: v.array(resourceIdValidator),
    permissionLevel: v.nullable(permissionLevelValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sidebarItems = await requireSidebarItemRows(ctx, args.sidebarItemIds)
    await setResourceAudiencePermissionForSidebarItemsFn(ctx, {
      sidebarItemIds: sidebarItems.map((item) => item._id),
      permissionLevel: args.permissionLevel,
    })
    return null
  },
})

export const setFolderInheritShares = dmMutation({
  args: {
    folderId: resourceIdValidator,
    inheritShares: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const folder = await requireSidebarItemRow(ctx, args.folderId)
    return await setFolderInheritSharesFn(ctx, {
      folderId: folder._id,
      inheritShares: args.inheritShares,
    })
  },
})
