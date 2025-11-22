import { Id } from "../_generated/dataModel";
import { requireCampaignMembership } from "../campaigns/campaigns";
import { CAMPAIGN_MEMBER_ROLE } from "../campaigns/types";
import { Ctx } from "../common/types";
import { getSidebarItemsByParent } from "../sidebarItems/sidebarItems";
import { SIDEBAR_ITEM_TYPES } from "../sidebarItems/types";
import { getTagCategory } from "../tags/tags";
import { Folder } from "./types";


export const getFolder = async (
    ctx: Ctx,
    folderId: Id<'folders'>
): Promise<Folder> => {
    const folder = await ctx.db.get(folderId);
    if (!folder) {
        throw new Error('Folder not found');
    }
    await requireCampaignMembership(
        ctx,
        { campaignId: folder.campaignId },
        { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    );

    const category = folder.categoryId
        ? await getTagCategory(ctx, folder.campaignId, folder.categoryId)
        : undefined;

    return {
        ...folder,
        category,
        type: SIDEBAR_ITEM_TYPES.folders,
    };
};

export const getFolderWithChildren = async (
    ctx: Ctx,
    folderId: Id<'folders'>
): Promise<Folder> => {
    const folder: Folder = await getFolder(ctx, folderId)
    const children = await getSidebarItemsByParent(ctx, folder.campaignId, folder.categoryId, folderId)
    return { ...folder, children }
}


export const getFolderAncestors = async (
    ctx: Ctx,
    folderId: Id<'folders'>
): Promise<Folder[]> => {
    const folder = await ctx.db.get(folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }
    await requireCampaignMembership(
      ctx,
      { campaignId: folder.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    const ancestors: Folder[] = []
    const visited = new Set<Id<'folders'>>([folderId])
    let currentFolderId = folder.parentFolderId

    while (currentFolderId) {
      if (visited.has(currentFolderId)) {
        throw new Error('Circular folder reference detected')
      }
      visited.add(currentFolderId)
      const parentFolder: Folder = await getFolder(ctx, currentFolderId)
      ancestors.unshift(parentFolder)
      currentFolderId = parentFolder.parentFolderId
    }
    return ancestors
}