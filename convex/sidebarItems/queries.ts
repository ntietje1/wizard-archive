import { v } from "convex/values";
import { query } from "../_generated/server";
import { sidebarItemValidator } from "../notes/schema";
import { getSidebarItemsByCategory as getSidebarItemsByCategoryFn, getSidebarItemsByParent as getSidebarItemsByParentFn } from "./sidebarItems";
import { AnySidebarItem } from "./types";


export const getSidebarItemsByCategory = query({
  args: {
    campaignId: v.id('campaigns'),
    categoryId: v.id('tagCategories'),
  },
  returns: v.array(sidebarItemValidator),
  handler: async (ctx, args): Promise<AnySidebarItem[]> => {
    return getSidebarItemsByCategoryFn(ctx, args.campaignId, args.categoryId)
  },
})

export const getSidebarItemsByParent = query({
  args: {
    campaignId: v.id('campaigns'),
    categoryId: v.optional(v.id('tagCategories')),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.array(sidebarItemValidator),
  handler: async (ctx, args): Promise<AnySidebarItem[]> => {
    return getSidebarItemsByParentFn(
      ctx,
      args.campaignId,
      args.categoryId,
      args.parentId
    )
  },
})
