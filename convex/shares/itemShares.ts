import { getCampaignMembership, requireCampaignMembership } from "../campaigns/campaigns";
import { CAMPAIGN_MEMBER_ROLE } from "../campaigns/types";
import { getCurrentSession } from "../sessions/sessions";
import { SHARE_STATUS } from './types';
import type { CustomBlock } from "../notes/editorSpecs";
import type { Ctx } from "../common/types";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { AnySidebarItem } from "../sidebarItems/types";
import type { SidebarItemId, SidebarItemType } from "../sidebarItems/baseTypes";
import type { SidebarItemShare } from "./types";


export async function getSidebarItemPermissionStatus<T extends AnySidebarItem>(
    ctx: Ctx,
    item: T,
    viewAsPlayerId?: Id<'campaignMembers'>
): Promise<boolean> {
    const { campaignWithMembership } = await getCampaignMembership(
        ctx,
        { campaignId: item.campaignId },
    )

    if (!campaignWithMembership) {
        return false
    }

    let checkId = campaignWithMembership.member._id;

    if ( campaignWithMembership.member.role === CAMPAIGN_MEMBER_ROLE.DM) {
        if (!viewAsPlayerId) {
            return true
        } else {
            checkId = viewAsPlayerId;
        }
    }

    const shareStatus = item.shareStatus ?? SHARE_STATUS.NOT_SHARED

    switch (shareStatus) {
        case SHARE_STATUS.ALL_SHARED:
            return true;
        case SHARE_STATUS.INDIVIDUALLY_SHARED:
            return item.shares.some((share) => share.campaignMemberId === checkId);
        case SHARE_STATUS.NOT_SHARED:
            return false;
    }
}

export async function enforceSidebarItemSharePermissionsOrNull<T extends AnySidebarItem>(
    ctx: Ctx,
    item: T,
    viewAsPlayerId?: Id<'campaignMembers'>
): Promise<T | null> {
    const permissionStatus = await getSidebarItemPermissionStatus<T>(ctx, item, viewAsPlayerId);
    if (!permissionStatus) {
        return null;
    }

    return item;
}

export async function shareSidebarItemWithMember(
    ctx: MutationCtx,
    campaignId: Id<'campaigns'>,
    sidebarItemId: SidebarItemId,
    sidebarItemType: SidebarItemType,
    campaignMemberId: Id<'campaignMembers'>
): Promise<Id<'sidebarItemShares'>> {
    await requireCampaignMembership(
        ctx,
        { campaignId },
        { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    );

    // Check if share already exists
    const existingShare = await ctx.db
        .query('sidebarItemShares')
        .withIndex('by_campaign_item_member', (q) => q
            .eq('campaignId', campaignId)
            .eq('sidebarItemId', sidebarItemId)
            .eq('campaignMemberId', campaignMemberId)
        )
        .unique();

    if (existingShare) {
        return existingShare._id;
    }

    // Get current session if any
    const currentSession = await getCurrentSession(ctx, campaignId);

    return await ctx.db.insert('sidebarItemShares', {
        campaignId,
        sidebarItemId,
        sidebarItemType,
        campaignMemberId,
        sessionId: currentSession?._id,
    });
}

export async function unshareSidebarItemFromMember(
    ctx: MutationCtx,
    campaignId: Id<'campaigns'>,
    sidebarItemId: SidebarItemId,
    campaignMemberId: Id<'campaignMembers'>
): Promise<void> {
    await requireCampaignMembership(
        ctx,
        { campaignId },
        { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    );

    const share = await ctx.db
        .query('sidebarItemShares')
        .withIndex('by_campaign_item_member', (q) => q
            .eq('campaignId', campaignId)
            .eq('sidebarItemId', sidebarItemId)
            .eq('campaignMemberId', campaignMemberId)
        )
        .unique();

    if (share) {
        await ctx.db.delete(share._id);
    }
}

export async function getSidebarItemSharesForItem(
    ctx: QueryCtx,
    campaignId: Id<'campaigns'>,
    sidebarItemId: SidebarItemId
): Promise<Array<SidebarItemShare>> {
    return await ctx.db
        .query('sidebarItemShares')
        .withIndex('by_campaign_item_member', (q) => q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId)
        )
        .collect();
}

export async function getSidebarItemSharesForMember(
    ctx: QueryCtx,
    campaignId: Id<'campaigns'>,
    campaignMemberId: Id<'campaignMembers'>
): Promise<Array<SidebarItemShare>> {
    return await ctx.db
        .query('sidebarItemShares')
        .withIndex('by_campaign_member', (q) => q.eq('campaignId', campaignId).eq('campaignMemberId', campaignMemberId)
        )
        .collect();
}

export async function isSidebarItemSharedWithMember(
    ctx: QueryCtx,
    campaignId: Id<'campaigns'>,
    sidebarItemId: SidebarItemId,
    campaignMemberId: Id<'campaignMembers'>
): Promise<boolean> {
    const share = await ctx.db
        .query('sidebarItemShares')
        .withIndex('by_campaign_item_member', (q) => q
            .eq('campaignId', campaignId)
            .eq('sidebarItemId', sidebarItemId)
            .eq('campaignMemberId', campaignMemberId)
        )
        .unique();

    return share !== null;
}
export interface BlockItem {
    blockNoteId: string;
    content: CustomBlock;
}
