import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdateWithBlocks } from '../../_test/yjs.helper'
import { executeMoveCommand, testBlockNoteId } from '../../_test/factories.helper'
import type { DataModel } from '../../_generated/dataModel'
import type { TestInlineContent } from '../../_test/yjs.helper'
import type { PartialNoteBlock } from '@wizard-archive/editor/notes/document-contract'
import type { TestConvex, TestConvexForDataModel } from 'convex-test'
import type schema from '../../schema'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { requireSidebarItemRow } from '../../sidebarItems/functions/sidebarItemIdentity'

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
}): PartialNoteBlock {
  return {
    id: testBlockNoteId(id),
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
}): PartialNoteBlock {
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
}): PartialNoteBlock {
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
    campaignId: CampaignId
    noteId: ResourceId
    name: string
  },
) {
  await executeTestFileSystemCommand(dmAuth, {
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
    campaignId: CampaignId
    noteId: ResourceId
  },
) {
  await executeMoveCommand(dmAuth, {
    campaignId,
    sourceItemIds: [noteId],
    targetParentId: null,
    action: 'trash',
  })

  await executeTestFileSystemCommand(dmAuth, {
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
    campaignId: CampaignId
    noteId: ResourceId
    blocks: Array<PartialNoteBlock>
  },
) {
  const snapshot = makeYjsUpdateWithBlocks(blocks)

  await t.run(async (dbCtx) => {
    const note = await requireSidebarItemRow(dbCtx, noteId)
    const existingUpdates = await dbCtx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', note._id))
      .collect()

    for (const row of existingUpdates) {
      await dbCtx.db.delete('yjsUpdates', row._id)
    }

    await dbCtx.db.insert('yjsUpdates', {
      documentId: note._id,
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
