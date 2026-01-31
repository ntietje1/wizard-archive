import { BlockNoteEditor, nodeToBlock } from '@blocknote/core'
import { ProsemirrorSync } from '@convex-dev/prosemirror-sync'
import { components } from './_generated/api'
import { requireCampaignMembership } from './campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from './campaigns/types'
import { saveTopLevelBlocksForNote } from './blocks/blocks'
import { editorSchema } from './notes/editorSpecs'
import type { Id } from './_generated/dataModel'
import type { Ctx } from './common/types'
import type { MutationCtx } from './_generated/server'
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

async function checkDmAccess(ctx: Ctx, documentId: string) {
  const noteId = documentId as Id<'notes'>
  const note = await ctx.db.get(noteId)
  if (!note) throw new Error('Note not found')
  await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    {
      allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM],
    },
  )
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
  checkRead: checkDmAccess,
  checkWrite: checkDmAccess,
  onSnapshot: async (
    ctx: MutationCtx,
    documentId: string,
    snapshot: string,
  ) => {
    const noteId = documentId as Id<'notes'>
    const blocks = pmSnapshotToBlocks(snapshot)
    await saveTopLevelBlocksForNote(ctx, noteId, blocks)
  },
})

export const getSnapshot = sync.getSnapshot
export const submitSnapshot = sync.submitSnapshot
export const latestVersion = sync.latestVersion
export const getSteps = sync.getSteps
export const submitSteps = sync.submitSteps
