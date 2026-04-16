import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createBlock } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { makeYjsUpdateWithBlocks } from '../../yjsSync/__tests__/makeYjsUpdate.helper'
import { syncNoteLinks } from '../../links/functions/syncNoteLinks'
import type { CampaignMutationCtx } from '../../functions'
import type { PersistedBlockRecord } from '../../blocks/types'

async function pushAndPersist(
  dmAuth: ReturnType<typeof asDm>,
  campaignId: Id<'campaigns'>,
  noteId: Id<'sidebarItems'>,
  blocks: Parameters<typeof makeYjsUpdateWithBlocks>[0],
) {
  await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
    campaignId,
    documentId: noteId,
    update: makeYjsUpdateWithBlocks(blocks),
  })
  await dmAuth.mutation(api.notes.mutations.persistNoteBlocks, {
    campaignId,
    documentId: noteId,
  })
}

type FactoryBlock = Awaited<ReturnType<typeof createBlock>>

function toPersistedBlock(
  noteId: Id<'sidebarItems'>,
  block: FactoryBlock,
): PersistedBlockRecord {
  return {
    _id: block.blockDbId,
    noteId,
    blockNoteId: block.blockNoteId,
    position: block.position,
    parentBlockId: block.parentBlockId,
    depth: block.depth,
    type: block.type,
    props: block.props,
    inlineContent: block.inlineContent,
    plainText: block.plainText,
    campaignId: block.campaignId,
    shareStatus: block.shareStatus,
  }
}

async function runSync(
  t: ReturnType<typeof createTestContext>,
  campaignId: Id<'campaigns'>,
  noteId: Id<'sidebarItems'>,
  blocks: Array<PersistedBlockRecord>,
) {
  await t.run(async (dbCtx) => {
    await syncNoteLinks(dbCtx as unknown as CampaignMutationCtx, {
      noteId,
      campaignId,
      blocks,
    })
  })
}

async function listLinksForNote(
  t: ReturnType<typeof createTestContext>,
  campaignId: Id<'campaigns'>,
  noteId: Id<'sidebarItems'>,
) {
  return await t.run(async (dbCtx) => {
    return await dbCtx.db
      .query('noteLinks')
      .withIndex('by_campaign_source', (q) =>
        q.eq('campaignId', campaignId).eq('sourceNoteId', noteId),
      )
      .collect()
  })
}

