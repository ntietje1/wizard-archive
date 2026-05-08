import { v } from 'convex/values'
import { campaignMutation, dmMutation } from '../functions'
import { sidebarItemLocationValidator } from './schema/validators'
import {
  moveSidebarItem as moveSidebarItemFn,
  moveSidebarItems as moveSidebarItemsFn,
} from './functions/moveSidebarItem'
import {
  permanentlyDeleteSidebarItem as permanentlyDeleteSidebarItemFn,
  permanentlyDeleteSidebarItems as permanentlyDeleteSidebarItemsFn,
} from './functions/permanentlyDeleteSidebarItem'
import { emptyTrashBin as emptyTrashBinFn } from './functions/emptyTrashBin'
import { claimPreviewGeneration as claimPreviewGenerationFn } from './functions/claimPreviewGeneration'
import { setPreviewImage as setPreviewImageFn } from './functions/setPreviewImage'
import { duplicateSidebarItems as duplicateSidebarItemsFn } from './functions/duplicateSidebarItem'
import type { Id } from '../_generated/dataModel'

const OPERATION_DECISION_ACTION = {
  skip: 'skip',
  replace: 'replace',
  keepBoth: 'keepBoth',
  cancel: 'cancel',
} as const

const MOVE_SIDEBAR_ITEMS_ACTION = {
  move: 'move',
  restore: 'restore',
  trash: 'trash',
} as const

const operationDecisionValidator = v.object({
  sourceItemId: v.id('sidebarItems'),
  action: v.union(
    v.literal(OPERATION_DECISION_ACTION.skip),
    v.literal(OPERATION_DECISION_ACTION.replace),
    v.literal(OPERATION_DECISION_ACTION.keepBoth),
    v.literal(OPERATION_DECISION_ACTION.cancel),
  ),
})

export const moveSidebarItem = campaignMutation({
  args: {
    itemId: v.id('sidebarItems'),
    parentId: v.optional(v.nullable(v.id('sidebarItems'))),
    location: v.optional(sidebarItemLocationValidator),
    name: v.optional(v.string()),
  },
  returns: v.id('sidebarItems'),
  handler: async (ctx, args): Promise<Id<'sidebarItems'>> => {
    return await moveSidebarItemFn(ctx, {
      itemId: args.itemId,
      parentId: args.parentId,
      location: args.location,
      name: args.name,
    })
  },
})

export const moveSidebarItems = campaignMutation({
  args: {
    sourceItemIds: v.array(v.id('sidebarItems')),
    targetParentId: v.nullable(v.id('sidebarItems')),
    action: v.optional(
      v.union(
        v.literal(MOVE_SIDEBAR_ITEMS_ACTION.move),
        v.literal(MOVE_SIDEBAR_ITEMS_ACTION.restore),
        v.literal(MOVE_SIDEBAR_ITEMS_ACTION.trash),
      ),
    ),
    decisions: v.optional(v.array(operationDecisionValidator)),
  },
  returns: v.array(v.id('sidebarItems')),
  handler: async (ctx, args): Promise<Array<Id<'sidebarItems'>>> => {
    return await moveSidebarItemsFn(ctx, args)
  },
})

export const permanentlyDeleteSidebarItem = campaignMutation({
  args: {
    itemId: v.id('sidebarItems'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await permanentlyDeleteSidebarItemFn(ctx, { itemId: args.itemId })
    return null
  },
})

export const permanentlyDeleteSidebarItems = campaignMutation({
  args: {
    sourceItemIds: v.array(v.id('sidebarItems')),
  },
  returns: v.array(v.id('sidebarItems')),
  handler: async (ctx, args): Promise<Array<Id<'sidebarItems'>>> => {
    return await permanentlyDeleteSidebarItemsFn(ctx, { sourceItemIds: args.sourceItemIds })
  },
})

export const emptyTrashBin = dmMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await emptyTrashBinFn(ctx)
    return null
  },
})

export const claimPreviewGeneration = campaignMutation({
  args: {
    itemId: v.id('sidebarItems'),
  },
  returns: v.object({
    claimed: v.boolean(),
    claimToken: v.nullable(v.string()),
  }),
  handler: async (ctx, args): Promise<{ claimed: boolean; claimToken: string | null }> => {
    return await claimPreviewGenerationFn(ctx, { itemId: args.itemId })
  },
})

export const setPreviewImage = campaignMutation({
  args: {
    itemId: v.id('sidebarItems'),
    previewStorageId: v.id('_storage'),
    claimToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await setPreviewImageFn(ctx, {
      itemId: args.itemId,
      previewStorageId: args.previewStorageId,
      claimToken: args.claimToken,
    })
    return null
  },
})

export const duplicateSidebarItems = campaignMutation({
  args: {
    sourceItemIds: v.array(v.id('sidebarItems')),
    targetParentId: v.nullable(v.id('sidebarItems')),
    decisions: v.optional(v.array(operationDecisionValidator)),
  },
  returns: v.array(v.id('sidebarItems')),
  handler: async (ctx, args): Promise<Array<Id<'sidebarItems'>>> => {
    return await duplicateSidebarItemsFn(ctx, args)
  },
})
