import { BlockNoteEditor, nodeToBlock } from '@blocknote/core'
import { ProsemirrorSync } from '@convex-dev/prosemirror-sync'
import { components } from './_generated/api'
import { saveTopLevelBlocksForNote } from './blocks/blocks'
import { requireItemAccess } from './sidebarItems/validation'
import { PERMISSION_LEVEL } from './shares/types'
import { editorSchema } from './notes/editorSpecs'
import { buildCampaignMutationCtx, buildCampaignQueryCtx } from './functions'
import type { PermissionLevel } from './shares/types'
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

async function checkAccess(
  ctx: QueryCtx,
  documentId: string,
  level: PermissionLevel,
) {
  const noteId = documentId as Id<'notes'>
  const noteFromDb = await ctx.db.get(noteId)
  if (!noteFromDb) throw new Error('Note not found')
  const campaignCtx = await buildCampaignQueryCtx(ctx, noteFromDb.campaignId)
  await requireItemAccess(campaignCtx, noteFromDb.campaignId, noteFromDb, level)
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
  checkRead: (ctx, id) => checkAccess(ctx, id, PERMISSION_LEVEL.VIEW),
  checkWrite: (ctx, id) => checkAccess(ctx, id, PERMISSION_LEVEL.EDIT),
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
    await saveTopLevelBlocksForNote(
      campaignCtx,
      noteId,
      noteFromDb.campaignId,
      blocks,
    )
  },
})

export const getSnapshot = sync.getSnapshot
export const submitSnapshot = sync.submitSnapshot
export const latestVersion = sync.latestVersion
export const getSteps = sync.getSteps
export const submitSteps = sync.submitSteps
