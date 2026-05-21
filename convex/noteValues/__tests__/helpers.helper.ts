import { api } from '../../_generated/api'
import { makeYjsUpdateWithBlocks } from '../../yjsSync/__tests__/makeYjsUpdate.helper'
import { executeMoveCommand, testBlockNoteId } from '../../_test/factories.helper'
import type { Id, DataModel } from '../../_generated/dataModel'
import type { TestInlineContent } from '../../yjsSync/__tests__/makeYjsUpdate.helper'
import type { CustomPartialBlock } from '../../../shared/editor-blocks/types'
import type { TestConvex, TestConvexForDataModel } from 'convex-test'
import type schema from '../../schema'

export function valueBlock({
  id,
  valueId,
  slug,
  expressionSource,
}: {
  id: string
  valueId: string
  slug: string
  expressionSource: string
}): CustomPartialBlock {
  return {
    id,
    type: 'paragraph',
    props: {},
    content: [valueInline({ valueId, slug, expressionSource })],
  }
}

export function valueBlockWithGeneratedId(args: {
  idSeed: string
  valueId: string
  slug: string
  expressionSource: string
}): CustomPartialBlock {
  return valueBlock({
    ...args,
    id: testBlockNoteId(args.idSeed),
  })
}

export function valueInline({
  valueId,
  slug,
  expressionSource,
}: {
  valueId: string
  slug: string
  expressionSource: string
}): TestInlineContent {
  return {
    type: 'value',
    props: {
      valueId,
      slug,
      expressionSource,
    },
  }
}

export function paragraphWithGeneratedId({
  idSeed,
  content,
}: {
  idSeed: string
  content: Array<TestInlineContent>
}): CustomPartialBlock {
  return {
    id: testBlockNoteId(idSeed),
    type: 'paragraph',
    props: {},
    content,
  }
}

export async function renameValueTestNote(
  dmAuth: TestConvexForDataModel<DataModel>,
  {
    campaignId,
    noteId,
    name,
  }: {
    campaignId: Id<'campaigns'>
    noteId: Id<'sidebarItems'>
    name: string
  },
) {
  await dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
    campaignId,
    command: { type: 'rename', itemId: noteId, name },
  })
}

export async function hardDeleteValueTestNote(
  dmAuth: TestConvexForDataModel<DataModel>,
  {
    campaignId,
    noteId,
  }: {
    campaignId: Id<'campaigns'>
    noteId: Id<'sidebarItems'>
  },
) {
  await executeMoveCommand(dmAuth, {
    campaignId,
    sourceItemIds: [noteId],
    targetParentId: null,
    action: 'trash',
  })

  await dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
    campaignId,
    command: { type: 'emptyTrash' },
  })
}

export async function replaceNoteDocumentAndPersist(
  t: TestConvex<typeof schema>,
  dmAuth: TestConvexForDataModel<DataModel>,
  {
    campaignId,
    noteId,
    blocks,
  }: {
    campaignId: Id<'campaigns'>
    noteId: Id<'sidebarItems'>
    blocks: Array<CustomPartialBlock>
  },
) {
  const snapshot = makeYjsUpdateWithBlocks(blocks)

  await t.run(async (dbCtx) => {
    const existingUpdates = await dbCtx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
      .collect()

    for (const row of existingUpdates) {
      await dbCtx.db.delete('yjsUpdates', row._id)
    }

    await dbCtx.db.insert('yjsUpdates', {
      documentId: noteId,
      update: snapshot,
      seq: 0,
      isSnapshot: true,
    })
  })

  await dmAuth.action(api.notes.actions.persistNoteBlocks, {
    campaignId,
    documentId: noteId,
  })
}
