import { v } from "convex/values";

export const sidebarItemIdValidator = v.union(
  v.id('notes'),
  v.id('folders'),
  v.id('gameMaps'),
  v.id('tagCategories'),
  v.id('tags'),
)

export const sidebarItemTypeValidator = v.union(
  v.literal('notes'),
  v.literal('folders'),
  v.literal('gameMaps'),
  v.literal('tagCategories'),
  v.literal('tags'),
)

export const sidebarItemBaseFields = {
  name: v.optional(v.string()),
  slug: v.string(),
  campaignId: v.id('campaigns'),
  iconName: v.optional(v.string()),
  type: sidebarItemTypeValidator,
  parentId: v.optional(sidebarItemIdValidator),
  categoryId: v.optional(v.id('tagCategories')),
  updatedAt: v.number(),
}
