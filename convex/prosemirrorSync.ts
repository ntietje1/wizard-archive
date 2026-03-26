import { BlockNoteEditor, nodeToBlock } from '@blocknote/core'
import { ProsemirrorSync } from '@convex-dev/prosemirror-sync'
import { components } from './_generated/api'
import { saveTopLevelBlocksForNote } from './blocks/functions/saveTopLevelBlocksForNote'
import { requireItemAccess } from './sidebarItems/validation'
import { ERROR_CODE, throwClientError } from './errors'
import { PERMISSION_LEVEL } from './permissions/types'
import { editorSchema } from './notes/editorSpecs'
import { authenticate } from './functions'
import type { Node } from '@tiptap/pm/model'
import type { AuthMutationCtx, AuthQueryCtx } from './functions'
import type { PermissionLevel } from './permissions/types'
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
  { documentId, level }: { documentId: string; level: PermissionLevel },
) {
  const noteId = documentId as Id<'notes'>
  const noteFromDb = await ctx.db.get(noteId)
  if (!noteFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  const user = await authenticate(ctx)
  const authCtx: AuthQueryCtx = { ...ctx, user }
  await requireItemAccess(authCtx, {
    rawItem: noteFromDb,
    requiredLevel: level,
  })
}

function pmSnapshotToBlocks(snapshot: string): Array<CustomBlock> {
  const headless = BlockNoteEditor.create({
    schema: editorSchema,
    _headless: true,
  })
  const pmDoc = headless.pmSchema.nodeFromJSON(JSON.parse(snapshot))
  const blocks: Array<CustomBlock> = []
  if (pmDoc.firstChild) {
    pmDoc.firstChild.descendants((node: Node) => {
      blocks.push(nodeToBlock(node, headless.pmSchema) as CustomBlock)
      return false
    })
  }
  return blocks
}

const sync = prosemirrorSync.syncApi({
  // check read is ok to skip here since notes are already gated by permission
  checkWrite: (ctx, id) =>
    checkAccess(ctx, { documentId: id, level: PERMISSION_LEVEL.EDIT }),
  onSnapshot: async (
    ctx: MutationCtx,
    documentId: string,
    snapshot: string,
  ) => {
    const noteId = documentId as Id<'notes'>
    const noteFromDb = await ctx.db.get(noteId)
    if (!noteFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
    const user = await authenticate(ctx) // TODO: see if this can be de-duplicated with checkWrite auth
    const authCtx: AuthMutationCtx = { ...ctx, user }
    const blocks = pmSnapshotToBlocks(snapshot)
    await saveTopLevelBlocksForNote(authCtx, {
      noteId,
      content: blocks,
    })
  },
})

export const getSnapshot = sync.getSnapshot
export const submitSnapshot = sync.submitSnapshot
export const latestVersion = sync.latestVersion
export const getSteps = sync.getSteps
export const submitSteps = sync.submitSteps
