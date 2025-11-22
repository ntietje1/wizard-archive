import { v } from "convex/values";
import { sidebarItemValidator } from '../sidebarItems/schema';
import { tagCategoryValidator } from "../tags/schema";
import { defineTable } from "convex/server";


export const folderTableFields = {
  userId: v.id('userProfiles'),
  campaignId: v.id('campaigns'),
  name: v.optional(v.string()),
  updatedAt: v.number(),
  categoryId: v.optional(v.id('tagCategories')),
  parentFolderId: v.optional(v.id('folders')),
}
const folderValidatorFields = {
  _id: v.id('folders'),
  _creationTime: v.number(),
  ...folderTableFields,
  category: v.optional(tagCategoryValidator),
  type: v.literal('folders'),
} as const

export const folderValidator = v.object(folderValidatorFields)

export const folderWithChildrenValidator = v.object({
  ...folderValidatorFields,
  children: v.optional(v.array(sidebarItemValidator)),
})

export const foldersTables = {
    folders: defineTable({
        ...folderTableFields,
    }).index('by_campaign_category_parent', [
        'campaignId',
        'categoryId',
        'parentFolderId',
    ]),
}
