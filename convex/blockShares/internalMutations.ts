import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import {
  blockNoteIdValidator,
  blockShareStatusValidator,
  editorBlockInputValidator,
} from '../blocks/schema'
import { setBlocksShareStatus as setBlocksShareStatusFn } from './functions/setBlocksShareStatus'
import { shareBlocks as shareBlocksFn } from './functions/shareBlocks'
import { setBlockMemberPermission as setBlockMemberPermissionFn } from './functions/setBlockMemberPermission'
import { unshareBlocks as unshareBlocksFn } from './functions/unshareBlocks'
import { blockVisibilityPermissionLevelValidator } from './schema'
import { parseEditorBlocks } from '../blocks/parseEditorBlocks'
import { authenticate, checkDmMembership } from '../functions'
import { syncNoteIndexesFromBlocks } from '../notes/functions/syncNoteDerivedData'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import type { CustomBlock } from '../../shared/editor-blocks/types'
import type { CampaignFromDb } from '../../shared/campaigns/types'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

type ProjectedNoteArgs = {
  campaignId: Id<'campaigns'>
  noteId: Id<'sidebarItems'>
  content: Array<CustomBlock>
}

async function authorizeBlockShareMutation(
  ctx: MutationCtx,
  args: Pick<ProjectedNoteArgs, 'campaignId' | 'noteId'>,
) {
  const user = await authenticate(ctx)
  const { campaign } = await checkDmMembership({ ...ctx, user }, args.campaignId)
  const note = await ctx.db.get('sidebarItems', args.noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (note.campaignId !== campaign._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, "You don't have access to this campaign")
  }
}

async function getBlockShareCtx(ctx: MutationCtx, args: ProjectedNoteArgs) {
  const user = await authenticate(ctx)
  const { campaign, membership } = await checkDmMembership({ ...ctx, user }, args.campaignId)
  await syncProjectedNote({ ...ctx, campaign }, { noteId: args.noteId, content: args.content })
  return {
    ...ctx,
    campaign,
    membership,
  }
}

async function syncProjectedNote(
  ctx: MutationCtx & { campaign: CampaignFromDb },
  args: Pick<ProjectedNoteArgs, 'noteId' | 'content'>,
) {
  const note = await ctx.db.get('sidebarItems', args.noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (note.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, "You don't have access to this campaign")
  }
  await syncNoteIndexesFromBlocks(ctx, args)
}

export const authorizeBlockShareAction = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await authorizeBlockShareMutation(ctx, args)
    return null
  },
})

export const setBlocksShareStatus = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    status: blockShareStatusValidator,
    content: v.array(editorBlockInputValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const content = parseEditorBlocks(args.content)
    await setBlocksShareStatusFn(await getBlockShareCtx(ctx, { ...args, content }), args)
    return null
  },
})

export const shareBlocks = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
    content: v.array(editorBlockInputValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const content = parseEditorBlocks(args.content)
    await shareBlocksFn(await getBlockShareCtx(ctx, { ...args, content }), args)
    return null
  },
})

export const unshareBlocks = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
    content: v.array(editorBlockInputValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const content = parseEditorBlocks(args.content)
    await unshareBlocksFn(await getBlockShareCtx(ctx, { ...args, content }), args)
    return null
  },
})

export const setBlockMemberPermission = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
    permissionLevel: v.nullable(blockVisibilityPermissionLevelValidator),
    content: v.array(editorBlockInputValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const content = parseEditorBlocks(args.content)
    await setBlockMemberPermissionFn(await getBlockShareCtx(ctx, { ...args, content }), args)
    return null
  },
})
