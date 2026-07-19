import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '@wizard-archive/editor/notes/document-yjs'
import { createCanvasDocumentDoc } from '@wizard-archive/editor/canvas/document-contract'
import { ITEM_HISTORY_ACTION } from '@wizard-archive/editor/resources/editor-runtime-contract'
import { api } from '../../_generated/api'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'

describe('item history checkpoints', () => {
  const t = createTestContext()

  afterEach(() => vi.useRealTimers())

  it('coalesces note edits into the exact trailing checkpoint', async () => {
    vi.useFakeTimers()
    const campaign = await setupCampaignContext(t)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const document = noteBlocksToYDoc(
      [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Initial' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    try {
      await createNote(campaign, resourceId, encodeUpdate(document))

      let stateVector = Y.encodeStateVector(document)
      noteText(document).insert(noteText(document).length, ' first')
      const first = await saveNote(campaign, resourceId, encodeUpdate(document, stateVector))
      expect(first).toMatchObject({ status: 'completed', version: { revision: 2 } })

      stateVector = Y.encodeStateVector(document)
      noteText(document).insert(noteText(document).length, ' second')
      const second = await saveNote(campaign, resourceId, encodeUpdate(document, stateVector))
      expect(second).toMatchObject({ status: 'completed', version: { revision: 3 } })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (ctx) => {
        const [entries, checkpoints, intents, content] = await Promise.all([
          ctx.db
            .query('itemHistoryEntries')
            .withIndex('by_resource_action_history', (query) =>
              query
                .eq('campaignUuid', campaign.campaignDomainId)
                .eq('resourceUuid', resourceId)
                .eq('action', ITEM_HISTORY_ACTION.contentEdited),
            )
            .collect(),
          ctx.db
            .query('itemHistoryCheckpoints')
            .withIndex('by_resource_snapshot', (query) =>
              query.eq('campaignUuid', campaign.campaignDomainId).eq('resourceUuid', resourceId),
            )
            .collect(),
          ctx.db
            .query('itemHistoryCaptureIntents')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .collect(),
          ctx.db
            .query('resourceNoteContents')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .unique(),
        ])
        expect(entries).toHaveLength(1)
        expect(checkpoints).toHaveLength(1)
        expect(intents).toHaveLength(0)
        expect(entries[0]).toMatchObject({
          actorMemberUuid: campaign.dm.memberDomainId,
          checkpoint: {
            kind: 'note',
            snapshotId: checkpoints[0]!.snapshotUuid,
            version: second.status === 'completed' ? second.version : undefined,
          },
        })
        expect(checkpoints[0]).toMatchObject({
          kind: 'note',
          version: second.status === 'completed' ? second.version : undefined,
        })
        const checkpoint = checkpoints[0]
        if (checkpoint?.kind !== 'note') throw new TypeError('Expected note checkpoint')
        expect(bytes(checkpoint.update)).toEqual(bytes(content!.update))
      })

      stateVector = Y.encodeStateVector(document)
      noteText(document).insert(noteText(document).length, ' third')
      const third = await saveNote(campaign, resourceId, encodeUpdate(document, stateVector))
      expect(third).toMatchObject({ status: 'completed', version: { revision: 4 } })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (ctx) => {
        const [entries, checkpoints, content] = await Promise.all([
          ctx.db
            .query('itemHistoryEntries')
            .withIndex('by_resource_action_history', (query) =>
              query
                .eq('campaignUuid', campaign.campaignDomainId)
                .eq('resourceUuid', resourceId)
                .eq('action', ITEM_HISTORY_ACTION.contentEdited),
            )
            .collect(),
          ctx.db
            .query('itemHistoryCheckpoints')
            .withIndex('by_resource_snapshot', (query) =>
              query.eq('campaignUuid', campaign.campaignDomainId).eq('resourceUuid', resourceId),
            )
            .collect(),
          ctx.db
            .query('resourceNoteContents')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .unique(),
        ])
        expect(entries).toHaveLength(2)
        expect(entries[1]!.createdAt - entries[0]!.createdAt).toBeGreaterThanOrEqual(5 * 60_000)
        const latest = checkpoints.find(
          (checkpoint) =>
            third.status === 'completed' && checkpoint.version.revision === third.version.revision,
        )
        if (latest?.kind !== 'note') throw new TypeError('Expected latest note checkpoint')
        expect(bytes(latest.update)).toEqual(bytes(content!.update))
      })
    } finally {
      document.destroy()
    }
  })

  it('does not recreate history after a canvas is deleted before capture', async () => {
    vi.useFakeTimers()
    const campaign = await setupCampaignContext(t)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    await createCanvas(campaign, resourceId)
    const document = createCanvasDocumentDoc({
      nodes: [
        {
          id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
          type: 'text',
          position: { x: 0, y: 0 },
          data: {},
        },
      ],
      edges: [],
    })
    try {
      await expect(
        asDm(campaign).mutation(api.resources.mutations.saveCanvasContent, {
          campaignId: campaign.campaignDomainId,
          resourceId,
          update: encodeUpdate(document),
        }),
      ).resolves.toMatchObject({ status: 'completed', version: { revision: 2 } })
    } finally {
      document.destroy()
    }

    await t.run(async (ctx) => {
      const resource = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      const content = await ctx.db
        .query('resourceCanvasContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      await ctx.db.delete('resources', resource!._id)
      await ctx.db.delete('resourceCanvasContents', content!._id)
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await t.run(async (ctx) => {
      const [entries, checkpoints, intent] = await Promise.all([
        ctx.db
          .query('itemHistoryEntries')
          .withIndex('by_resource_action_history', (query) =>
            query
              .eq('campaignUuid', campaign.campaignDomainId)
              .eq('resourceUuid', resourceId)
              .eq('action', ITEM_HISTORY_ACTION.contentEdited),
          )
          .collect(),
        ctx.db
          .query('itemHistoryCheckpoints')
          .withIndex('by_resource_snapshot', (query) =>
            query.eq('campaignUuid', campaign.campaignDomainId).eq('resourceUuid', resourceId),
          )
          .collect(),
        ctx.db
          .query('itemHistoryCaptureIntents')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
          .unique(),
      ])
      expect(entries).toHaveLength(0)
      expect(checkpoints).toHaveLength(0)
      expect(intent).toBeNull()
    })
  })

  async function createNote(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    resourceId: ResourceId,
    update: ArrayBuffer,
  ) {
    await expect(
      asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'create',
          resourceId,
          kind: 'note',
          parentId: null,
          title: 'History note',
          icon: null,
          color: null,
        },
        update,
      }),
    ).resolves.toMatchObject({ status: 'completed' })
  }

  async function createCanvas(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    resourceId: ResourceId,
  ) {
    await expect(
      asDm(campaign).mutation(api.resources.mutations.createCanvasResource, {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'create',
          resourceId,
          kind: 'canvas',
          parentId: null,
          title: 'History canvas',
          icon: null,
          color: null,
        },
      }),
    ).resolves.toMatchObject({ status: 'completed' })
  }

  async function saveNote(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    resourceId: ResourceId,
    update: ArrayBuffer,
  ) {
    return await asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
      campaignId: campaign.campaignDomainId,
      resourceId,
      update,
    })
  }
})

function encodeUpdate(document: Y.Doc, stateVector?: Uint8Array): ArrayBuffer {
  return Uint8Array.from(Y.encodeStateAsUpdate(document, stateVector)).buffer
}

function noteText(document: Y.Doc): Y.XmlText {
  const group = document.getXmlFragment(NOTE_YJS_FRAGMENT).get(0)
  const container = group instanceof Y.XmlElement ? group.get(0) : null
  const paragraph = container instanceof Y.XmlElement ? container.get(0) : null
  const text = paragraph instanceof Y.XmlElement ? paragraph.get(0) : null
  if (!(text instanceof Y.XmlText)) throw new TypeError('Expected canonical note text')
  return text
}

function bytes(value: ArrayBuffer): Array<number> {
  return Array.from(new Uint8Array(value))
}