describe('persistNoteBlocks — note link reconciliation', () => {
  const t = createTestContext()

  it('stores one resolved link row per source block', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: targetId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Target Note',
      parentId: null,
    })
    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    await pushAndPersist(dmAuth, ctx.campaignId, sourceId, [
      {
        id: 'block-a',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'First [[Target Note]]', styles: {} }],
        children: [],
      },
      {
        id: 'block-b',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Second [label](Target Note)', styles: {} }],
        children: [],
      },
    ])

    await t.run(async (dbCtx) => {
      const links = await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()

      expect(links).toHaveLength(2)
      expect(links.every((link) => link.targetItemId === targetId)).toBe(true)
      expect(new Set(links.map((link) => link.blockId)).size).toBe(2)
    })
  })

  it('deduplicates resolved links in a block by target item id', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Target Note',
      parentId: null,
    })
    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    await pushAndPersist(dmAuth, ctx.campaignId, sourceId, [
      {
        id: 'block-a',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'text',
            text: '[[Target Note]] and [Alias](Target Note) and [[Target Note|Shown]]',
            styles: {},
          },
        ],
        children: [],
      },
    ])

    await t.run(async (dbCtx) => {
      const links = await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()

      expect(links).toHaveLength(1)
      expect(links[0].query).toBe('Target Note')
    })
  })

  it('deduplicates unresolved links in a block by query', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    await pushAndPersist(dmAuth, ctx.campaignId, sourceId, [
      {
        id: 'block-a',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'text',
            text: '[[Missing Note]] and again [[Missing Note]] and [[Other Missing]]',
            styles: {},
          },
        ],
        children: [],
      },
    ])

    await t.run(async (dbCtx) => {
      const links = await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()

      expect(links).toHaveLength(2)
      expect(links.every((link) => link.targetItemId === null)).toBe(true)
      expect(links.map((link) => link.query).sort()).toEqual(['Missing Note', 'Other Missing'])
    })
  })

  it('ignores external markdown links', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    await pushAndPersist(dmAuth, ctx.campaignId, sourceId, [
      {
        id: 'block-a',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Visit [docs](https://example.com)', styles: {} }],
        children: [],
      },
    ])

    await t.run(async (dbCtx) => {
      const links = await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
      expect(links).toHaveLength(0)
    })
  })

  it('stores unresolved internal links with null target ids', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    await pushAndPersist(dmAuth, ctx.campaignId, sourceId, [
      {
        id: 'block-a',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'See [[Missing Note#Section|Alias]]', styles: {} }],
        children: [],
      },
    ])

    await t.run(async (dbCtx) => {
      const links = await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
      expect(links).toHaveLength(1)
      expect(links[0]).toMatchObject({
        targetItemId: null,
        query: 'Missing Note#Section',
        displayName: 'Alias',
        syntax: 'wiki',
      })
    })
  })

  it('keeps unchanged link rows instead of recreating them', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Target Note',
      parentId: null,
    })
    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    const blocks = [
      {
        id: 'block-a',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: '[[Target Note]]', styles: {} }],
        children: [],
      },
    ] as Parameters<typeof makeYjsUpdateWithBlocks>[0]

    await pushAndPersist(dmAuth, ctx.campaignId, sourceId, blocks)
    const originalLink = await t.run(async (dbCtx) => {
      const links = await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
      return links[0]
    })

    await pushAndPersist(dmAuth, ctx.campaignId, sourceId, blocks)

    await t.run(async (dbCtx) => {
      const links = await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()

      expect(links).toHaveLength(1)
      expect(links[0]._id).toBe(originalLink._id)
      expect(links[0]._creationTime).toBe(originalLink._creationTime)
    })
  })

  it('patches an existing resolved row when query or syntax changes but the target stays the same', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: targetId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Target Note',
      parentId: null,
    })
    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    const originalBlock = await createBlock(t, sourceId, ctx.campaignId, {
      blockNoteId: 'block-a',
      plainText: '[[Target Note|Old Alias]]',
    })

    await t.run(async (dbCtx) => {
      await syncNoteLinks(dbCtx as unknown as CampaignMutationCtx, {
        noteId: sourceId,
        campaignId: ctx.campaignId,
        blocks: [
          {
            _id: originalBlock.blockDbId,
            noteId: sourceId,
            blockNoteId: originalBlock.blockNoteId,
            position: originalBlock.position,
            parentBlockId: originalBlock.parentBlockId,
            depth: originalBlock.depth,
            type: originalBlock.type,
            props: originalBlock.props,
            inlineContent: originalBlock.inlineContent,
            plainText: originalBlock.plainText,
            campaignId: originalBlock.campaignId,
            shareStatus: originalBlock.shareStatus,
          },
        ],
      })
    })

    const originalLink = await t.run(async (dbCtx) => {
      const links = await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
      return links[0]
    })

    await t.run(async (dbCtx) => {
      await syncNoteLinks(dbCtx as unknown as CampaignMutationCtx, {
        noteId: sourceId,
        campaignId: ctx.campaignId,
        blocks: [
          {
            _id: originalBlock.blockDbId,
            noteId: sourceId,
            blockNoteId: originalBlock.blockNoteId,
            position: originalBlock.position,
            parentBlockId: originalBlock.parentBlockId,
            depth: originalBlock.depth,
            type: originalBlock.type,
            props: originalBlock.props,
            inlineContent: originalBlock.inlineContent,
            plainText: '[New Label](Target Note)',
            campaignId: originalBlock.campaignId,
            shareStatus: originalBlock.shareStatus,
          },
        ],
      })
    })

    await t.run(async (dbCtx) => {
      const links = await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()

      expect(links).toHaveLength(1)
      expect(links[0]._id).toBe(originalLink._id)
      expect(links[0]).toMatchObject({
        targetItemId: targetId,
        query: 'Target Note',
        displayName: 'New Label',
        syntax: 'md',
      })
    })
  })

  it('deletes only stale rows when one source block disappears', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Target Note',
      parentId: null,
    })
    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    const blockA = await createBlock(t, sourceId, ctx.campaignId, {
      blockNoteId: 'block-a',
      plainText: '[[Target Note]]',
    })
    const blockB = await createBlock(t, sourceId, ctx.campaignId, {
      blockNoteId: 'block-b',
      plainText: '[[Target Note]]',
    })

    await t.run(async (dbCtx) => {
      await syncNoteLinks(dbCtx as unknown as CampaignMutationCtx, {
        noteId: sourceId,
        campaignId: ctx.campaignId,
        blocks: [
          {
            _id: blockA.blockDbId,
            noteId: sourceId,
            blockNoteId: blockA.blockNoteId,
            position: blockA.position,
            parentBlockId: blockA.parentBlockId,
            depth: blockA.depth,
            type: blockA.type,
            props: blockA.props,
            inlineContent: blockA.inlineContent,
            plainText: blockA.plainText,
            campaignId: blockA.campaignId,
            shareStatus: blockA.shareStatus,
          },
          {
            _id: blockB.blockDbId,
            noteId: sourceId,
            blockNoteId: blockB.blockNoteId,
            position: blockB.position,
            parentBlockId: blockB.parentBlockId,
            depth: blockB.depth,
            type: blockB.type,
            props: blockB.props,
            inlineContent: blockB.inlineContent,
            plainText: blockB.plainText,
            campaignId: blockB.campaignId,
            shareStatus: blockB.shareStatus,
          },
        ],
      })
    })

    const originalLinks = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
    })

    await t.run(async (dbCtx) => {
      await syncNoteLinks(dbCtx as unknown as CampaignMutationCtx, {
        noteId: sourceId,
        campaignId: ctx.campaignId,
        blocks: [
          {
            _id: blockB.blockDbId,
            noteId: sourceId,
            blockNoteId: blockB.blockNoteId,
            position: blockB.position,
            parentBlockId: blockB.parentBlockId,
            depth: blockB.depth,
            type: blockB.type,
            props: blockB.props,
            inlineContent: blockB.inlineContent,
            plainText: blockB.plainText,
            campaignId: blockB.campaignId,
            shareStatus: blockB.shareStatus,
          },
        ],
      })
    })

    await t.run(async (dbCtx) => {
      const links = await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()

      expect(links).toHaveLength(1)
      expect(links[0].blockId).toBe(blockB.blockDbId)
      expect(links[0]._id).toBe(
        originalLinks.find((link) => link.blockId === blockB.blockDbId)?._id,
      )
    })
  })

  it('collapses duplicate existing rows for the same dedupe key during sync', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: targetId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Target Note',
      parentId: null,
    })
    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    const block = await createBlock(t, sourceId, ctx.campaignId, {
      blockNoteId: 'block-a',
      plainText: '[[Target Note]]',
    })

    const duplicateIds = await t.run(async (dbCtx) => {
      return await Promise.all([
        dbCtx.db.insert('noteLinks', {
          sourceNoteId: sourceId,
          targetItemId: targetId,
          query: 'Target Note',
          displayName: null,
          syntax: 'wiki',
          campaignId: ctx.campaignId,
          blockId: block.blockDbId,
        }),
        dbCtx.db.insert('noteLinks', {
          sourceNoteId: sourceId,
          targetItemId: targetId,
          query: 'Target Note',
          displayName: 'Alias',
          syntax: 'md',
          campaignId: ctx.campaignId,
          blockId: block.blockDbId,
        }),
      ])
    })

    await runSync(t, ctx.campaignId, sourceId, [toPersistedBlock(sourceId, block)])

    const links = await listLinksForNote(t, ctx.campaignId, sourceId)
    expect(links).toHaveLength(1)
    expect(duplicateIds).toContain(links[0]._id)
  })

  it('keeps the first parsed occurrence for duplicate resolved links in one block', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: targetId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Target Note',
      parentId: null,
    })
    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    const block = await createBlock(t, sourceId, ctx.campaignId, {
      blockNoteId: 'block-a',
      plainText: '[First Label](Target Note) then [[Target Note|Second Label]]',
    })

    await runSync(t, ctx.campaignId, sourceId, [toPersistedBlock(sourceId, block)])

    const links = await listLinksForNote(t, ctx.campaignId, sourceId)
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({
      targetItemId: targetId,
      query: 'Target Note',
      displayName: 'First Label',
      syntax: 'md',
    })
  })

  it('keeps the first parsed occurrence for duplicate unresolved links in one block', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    const block = await createBlock(t, sourceId, ctx.campaignId, {
      blockNoteId: 'block-a',
      plainText: '[First Label](Missing Note#Lore) then [[Missing Note#Lore|Second Label]]',
    })

    await runSync(t, ctx.campaignId, sourceId, [toPersistedBlock(sourceId, block)])

    const links = await listLinksForNote(t, ctx.campaignId, sourceId)
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({
      targetItemId: null,
      query: 'Missing Note#Lore',
      displayName: 'First Label',
      syntax: 'md',
    })
  })

  it('replaces an unresolved row with a resolved row when the target becomes available', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    const block = await createBlock(t, sourceId, ctx.campaignId, {
      blockNoteId: 'block-a',
      plainText: '[[Future Target#Section|Alias]]',
    })

    await runSync(t, ctx.campaignId, sourceId, [toPersistedBlock(sourceId, block)])

    const unresolvedLink = (await listLinksForNote(t, ctx.campaignId, sourceId))[0]
    expect(unresolvedLink).toMatchObject({
      targetItemId: null,
      query: 'Future Target#Section',
      displayName: 'Alias',
      syntax: 'wiki',
    })

    const { noteId: targetId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Future Target',
      parentId: null,
    })

    await runSync(t, ctx.campaignId, sourceId, [toPersistedBlock(sourceId, block)])

    const links = await listLinksForNote(t, ctx.campaignId, sourceId)
    expect(links).toHaveLength(1)
    expect(links[0]._id).not.toBe(unresolvedLink._id)
    expect(links[0]).toMatchObject({
      targetItemId: targetId,
      query: 'Future Target#Section',
      displayName: 'Alias',
      syntax: 'wiki',
    })
  })

  it('replaces a resolved row with an unresolved row when the target stops resolving', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: targetId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Target Note',
      parentId: null,
    })
    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentId: null,
    })

    const block = await createBlock(t, sourceId, ctx.campaignId, {
      blockNoteId: 'block-a',
      plainText: '[[Target Note#Section|Alias]]',
    })

    await runSync(t, ctx.campaignId, sourceId, [toPersistedBlock(sourceId, block)])

    const resolvedLink = (await listLinksForNote(t, ctx.campaignId, sourceId))[0]
    expect(resolvedLink.targetItemId).toBe(targetId)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', targetId, {
        name: 'Renamed Target',
      })
    })

    await runSync(t, ctx.campaignId, sourceId, [toPersistedBlock(sourceId, block)])

    const links = await listLinksForNote(t, ctx.campaignId, sourceId)
    expect(links).toHaveLength(1)
    expect(links[0]._id).not.toBe(resolvedLink._id)
    expect(links[0]).toMatchObject({
      targetItemId: null,
      query: 'Target Note#Section',
      displayName: 'Alias',
      syntax: 'wiki',
    })
  })
})
