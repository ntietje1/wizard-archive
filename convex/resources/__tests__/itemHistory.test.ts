import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { OperationId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { FunctionArgs } from 'convex/server'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '@wizard-archive/editor/notes/document-yjs'
import { createCanvasDocumentDoc } from '@wizard-archive/editor/canvas/document-contract'
import { ITEM_HISTORY_ACTION } from '@wizard-archive/editor/resources/editor-runtime-contract'
import { initialNoteContentVersion } from '@wizard-archive/editor/resources/content-version'
import { initialVersion, sha256Digest } from '@wizard-archive/editor/resources/component-version'
import { initialMapContentVersion } from '@wizard-archive/editor/resources/map-session-policy'
import { INITIAL_CONTENT_GENERATION } from '@wizard-archive/editor/resources/content-generation'
import { parseAuthoredDestination } from '@wizard-archive/editor/resources/authored-destination'
import { api } from '../../_generated/api'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
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

  it('cleans item history in bounded work and does not recreate it after deletion', async () => {
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
    const update = encodeUpdate(document)
    const saved = await (async () => {
      try {
        return await asDm(campaign).mutation(api.resources.mutations.saveCanvasContent, {
          campaignId: campaign.campaignDomainId,
          generation: INITIAL_CONTENT_GENERATION,
          resourceId,
          update,
        })
      } finally {
        document.destroy()
      }
    })()
    expect(saved).toMatchObject({ status: 'completed', version: { revision: 2 } })
    if (saved.status !== 'completed') throw new TypeError('Expected saved canvas')

    await t.run(async (ctx) => {
      const snapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)
      await ctx.db.insert('itemHistoryCheckpoints', {
        snapshotUuid: snapshotId,
        campaignUuid: campaign.campaignDomainId,
        resourceUuid: resourceId,
        kind: 'canvas',
        update,
        version: saved.version,
      })
      await ctx.db.insert('itemHistoryEntries', {
        historyEntryUuid: generateDomainId(DOMAIN_ID_KIND.historyEntry),
        campaignUuid: campaign.campaignDomainId,
        resourceUuid: resourceId,
        actorMemberUuid: campaign.dm.memberDomainId,
        action: ITEM_HISTORY_ACTION.contentEdited,
        metadata: null,
        checkpoint: { kind: 'canvas', snapshotId, version: saved.version },
        createdAt: Date.now(),
      })
      for (let index = 0; index < 40; index += 1) {
        await ctx.db.insert('itemHistoryEntries', {
          historyEntryUuid: generateDomainId(DOMAIN_ID_KIND.historyEntry),
          campaignUuid: campaign.campaignDomainId,
          resourceUuid: resourceId,
          actorMemberUuid: campaign.dm.memberDomainId,
          action: ITEM_HISTORY_ACTION.renamed,
          metadata: { from: `Before ${index}`, to: `After ${index}` },
          createdAt: Date.now() + index + 1,
        })
      }
    })
    await expect(
      executeStructure(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
        type: 'trash',
        resourceIds: [resourceId],
      }),
    ).resolves.toMatchObject({ status: 'completed' })
    await expect(
      executeStructure(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
        type: 'permanentlyDelete',
        resourceIds: [resourceId],
      }),
    ).resolves.toMatchObject({ status: 'completed' })

    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('itemHistoryCaptureIntents')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
          .unique(),
      ).resolves.toBeNull()
      await expect(
        ctx.db
          .query('itemHistoryEntries')
          .withIndex('by_resource_history', (query) =>
            query.eq('campaignUuid', campaign.campaignDomainId).eq('resourceUuid', resourceId),
          )
          .first(),
      ).resolves.not.toBeNull()
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await t.run(async (ctx) => {
      const [entries, checkpoints, intent] = await Promise.all([
        ctx.db
          .query('itemHistoryEntries')
          .withIndex('by_resource_history', (query) =>
            query.eq('campaignUuid', campaign.campaignDomainId).eq('resourceUuid', resourceId),
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

  it('authorizes, paginates, previews, and restores note history atomically', async () => {
    vi.useFakeTimers()
    const campaign = await setupCampaignContext(t)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const historicalDocument = noteBlocksToYDoc(
      [{ type: 'paragraph', content: [{ type: 'text', text: 'Historical' }] }],
      NOTE_YJS_FRAGMENT,
    )
    const historicalUpdate = encodeUpdate(historicalDocument)
    const historicalVersion = await initialNoteContentVersion(new Uint8Array(historicalUpdate))
    const historicalEntryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const historicalSnapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)
    try {
      await createNote(campaign, resourceId, historicalUpdate)
      const stateVector = Y.encodeStateVector(historicalDocument)
      noteText(historicalDocument).insert(noteText(historicalDocument).length, ' current')
      const current = await saveNote(
        campaign,
        resourceId,
        encodeUpdate(historicalDocument, stateVector),
      )
      if (current.status !== 'completed') throw new TypeError('Expected saved note')

      await t.run(async (ctx) => {
        await ctx.db.insert('itemHistoryCheckpoints', {
          snapshotUuid: historicalSnapshotId,
          campaignUuid: campaign.campaignDomainId,
          resourceUuid: resourceId,
          kind: 'note',
          update: historicalUpdate,
          version: historicalVersion,
        })
        await ctx.db.insert('itemHistoryEntries', {
          historyEntryUuid: historicalEntryId,
          campaignUuid: campaign.campaignDomainId,
          resourceUuid: resourceId,
          actorMemberUuid: campaign.dm.memberDomainId,
          action: ITEM_HISTORY_ACTION.contentEdited,
          metadata: null,
          checkpoint: {
            kind: 'note',
            snapshotId: historicalSnapshotId,
            version: historicalVersion,
          },
          createdAt: Date.now(),
        })
      })
      await executeAccess(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
        type: 'setAudienceAccess',
        resourceIds: [resourceId],
        permission: 'view',
      })

      await expect(
        asPlayer(campaign).query(api.resources.queries.loadItemHistoryPage, {
          campaignId: campaign.campaignDomainId,
          resourceId,
          cursor: null,
        }),
      ).resolves.toEqual({ status: 'unavailable' })
      await expect(
        asPlayer(campaign).query(api.resources.queries.loadItemHistoryCheckpoint, {
          campaignId: campaign.campaignDomainId,
          resourceId,
          entryId: historicalEntryId,
        }),
      ).resolves.toEqual({ status: 'unavailable' })
      await expect(
        asPlayer(campaign).mutation(api.resources.mutations.restoreItemHistoryCheckpoint, {
          campaignId: campaign.campaignDomainId,
          operationId: generateDomainId(DOMAIN_ID_KIND.operation),
          resourceId,
          entryId: historicalEntryId,
          expectedVersion: current.version,
        }),
      ).resolves.toMatchObject({ status: 'rejected', reason: 'unauthorized' })

      const preview = await asDm(campaign).query(api.resources.queries.loadItemHistoryCheckpoint, {
        campaignId: campaign.campaignDomainId,
        resourceId,
        entryId: historicalEntryId,
      })
      expect(preview).toMatchObject({
        status: 'ready',
        preview: {
          kind: 'note',
          snapshotId: historicalSnapshotId,
          version: historicalVersion,
        },
      })
      if (preview.status !== 'ready' || preview.preview.kind !== 'note') {
        throw new TypeError('Expected note history preview')
      }
      expect(bytes(preview.preview.update)).toEqual(bytes(historicalUpdate))

      await expect(
        asDm(campaign).mutation(api.resources.mutations.restoreItemHistoryCheckpoint, {
          campaignId: campaign.campaignDomainId,
          operationId: generateDomainId(DOMAIN_ID_KIND.operation),
          resourceId,
          entryId: historicalEntryId,
          expectedVersion: historicalVersion,
        }),
      ).resolves.toMatchObject({ status: 'rejected', reason: 'content_changed' })

      const restored = await asDm(campaign).mutation(
        api.resources.mutations.restoreItemHistoryCheckpoint,
        {
          campaignId: campaign.campaignDomainId,
          operationId: generateDomainId(DOMAIN_ID_KIND.operation),
          resourceId,
          entryId: historicalEntryId,
          expectedVersion: current.version,
        },
      )
      expect(restored).toMatchObject({
        status: 'restored',
        restoredFromEntryId: historicalEntryId,
      })
      if (restored.status !== 'restored') throw new TypeError('Expected restored note')

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const content = await asDm(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaign.campaignDomainId,
        resourceId,
      })
      expect(content).toMatchObject({
        status: 'ready',
        generation: 2,
        version: {
          revision: current.version.revision + 1,
          digest: historicalVersion.digest,
        },
      })
      if (content.status !== 'ready') throw new TypeError('Expected restored note content')
      expect(bytes(content.update)).toEqual(bytes(historicalUpdate))
      await expect(
        saveNote(campaign, resourceId, encodeUpdate(historicalDocument)),
      ).resolves.toEqual({
        status: 'rejected',
        reason: 'content_generation_conflict',
      })
      await expect(
        asDm(campaign).query(api.resources.queries.loadNoteContent, {
          campaignId: campaign.campaignDomainId,
          resourceId,
        }),
      ).resolves.toEqual(content)

      await t.run(async (ctx) => {
        const [preserved, restoredCheckpoint, intent, restoredEntries] = await Promise.all([
          ctx.db
            .query('itemHistoryCheckpoints')
            .withIndex('by_snapshotUuid', (query) =>
              query.eq('snapshotUuid', restored.preservedSnapshotId),
            )
            .unique(),
          ctx.db
            .query('itemHistoryCheckpoints')
            .withIndex('by_resource_snapshot', (query) =>
              query.eq('campaignUuid', campaign.campaignDomainId).eq('resourceUuid', resourceId),
            )
            .filter((query) => query.eq(query.field('version.revision'), content.version.revision))
            .unique(),
          ctx.db
            .query('itemHistoryCaptureIntents')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .unique(),
          ctx.db
            .query('itemHistoryEntries')
            .withIndex('by_resource_action_history', (query) =>
              query
                .eq('campaignUuid', campaign.campaignDomainId)
                .eq('resourceUuid', resourceId)
                .eq('action', ITEM_HISTORY_ACTION.contentRestored),
            )
            .collect(),
        ])
        if (preserved?.kind !== 'note' || restoredCheckpoint?.kind !== 'note') {
          throw new TypeError('Expected note restore checkpoints')
        }
        expect(bytes(preserved.update)).toEqual(bytes(encodeUpdate(historicalDocument)))
        expect(bytes(restoredCheckpoint.update)).toEqual(bytes(historicalUpdate))
        expect(intent).toBeNull()
        expect(restoredEntries).toEqual([
          expect.objectContaining({
            historyEntryUuid: restored.historyEntryId,
            metadata: {
              restoredFromEntryId: historicalEntryId,
              preservedSnapshotId: restored.preservedSnapshotId,
            },
          }),
        ])
      })

      await t.run(async (ctx) => {
        for (let index = 0; index < 26; index += 1) {
          await ctx.db.insert('itemHistoryEntries', {
            historyEntryUuid: generateDomainId(DOMAIN_ID_KIND.historyEntry),
            campaignUuid: campaign.campaignDomainId,
            resourceUuid: resourceId,
            actorMemberUuid: campaign.dm.memberDomainId,
            action: ITEM_HISTORY_ACTION.renamed,
            metadata: { from: `Before ${index}`, to: `After ${index}` },
            createdAt: Date.now() + index,
          })
        }
      })
      const firstPage = await asDm(campaign).query(api.resources.queries.loadItemHistoryPage, {
        campaignId: campaign.campaignDomainId,
        resourceId,
        cursor: null,
      })
      expect(firstPage).toMatchObject({ status: 'ready', entries: { length: 25 } })
      if (firstPage.status !== 'ready' || firstPage.nextCursor === null) {
        throw new TypeError('Expected paginated item history')
      }
      expect(firstPage.entries[0]!.actor).toMatchObject({
        id: campaign.dm.memberDomainId,
        displayName: campaign.dm.profile.name,
      })
      const secondPage = await asDm(campaign).query(api.resources.queries.loadItemHistoryPage, {
        campaignId: campaign.campaignDomainId,
        resourceId,
        cursor: firstPage.nextCursor,
      })
      if (secondPage.status !== 'ready') throw new TypeError('Expected second history page')
      expect(secondPage.nextCursor).toBeNull()
      expect(
        new Set([...firstPage.entries, ...secondPage.entries].map((entry) => entry.id)).size,
      ).toBe(firstPage.entries.length + secondPage.entries.length)

      const sequentialRestore = await asDm(campaign).mutation(
        api.resources.mutations.restoreItemHistoryCheckpoint,
        {
          campaignId: campaign.campaignDomainId,
          operationId: generateDomainId(DOMAIN_ID_KIND.operation),
          resourceId,
          entryId: restored.historyEntryId,
          expectedVersion: content.version,
        },
      )
      expect(sequentialRestore).toMatchObject({
        status: 'restored',
        restoredFromEntryId: restored.historyEntryId,
      })
      const sequentialContent = await asDm(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaign.campaignDomainId,
        resourceId,
      })
      expect(sequentialContent).toMatchObject({
        status: 'ready',
        generation: 3,
        version: {
          revision: content.version.revision + 1,
          digest: historicalVersion.digest,
        },
      })
      await t.run(async (ctx) => {
        const restoredEntries = await ctx.db
          .query('itemHistoryEntries')
          .withIndex('by_resource_action_history', (query) =>
            query
              .eq('campaignUuid', campaign.campaignDomainId)
              .eq('resourceUuid', resourceId)
              .eq('action', ITEM_HISTORY_ACTION.contentRestored),
          )
          .collect()
        expect(restoredEntries).toHaveLength(2)
      })

      if (sequentialContent.status !== 'ready') {
        throw new TypeError('Expected sequentially restored note content')
      }
      const concurrentRestores = await Promise.all(
        Array.from({ length: 2 }, () =>
          asDm(campaign).mutation(api.resources.mutations.restoreItemHistoryCheckpoint, {
            campaignId: campaign.campaignDomainId,
            operationId: generateDomainId(DOMAIN_ID_KIND.operation),
            resourceId,
            entryId: historicalEntryId,
            expectedVersion: sequentialContent.version,
          }),
        ),
      )
      expect(concurrentRestores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: 'restored' }),
          expect.objectContaining({ status: 'rejected', reason: 'content_changed' }),
        ]),
      )
      await t.run(async (ctx) => {
        const restoredEntries = await ctx.db
          .query('itemHistoryEntries')
          .withIndex('by_resource_action_history', (query) =>
            query
              .eq('campaignUuid', campaign.campaignDomainId)
              .eq('resourceUuid', resourceId)
              .eq('action', ITEM_HISTORY_ACTION.contentRestored),
          )
          .collect()
        expect(restoredEntries).toHaveLength(3)
      })
    } finally {
      historicalDocument.destroy()
    }
  })

  it('replays one durable restore receipt without overwriting an intervening edit', async () => {
    const campaign = await setupCampaignContext(t)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const historicalDocument = noteBlocksToYDoc(
      [{ type: 'paragraph', content: [{ type: 'text', text: 'Historical' }] }],
      NOTE_YJS_FRAGMENT,
    )
    const currentDocument = noteBlocksToYDoc(
      [{ type: 'paragraph', content: [{ type: 'text', text: 'Current' }] }],
      NOTE_YJS_FRAGMENT,
    )
    const historicalUpdate = encodeUpdate(historicalDocument)
    const historicalVersion = await initialNoteContentVersion(new Uint8Array(historicalUpdate))
    const entryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const snapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)
    try {
      await createNote(campaign, resourceId, encodeUpdate(currentDocument))
      const current = await asDm(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaign.campaignDomainId,
        resourceId,
      })
      if (current.status !== 'ready') throw new TypeError('Expected current note')
      await t.run(async (ctx) => {
        await ctx.db.insert('itemHistoryCheckpoints', {
          snapshotUuid: snapshotId,
          campaignUuid: campaign.campaignDomainId,
          resourceUuid: resourceId,
          kind: 'note',
          update: historicalUpdate,
          version: historicalVersion,
        })
        await ctx.db.insert('itemHistoryEntries', {
          historyEntryUuid: entryId,
          campaignUuid: campaign.campaignDomainId,
          resourceUuid: resourceId,
          actorMemberUuid: campaign.dm.memberDomainId,
          action: ITEM_HISTORY_ACTION.contentEdited,
          metadata: null,
          checkpoint: { kind: 'note', snapshotId, version: historicalVersion },
          createdAt: Date.now(),
        })
      })

      const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
      const request = {
        campaignId: campaign.campaignDomainId,
        operationId,
        resourceId,
        entryId,
        expectedVersion: current.version,
      }
      const receipt = await asDm(campaign).mutation(
        api.resources.mutations.restoreItemHistoryCheckpoint,
        request,
      )
      expect(receipt).toMatchObject({ status: 'restored', operationId })

      const stateVector = Y.encodeStateVector(historicalDocument)
      noteText(historicalDocument).insert(noteText(historicalDocument).length, ' intervening')
      const interveningSave = await asDm(campaign).mutation(
        api.resources.mutations.saveNoteContent,
        {
          campaignId: campaign.campaignDomainId,
          generation: 2,
          resourceId,
          update: encodeUpdate(historicalDocument, stateVector),
        },
      )
      expect(interveningSave).toMatchObject({ status: 'completed' })
      const beforeReplay = await asDm(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaign.campaignDomainId,
        resourceId,
      })

      await expect(
        asDm(campaign).mutation(api.resources.mutations.restoreItemHistoryCheckpoint, request),
      ).resolves.toEqual(receipt)
      await expect(
        asDm(campaign).query(api.resources.queries.loadNoteContent, {
          campaignId: campaign.campaignDomainId,
          resourceId,
        }),
      ).resolves.toEqual(beforeReplay)
      await expect(
        asDm(campaign).mutation(api.resources.mutations.restoreItemHistoryCheckpoint, {
          ...request,
          entryId: generateDomainId(DOMAIN_ID_KIND.historyEntry),
        }),
      ).resolves.toEqual({
        status: 'rejected',
        operationId,
        reason: 'operation_id_reused',
      })

      await t.run(async (ctx) => {
        const [operations, restoredEntries] = await Promise.all([
          ctx.db
            .query('itemHistoryRestoreOperations')
            .withIndex('by_campaign_and_operation', (query) =>
              query.eq('campaignUuid', campaign.campaignDomainId).eq('operationUuid', operationId),
            )
            .collect(),
          ctx.db
            .query('itemHistoryEntries')
            .withIndex('by_resource_action_history', (query) =>
              query
                .eq('campaignUuid', campaign.campaignDomainId)
                .eq('resourceUuid', resourceId)
                .eq('action', ITEM_HISTORY_ACTION.contentRestored),
            )
            .collect(),
        ])
        expect(operations).toHaveLength(1)
        expect(restoredEntries).toHaveLength(1)
      })
    } finally {
      historicalDocument.destroy()
      currentDocument.destroy()
    }
  })

  it('returns neutral previews and explicit restore failures for invalid or deleted targets', async () => {
    vi.useFakeTimers()
    const campaign = await setupCampaignContext(t)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const document = noteBlocksToYDoc(
      [{ type: 'paragraph', content: [{ type: 'text', text: 'Current' }] }],
      NOTE_YJS_FRAGMENT,
    )
    const update = encodeUpdate(document)
    document.destroy()
    await createNote(campaign, resourceId, update)
    const content = await asDm(campaign).query(api.resources.queries.loadNoteContent, {
      campaignId: campaign.campaignDomainId,
      resourceId,
    })
    if (content.status !== 'ready') throw new TypeError('Expected current note content')

    const missingEntryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const missingSnapshotEntryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const missingSnapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)
    const incompatibleEntryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const incompatibleSnapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)
    await t.run(async (ctx) => {
      await ctx.db.insert('itemHistoryEntries', {
        historyEntryUuid: missingSnapshotEntryId,
        campaignUuid: campaign.campaignDomainId,
        resourceUuid: resourceId,
        actorMemberUuid: campaign.dm.memberDomainId,
        action: ITEM_HISTORY_ACTION.contentEdited,
        metadata: null,
        checkpoint: { kind: 'note', snapshotId: missingSnapshotId, version: content.version },
        createdAt: Date.now(),
      })
      await ctx.db.insert('itemHistoryCheckpoints', {
        snapshotUuid: incompatibleSnapshotId,
        campaignUuid: campaign.campaignDomainId,
        resourceUuid: resourceId,
        kind: 'canvas',
        update,
        version: content.version,
      })
      await ctx.db.insert('itemHistoryEntries', {
        historyEntryUuid: incompatibleEntryId,
        campaignUuid: campaign.campaignDomainId,
        resourceUuid: resourceId,
        actorMemberUuid: campaign.dm.memberDomainId,
        action: ITEM_HISTORY_ACTION.contentEdited,
        metadata: null,
        checkpoint: {
          kind: 'note',
          snapshotId: incompatibleSnapshotId,
          version: content.version,
        },
        createdAt: Date.now() + 1,
      })
    })

    for (const [entryId, reason] of [
      [missingEntryId, 'history_entry_unavailable'],
      [missingSnapshotEntryId, 'snapshot_unavailable'],
      [incompatibleEntryId, 'snapshot_incompatible'],
    ] as const) {
      await expect(
        asDm(campaign).query(api.resources.queries.loadItemHistoryCheckpoint, {
          campaignId: campaign.campaignDomainId,
          resourceId,
          entryId,
        }),
      ).resolves.toEqual({ status: 'unavailable' })
      await expect(
        asDm(campaign).mutation(api.resources.mutations.restoreItemHistoryCheckpoint, {
          campaignId: campaign.campaignDomainId,
          operationId: generateDomainId(DOMAIN_ID_KIND.operation),
          resourceId,
          entryId,
          expectedVersion: content.version,
        }),
      ).resolves.toMatchObject({ status: 'rejected', reason })
    }

    await expect(
      executeStructure(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
        type: 'trash',
        resourceIds: [resourceId],
      }),
    ).resolves.toMatchObject({ status: 'completed' })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.restoreItemHistoryCheckpoint, {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        resourceId,
        entryId: incompatibleEntryId,
        expectedVersion: content.version,
      }),
    ).resolves.toMatchObject({ status: 'rejected', reason: 'resource_unavailable' })
    await expect(
      asPlayer(campaign).mutation(api.resources.mutations.restoreItemHistoryCheckpoint, {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        resourceId,
        entryId: incompatibleEntryId,
        expectedVersion: content.version,
      }),
    ).resolves.toMatchObject({ status: 'rejected', reason: 'unauthorized' })

    await expect(
      executeStructure(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
        type: 'permanentlyDelete',
        resourceIds: [resourceId],
      }),
    ).resolves.toMatchObject({ status: 'completed' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    await expect(
      asDm(campaign).mutation(api.resources.mutations.restoreItemHistoryCheckpoint, {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        resourceId,
        entryId: incompatibleEntryId,
        expectedVersion: content.version,
      }),
    ).resolves.toMatchObject({ status: 'rejected', reason: 'resource_unavailable' })
  })

  it('restores canvas and map checkpoints through their canonical content owners', async () => {
    vi.useFakeTimers()
    const campaign = await setupCampaignContext(t)
    const canvasId = generateDomainId(DOMAIN_ID_KIND.resource)
    const mapId = generateDomainId(DOMAIN_ID_KIND.resource)
    const deletedTargetId = generateDomainId(DOMAIN_ID_KIND.resource)
    await createCanvas(campaign, canvasId)
    await createMap(campaign, mapId)
    const deletedTargetDocument = noteBlocksToYDoc(
      [{ type: 'paragraph', content: [] }],
      NOTE_YJS_FRAGMENT,
    )
    await createNote(campaign, deletedTargetId, encodeUpdate(deletedTargetDocument))
    deletedTargetDocument.destroy()

    const canvasDocument = createCanvasDocumentDoc({
      nodes: [
        {
          id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
          type: 'text',
          position: { x: 12, y: 34 },
          data: {},
        },
      ],
      edges: [],
    })
    const canvasUpdate = encodeUpdate(canvasDocument)
    canvasDocument.destroy()
    const canvasVersion = initialVersion(await sha256Digest(new Uint8Array(canvasUpdate)))
    const canvasEntryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const canvasSnapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)

    const mapPinId = generateDomainId(DOMAIN_ID_KIND.mapPin)
    const mapDestination = parseAuthoredDestination({
      kind: 'internal',
      target: { kind: 'resource', resourceId: deletedTargetId },
    })
    if (!mapDestination) throw new TypeError('Expected map destination')
    const mapContent = {
      image: { status: 'unattached' as const },
      layers: [],
      pins: [
        {
          id: mapPinId,
          destination: mapDestination,
          layerId: null,
          visible: true,
          x: 25,
          y: 75,
        },
      ],
    }
    const mapVersion = await initialMapContentVersion(mapContent)
    const mapEntryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const mapSnapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)

    await t.run(async (ctx) => {
      await ctx.db.insert('itemHistoryCheckpoints', {
        snapshotUuid: canvasSnapshotId,
        campaignUuid: campaign.campaignDomainId,
        resourceUuid: canvasId,
        kind: 'canvas',
        update: canvasUpdate,
        version: canvasVersion,
      })
      await ctx.db.insert('itemHistoryEntries', {
        historyEntryUuid: canvasEntryId,
        campaignUuid: campaign.campaignDomainId,
        resourceUuid: canvasId,
        actorMemberUuid: campaign.dm.memberDomainId,
        action: ITEM_HISTORY_ACTION.contentEdited,
        metadata: null,
        checkpoint: {
          kind: 'canvas',
          snapshotId: canvasSnapshotId,
          version: canvasVersion,
        },
        createdAt: Date.now(),
      })
      await ctx.db.insert('itemHistoryCheckpoints', {
        snapshotUuid: mapSnapshotId,
        campaignUuid: campaign.campaignDomainId,
        resourceUuid: mapId,
        kind: 'map',
        image: null,
        layers: [],
        pins: mapContent.pins.map(({ id, ...pin }) => ({ mapPinUuid: id, ...pin })),
        version: mapVersion,
      })
      await ctx.db.insert('itemHistoryEntries', {
        historyEntryUuid: mapEntryId,
        campaignUuid: campaign.campaignDomainId,
        resourceUuid: mapId,
        actorMemberUuid: campaign.dm.memberDomainId,
        action: ITEM_HISTORY_ACTION.mapPinAdded,
        metadata: { pinLabel: 'Example' },
        checkpoint: {
          kind: 'map',
          snapshotId: mapSnapshotId,
          version: mapVersion,
        },
        createdAt: Date.now(),
      })
    })
    await expect(
      executeStructure(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
        type: 'trash',
        resourceIds: [deletedTargetId],
      }),
    ).resolves.toMatchObject({ status: 'completed' })
    await expect(
      executeStructure(campaign, generateDomainId(DOMAIN_ID_KIND.operation), {
        type: 'permanentlyDelete',
        resourceIds: [deletedTargetId],
      }),
    ).resolves.toMatchObject({ status: 'completed' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const [canvasBefore, mapBefore] = await Promise.all([
      asDm(campaign).query(api.resources.queries.loadCanvasContent, {
        campaignId: campaign.campaignDomainId,
        resourceId: canvasId,
      }),
      asDm(campaign).query(api.resources.queries.loadMapContent, {
        campaignId: campaign.campaignDomainId,
        resourceId: mapId,
      }),
    ])
    if (canvasBefore.status !== 'ready' || mapBefore.status !== 'ready') {
      throw new TypeError('Expected current canvas and map content')
    }
    await expect(
      asDm(campaign).query(api.resources.queries.loadItemHistoryCheckpoint, {
        campaignId: campaign.campaignDomainId,
        resourceId: mapId,
        entryId: mapEntryId,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      preview: {
        kind: 'map',
        snapshotId: mapSnapshotId,
        content: mapContent,
        images: [],
      },
    })

    await expect(
      asDm(campaign).mutation(api.resources.mutations.restoreItemHistoryCheckpoint, {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        resourceId: canvasId,
        entryId: canvasEntryId,
        expectedVersion: canvasBefore.version,
      }),
    ).resolves.toMatchObject({ status: 'restored', restoredFromEntryId: canvasEntryId })
    const mapRestore = await asDm(campaign).mutation(
      api.resources.mutations.restoreItemHistoryCheckpoint,
      {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        resourceId: mapId,
        entryId: mapEntryId,
        expectedVersion: mapBefore.version,
      },
    )
    if (mapRestore.status !== 'restored') {
      throw new TypeError(`Map restore failed: ${JSON.stringify(mapRestore)}`)
    }
    expect(mapRestore).toMatchObject({
      status: 'restored',
      restoredFromEntryId: mapEntryId,
    })

    const [canvasAfter, mapAfter] = await Promise.all([
      asDm(campaign).query(api.resources.queries.loadCanvasContent, {
        campaignId: campaign.campaignDomainId,
        resourceId: canvasId,
      }),
      asDm(campaign).query(api.resources.queries.loadMapContent, {
        campaignId: campaign.campaignDomainId,
        resourceId: mapId,
      }),
    ])
    expect(canvasAfter).toMatchObject({
      status: 'ready',
      generation: 2,
      version: { revision: canvasBefore.version.revision + 1 },
    })
    expect(mapAfter).toMatchObject({
      status: 'ready',
      content: mapContent,
      version: { revision: mapBefore.version.revision + 1 },
    })
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resourceReferenceEdges')
          .withIndex('by_campaign_and_target', (query) =>
            query
              .eq('campaignUuid', campaign.campaignDomainId)
              .eq('targetResourceUuid', deletedTargetId),
          )
          .unique(),
      ).resolves.toMatchObject({ sourceResourceUuid: mapId })
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

  async function createMap(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    resourceId: ResourceId,
  ) {
    await expect(
      asDm(campaign).mutation(api.resources.mutations.createMapResource, {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'create',
          resourceId,
          kind: 'map',
          parentId: null,
          title: 'History map',
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
      generation: INITIAL_CONTENT_GENERATION,
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
