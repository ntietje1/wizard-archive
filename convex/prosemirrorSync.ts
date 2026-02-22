import { BlockNoteEditor, nodeToBlock } from '@blocknote/core'
import { ProsemirrorSync } from '@convex-dev/prosemirror-sync'
import { components } from './_generated/api'
import { saveTopLevelBlocksForNote } from './blocks/blocks'
import {
  requireEditPermission,
  requireViewPermission,
} from './shares/itemShares'
import { editorSchema } from './notes/editorSpecs'
import { enhanceSidebarItem } from './sidebarItems/helpers'
import { buildCampaignMutationCtx, buildCampaignQueryCtx } from './functions'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { CustomBlock } from './notes/editorSpecs'

export const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync)

export const EMPTY_PM_DOC = {
  type: 'doc',
  content: [
    {
      type: 'blockGroup',
      content: [
        {
          type: 'blockContainer',
          content: [{ type: 'paragraph' }],
        },
      ],
    },
  ],
}

async function checkReadAccess(ctx: QueryCtx, documentId: string) {
  const noteId = documentId as Id<'notes'>
  const noteFromDb = await ctx.db.get(noteId)
  if (!noteFromDb) throw new Error('Note not found')
  const campaignCtx = await buildCampaignQueryCtx(ctx, noteFromDb.campaignId)
  const note = await enhanceSidebarItem(campaignCtx, noteFromDb)
  await requireViewPermission(campaignCtx, note)
}

async function checkWriteAccess(ctx: QueryCtx, documentId: string) {
  const noteId = documentId as Id<'notes'>
  const noteFromDb = await ctx.db.get(noteId)
  if (!noteFromDb) throw new Error('Note not found')
  const campaignCtx = await buildCampaignQueryCtx(ctx, noteFromDb.campaignId)
  const note = await enhanceSidebarItem(campaignCtx, noteFromDb)
  await requireEditPermission(campaignCtx, note)
}

function pmSnapshotToBlocks(snapshot: string): Array<CustomBlock> {
  const headless = BlockNoteEditor.create({
    schema: editorSchema,
    _headless: true,
  })
  const pmDoc = headless.pmSchema.nodeFromJSON(JSON.parse(snapshot))
  const blocks: Array<CustomBlock> = []
  if (pmDoc.firstChild) {
    pmDoc.firstChild.descendants((node) => {
      blocks.push(nodeToBlock(node, headless.pmSchema) as CustomBlock)
      return false
    })
  }
  return blocks
}

const sync = prosemirrorSync.syncApi({
  checkRead: checkReadAccess,
  checkWrite: checkWriteAccess,
  onSnapshot: async (
    ctx: MutationCtx,
    documentId: string,
    snapshot: string,
  ) => {
    const noteId = documentId as Id<'notes'>
    const noteFromDb = await ctx.db.get(noteId)
    if (!noteFromDb) throw new Error('Note not found')
    const campaignCtx = await buildCampaignMutationCtx(
      ctx,
      noteFromDb.campaignId,
    )
    const blocks = pmSnapshotToBlocks(snapshot)
    await saveTopLevelBlocksForNote(campaignCtx, noteId, blocks)
  },
})

export const getSnapshot = sync.getSnapshot
export const submitSnapshot = sync.submitSnapshot
export const latestVersion = sync.latestVersion
export const getSteps = sync.getSteps
export const submitSteps = sync.submitSteps
