import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { OperationId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { FunctionArgs } from 'convex/server'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '@wizard-archive/editor/notes/document-yjs'
import { createCanvasDocumentDoc } from '@wizard-archive/editor/canvas/document-contract'
import { ITEM_HISTORY_ACTION } from '@wizard-archive/editor/resources/editor-runtime-contract'
import { api } from '../../_generated/api'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'

type StoredStructureCommand = FunctionArgs<
  typeof api.resources.mutations.executeStructureCommand
>['command']
type StoredAccessCommand = FunctionArgs<
  typeof api.resources.mutations.executeResourceAccessCommand
>['command']
type StoredBlockAccessCommand = FunctionArgs<
  typeof api.resources.mutations.executeNoteBlockAccessCommand
>['command']

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

  it('records structure transitions and compensation from canonical graph changes', async () => {
    const campaign = await setupCampaignContext(t)
    const sourceFolderId = await createFolder(campaign, 'Source')
    const destinationFolderId = await createFolder(campaign, 'Destination')
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const document = noteBlocksToYDoc([{ type: 'paragraph' }], NOTE_YJS_FRAGMENT)
    try {
      await createNote(campaign, resourceId, encodeUpdate(document), {
        parentId: sourceFolderId,
        title: 'Original',
      })
    } finally {
      document.destroy()
    }

    const metadataOperationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const metadataCommand = {
      type: 'updateMetadata' as const,
      resourceId,
      changes: { title: 'Renamed', icon: 'BookOpen', color: 'blue' },
    }
    const metadataResult = await executeStructure(campaign, metadataOperationId, metadataCommand)
    await expect(executeStructure(campaign, metadataOperationId, metadataCommand)).resolves.toEqual(
      metadataResult,
    )

    const moveOperationId = generateDomainId(DOMAIN_ID_KIND.operation)
    await executeStructure(campaign, moveOperationId, {
      type: 'move',
      resourceIds: [resourceId],
      destinationParentId: destinationFolderId,
    })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.compensateResourceOperation, {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        originalOperationId: moveOperationId,
      }),
    ).resolves.toMatchObject({ status: 'completed' })
    await executeStructure(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
      type: 'move',
      resourceIds: [resourceId],
      destinationParentId: destinationFolderId,
    })
    await executeStructure(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
      type: 'trash',
      resourceIds: [resourceId],
    })
    await executeStructure(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
      type: 'restore',
      resourceIds: [resourceId],
    })
    const copied = await executeStructure(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
      type: 'deepCopy',
      sourceRootIds: [resourceId],
      destinationParentId: null,
    })
    if (copied.status !== 'completed' || copied.receipt.result.type !== 'deepCopied') {
      throw new TypeError('Expected copied resource')
    }
    const copiedId = copied.receipt.result.roots[0]!.destinationRootId

    await t.run(async (ctx) => {
      const sourceEntries = await ctx.db
        .query('itemHistoryEntries')
        .withIndex('by_resource_history', (query) =>
          query.eq('campaignUuid', campaign.campaignDomainId).eq('resourceUuid', resourceId),
        )
        .collect()
      expect(sourceEntries.map((entry) => entry.action)).toEqual(
        expect.arrayContaining([
          ITEM_HISTORY_ACTION.created,
          ITEM_HISTORY_ACTION.renamed,
          ITEM_HISTORY_ACTION.iconChanged,
          ITEM_HISTORY_ACTION.colorChanged,
          ITEM_HISTORY_ACTION.trashed,
          ITEM_HISTORY_ACTION.restored,
        ]),
      )
      expect(
        sourceEntries.filter((entry) => entry.action === ITEM_HISTORY_ACTION.moved),
      ).toHaveLength(3)
      expect(sourceEntries).toHaveLength(9)
      expect(sourceEntries.map((entry) => entry.metadata)).toEqual(
        expect.arrayContaining([
          { from: 'Original', to: 'Renamed' },
          { from: null, to: 'BookOpen' },
          { from: null, to: 'blue' },
          { from: 'Source', to: 'Destination' },
          { from: 'Destination', to: 'Source' },
        ]),
      )

      const copiedEntries = await ctx.db
        .query('itemHistoryEntries')
        .withIndex('by_resource_history', (query) =>
          query.eq('campaignUuid', campaign.campaignDomainId).eq('resourceUuid', copiedId),
        )
        .collect()
      expect(copiedEntries).toEqual([
        expect.objectContaining({
          action: ITEM_HISTORY_ACTION.copied,
          metadata: { sourceResourceId: resourceId, sourceTitle: 'Renamed' },
        }),
      ])
    })
  })

  it('records only effective resource and block access changes', async () => {
    const campaign = await setupCampaignContext(t)
    const folderId = await createFolder(campaign, 'Shared folder')
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const blockIds = [
      generateDomainId(DOMAIN_ID_KIND.noteBlock),
      generateDomainId(DOMAIN_ID_KIND.noteBlock),
    ]
    const document = noteBlocksToYDoc(
      blockIds.map((id) => ({ id, type: 'paragraph' })),
      NOTE_YJS_FRAGMENT,
    )
    try {
      await createNote(campaign, resourceId, encodeUpdate(document))
    } finally {
      document.destroy()
    }

    const audienceOperationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const audienceCommand = {
      type: 'setAudienceAccess' as const,
      resourceIds: [resourceId],
      permission: 'view' as const,
    }
    await executeAccess(campaign, audienceOperationId, audienceCommand)
    await executeAccess(campaign, generateDomainId(DOMAIN_ID_KIND.operation), audienceCommand)
    await executeAccess(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
      type: 'setMemberAccess',
      resourceIds: [resourceId],
      memberId: campaign.player.memberDomainId,
      permission: 'edit',
    })
    await executeAccess(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
      type: 'clearMemberAccess',
      resourceIds: [resourceId],
      memberId: campaign.player.memberDomainId,
    })
    await executeAccess(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
      type: 'clearAudienceAccess',
      resourceIds: [resourceId],
    })
    await executeAccess(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
      type: 'setFolderAccessInheritance',
      folderId,
      inheritance: 'enabled',
    })

    const blockAudienceOperationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const blockAudienceCommand = {
      type: 'setNoteBlockAudienceAccess' as const,
      noteId: resourceId,
      blockIds,
      shared: true,
    }
    await executeBlockAccess(campaign, blockAudienceOperationId, blockAudienceCommand)
    await executeBlockAccess(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
      type: 'setNoteBlockMemberAccess',
      noteId: resourceId,
      blockIds,
      memberId: campaign.player.memberDomainId,
      permission: 'none',
    })
    await executeBlockAccess(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
      type: 'clearNoteBlockMemberAccess',
      noteId: resourceId,
      blockIds,
      memberId: campaign.player.memberDomainId,
    })
    await expect(
      executeBlockAccess(campaign, blockAudienceOperationId, blockAudienceCommand),
    ).resolves.toMatchObject({ status: 'completed' })

    await t.run(async (ctx) => {
      const entries = await ctx.db
        .query('itemHistoryEntries')
        .withIndex('by_resource_history', (query) =>
          query.eq('campaignUuid', campaign.campaignDomainId).eq('resourceUuid', resourceId),
        )
        .collect()
      const accessEntries = entries.filter(
        (entry) => entry.action === ITEM_HISTORY_ACTION.accessChanged,
      )
      expect(accessEntries).toHaveLength(4)
      expect(accessEntries.map((entry) => entry.metadata)).toEqual(
        expect.arrayContaining([
          { subject: 'all_players', from: 'default', to: 'view' },
          {
            subject: campaign.player.memberDomainId,
            from: 'default',
            to: 'edit',
          },
          {
            subject: campaign.player.memberDomainId,
            from: 'edit',
            to: 'default',
          },
          { subject: 'all_players', from: 'view', to: 'default' },
        ]),
      )
      const blockEntries = entries.filter(
        (entry) => entry.action === ITEM_HISTORY_ACTION.blockVisibilityChanged,
      )
      expect(blockEntries).toHaveLength(3)
      expect(blockEntries.map((entry) => entry.metadata)).toEqual(
        expect.arrayContaining([
          { subject: 'all_players', blockCount: 2, visible: true },
          {
            subject: campaign.player.memberDomainId,
            blockCount: 2,
            visible: false,
          },
          {
            subject: campaign.player.memberDomainId,
            blockCount: 2,
            visible: true,
          },
        ]),
      )
      const folderEntries = await ctx.db
        .query('itemHistoryEntries')
        .withIndex('by_resource_action_history', (query) =>
          query
            .eq('campaignUuid', campaign.campaignDomainId)
            .eq('resourceUuid', folderId)
            .eq('action', ITEM_HISTORY_ACTION.inheritanceChanged),
        )
        .collect()
      expect(folderEntries).toEqual([
        expect.objectContaining({ metadata: { from: 'disabled', to: 'enabled' } }),
      ])
    })
  })

  async function createNote(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    resourceId: ResourceId,
    update: ArrayBuffer,
    options: { parentId?: ResourceId; title?: string } = {},
  ) {
    await expect(
      asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'create',
          resourceId,
          kind: 'note',
          parentId: options.parentId ?? null,
          title: options.title ?? 'History note',
          icon: null,
          color: null,
        },
        update,
      }),
    ).resolves.toMatchObject({ status: 'completed' })
  }

  async function createFolder(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    title: string,
  ) {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    await executeStructure(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
      type: 'create',
      resourceId,
      kind: 'folder',
      parentId: null,
      title,
      icon: null,
      color: null,
    })
    return resourceId
  }

  async function executeStructure(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    operationId: OperationId,
    command: StoredStructureCommand,
  ) {
    return await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaign.campaignDomainId,
      operationId,
      command,
    })
  }

  async function executeAccess(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    operationId: OperationId,
    command: StoredAccessCommand,
  ) {
    return await asDm(campaign).mutation(api.resources.mutations.executeResourceAccessCommand, {
      campaignId: campaign.campaignDomainId,
      operationId,
      command,
    })
  }

  async function executeBlockAccess(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    operationId: OperationId,
    command: StoredBlockAccessCommand,
  ) {
    return await asDm(campaign).mutation(api.resources.mutations.executeNoteBlockAccessCommand, {
      campaignId: campaign.campaignDomainId,
      operationId,
      command,
    })
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
