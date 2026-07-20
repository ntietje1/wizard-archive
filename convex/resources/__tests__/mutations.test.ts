// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { initialResourceMetadataVersion } from '@wizard-archive/editor/resources/resource-metadata-version'
import type { FunctionArgs } from 'convex/server'
import { api, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createCampaignWithDm } from '../../_test/factories.helper'
import { createTestContext } from '../../_test/setup.helper'
import { makeYjsUpdateWithBlocks } from '../../_test/yjs.helper'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
  noteBlocksToYDoc,
} from '@wizard-archive/editor/notes/document-yjs'
import {
  createCanvasDocumentDoc,
  readCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import { CANVAS_WORKLOAD_LIMITS } from '@wizard-archive/editor/canvas/workload'
import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { initialBinaryContentVersion, initialJsonContentVersion } from '../functions/contentVersion'
import {
  storeCommittedTestUploadSession,
  storeUncommittedTestUploadSession,
} from '../../_test/storage.helper'
import {
  initialFileContentVersion,
  initialNoteContentVersion,
} from '@wizard-archive/editor/resources/content-version'
import {
  parseSerializedAuthoredDestination,
  serializeAuthoredDestination,
} from '@wizard-archive/editor/resources/authored-destination'
import { RESOURCE_COMMAND_PROTOCOL_VERSION } from '@wizard-archive/editor/resources/command-protocol'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { collaborationColor } from '../../../shared/resources/collaboration-user'
import {
  ITEM_HISTORY_ACTION,
  ITEM_HISTORY_RESTORE_PROTOCOL_VERSION,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import presenceTest from '@convex-dev/presence/test'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { INITIAL_CONTENT_GENERATION } from '@wizard-archive/editor/resources/content-generation'
import { advanceMapContentVersion } from '@wizard-archive/editor/resources/map-session-policy'
import { projectMapContent } from '../functions/mapContent'
import { replaceResourceReferenceProjection } from '../functions/resourceReferences'
import { deleteResourceItemHistoryBatch } from '../functions/itemHistoryCleanup'
import type { ItemHistoryCleanupStage } from '../functions/itemHistoryCleanup'
import { PLAIN_TRANSFER_LIMITS } from '@wizard-archive/editor/resources/plain-transfer-inventory'

type StoredResourceStructureCommand = FunctionArgs<
  typeof api.resources.mutations.executeStructureCommand
>['command']
type StoredResourceAccessCommand = FunctionArgs<
  typeof api.resources.mutations.executeResourceAccessCommand
>['command']
function resourcePresenceUpdate(state: Record<string, unknown> = {}) {
  const document = new Y.Doc()
  const awareness = new Awareness(document)
  awareness.setLocalState(state)
  const update = Uint8Array.from(encodeAwarenessUpdate(awareness, [document.clientID])).buffer
  const clientId = document.clientID
  awareness.destroy()
  document.destroy()
  return { clientId, update }
}

describe('resource structure commands', () => {
  const t = createTestContext()
  t.registerComponent('presence', presenceTest.schema, presenceTest.modules)

  afterEach(() => vi.useRealTimers())

  it('atomically creates and assigns one Assets folder for concurrent resolutions', async () => {
    const campaign = await setupCampaignContext(t)
    const firstCandidate = generateDomainId(DOMAIN_ID_KIND.resource)
    const secondCandidate = generateDomainId(DOMAIN_ID_KIND.resource)

    const [first, second] = await Promise.all([
      asDm(campaign).mutation(api.resources.mutations.ensureResourceAssetsFolder, {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        resourceId: firstCandidate,
      }),
      asDm(campaign).mutation(api.resources.mutations.ensureResourceAssetsFolder, {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        resourceId: secondCandidate,
      }),
    ])

    expect(first.status).toBe('completed')
    expect(second).toEqual(first)
    await t.run(async (ctx) => {
      const assignment = await ctx.db
        .query('resourceAssetsFolders')
        .withIndex('by_campaign', (query) => query.eq('campaignUuid', campaign.campaignDomainId))
        .unique()
      const folders = await ctx.db
        .query('resources')
        .withIndex('by_campaign_and_parent', (query) =>
          query.eq('campaignUuid', campaign.campaignDomainId).eq('parentResourceUuid', null),
        )
        .take(3)
      expect(folders).toHaveLength(1)
      expect(folders[0]).toMatchObject({
        resourceUuid: assignment?.resourceUuid,
        kind: 'folder',
        lifecycle: 'active',
        title: 'Assets',
        icon: 'Box',
      })
    })
  })

  it('keeps same-title folders unrelated and restores the canonical assignment', async () => {
    const campaign = await setupCampaignContext(t)
    const unrelatedAssetsId = await createResource(
      campaign,
      campaign.campaignDomainId,
      'folder',
      null,
      'Assets',
    )
    const adopted = await asDm(campaign).mutation(
      api.resources.mutations.ensureResourceAssetsFolder,
      {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        resourceId: generateDomainId(DOMAIN_ID_KIND.resource),
      },
    )
    if (adopted.status !== 'completed') throw new TypeError('Expected Assets assignment')
    expect(adopted.resourceId).not.toBe(unrelatedAssetsId)

    await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaign.campaignDomainId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: { type: 'trash', resourceIds: [adopted.resourceId] },
    })
    const restored = await asDm(campaign).mutation(
      api.resources.mutations.ensureResourceAssetsFolder,
      {
        campaignId: campaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        resourceId: generateDomainId(DOMAIN_ID_KIND.resource),
      },
    )

    expect(restored).toEqual({ status: 'completed', resourceId: adopted.resourceId })
    await t.run(async (ctx) => {
      const resource = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', adopted.resourceId))
        .unique()
      expect(resource?.lifecycle).toBe('active')
    })
  })

  it('replays safe compensation and rejects it after a conflicting edit', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = await createResource(campaign, campaignUuid, 'note', null, 'Original')
    const renamed = await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'updateMetadata',
        resourceId,
        changes: { title: 'Renamed' },
      },
    })
    if (renamed.status !== 'completed') throw new Error('Expected rename completion')
    await t.run(async (ctx) => {
      const operation = await ctx.db
        .query('resourceOperations')
        .withIndex('by_campaign_and_operation', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('operationUuid', renamed.receipt.operationId),
        )
        .unique()
      expect(operation?.compensation).toMatchObject({
        type: 'updateMetadata',
        resourceId,
        changes: { title: 'Original' },
        requiredPostconditions: renamed.receipt.postconditions,
      })
    })
    const compensation = {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      originalOperationId: renamed.receipt.operationId,
    }

    await expect(
      asPlayer(campaign).mutation(api.resources.mutations.compensateResourceOperation, {
        ...compensation,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })

    const first = await asDm(campaign).mutation(
      api.resources.mutations.compensateResourceOperation,
      compensation,
    )
    const replay = await asDm(campaign).mutation(
      api.resources.mutations.compensateResourceOperation,
      compensation,
    )
    expect(replay).toEqual(first)

    const secondRename = await asDm(campaign).mutation(
      api.resources.mutations.executeStructureCommand,
      {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'updateMetadata',
          resourceId,
          changes: { title: 'Later edit' },
        },
      },
    )
    if (secondRename.status !== 'completed') throw new Error('Expected second rename completion')
    await expect(
      asDm(campaign).mutation(api.resources.mutations.compensateResourceOperation, {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        originalOperationId:
          first.status === 'completed' ? first.receipt.operationId : compensation.operationId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'history_conflict' })
    await t.run(async (ctx) => {
      const resource = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      expect(resource?.title).toBe('Later edit')
    })
  })

  it('atomically compensates a move from different original parents', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const parentA = await createResource(campaign, campaignUuid, 'folder', null, 'Parent A')
    const parentB = await createResource(campaign, campaignUuid, 'folder', null, 'Parent B')
    const destination = await createResource(campaign, campaignUuid, 'folder', null, 'Destination')
    const childA = await createResource(campaign, campaignUuid, 'note', parentA, 'Child A')
    const childB = await createResource(campaign, campaignUuid, 'note', parentB, 'Child B')
    const moved = await execute(campaign, campaignUuid, {
      type: 'move',
      resourceIds: [childA, childB],
      destinationParentId: destination,
    })
    if (moved.status !== 'completed') throw new Error('Expected move completion')

    const undone = await asDm(campaign).mutation(
      api.resources.mutations.compensateResourceOperation,
      {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        originalOperationId: moved.receipt.operationId,
      },
    )
    if (undone.status !== 'completed') throw new Error(`Expected undo completion: ${undone.reason}`)
    expect(await storedParentIds(childA, childB)).toEqual([parentA, parentB])

    const redone = await asDm(campaign).mutation(
      api.resources.mutations.compensateResourceOperation,
      {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        originalOperationId: undone.receipt.operationId,
      },
    )
    if (redone.status !== 'completed') throw new Error('Expected redo completion')
    expect(await storedParentIds(childA, childB)).toEqual([destination, destination])

    await execute(campaign, campaignUuid, {
      type: 'updateMetadata',
      resourceId: parentA,
      changes: { title: 'Changed parent' },
    })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.compensateResourceOperation, {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        originalOperationId: redone.receipt.operationId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'history_conflict' })
    expect(await storedParentIds(childA, childB)).toEqual([destination, destination])
  })

  it('persists exact closure membership through undo and redo', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const rootId = generateDomainId(DOMAIN_ID_KIND.resource)
    const created = await execute(campaign, campaignUuid, {
      type: 'create',
      resourceId: rootId,
      parentId: null,
      kind: 'folder',
      title: 'Redo root',
      icon: null,
      color: null,
    })
    if (created.status !== 'completed') throw new Error('Expected create completion')
    const undone = await asDm(campaign).mutation(
      api.resources.mutations.compensateResourceOperation,
      {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        originalOperationId: created.receipt.operationId,
      },
    )
    if (undone.status !== 'completed') throw new Error('Expected undo completion')
    const redone = await asDm(campaign).mutation(
      api.resources.mutations.compensateResourceOperation,
      {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        originalOperationId: undone.receipt.operationId,
      },
    )
    if (redone.status !== 'completed') throw new Error('Expected redo completion')
    await t.run(async (ctx) => {
      const operation = await ctx.db
        .query('resourceOperations')
        .withIndex('by_campaign_and_operation', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('operationUuid', redone.receipt.operationId),
        )
        .unique()
      expect(operation?.compensation).toMatchObject({
        type: 'trash',
        resourceIds: [rootId],
        expectedClosureResourceIds: [rootId],
      })
    })
    const laterChild = await createResource(
      campaign,
      campaignUuid,
      'note',
      rootId,
      'Later redo child',
    )

    await expect(
      asDm(campaign).mutation(api.resources.mutations.compensateResourceOperation, {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        originalOperationId: redone.receipt.operationId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'history_conflict' })
    expect(await storedParentIds(laterChild)).toEqual([rootId])
  })

  it('classifies live file bytes independently of generic metadata', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const jobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const metadata = {
      classification: 'viewable_image' as const,
      byteSize: bytes.byteLength,
      detectedFormat: 'png',
      extension: 'bin',
      mediaType: 'image/png',
      viewerUnavailableReason: null,
    }
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([bytes], { type: 'application/octet-stream' }),
      'payload.bin',
    )
    const args = singleFileTransferArgs(
      {
        campaignId: campaignUuid,
        jobId,
        operationId,
        destinationParentId: null,
        uploadSessionId: upload.sessionId,
      },
      'payload.bin',
    )
    const result = await commitTestPlainTransfer(asDm(campaign), args)

    expect(result).toMatchObject({
      status: 'settled',
      entries: [{ status: 'completed', kind: 'file' }],
    })
    const createdEntry = result.status === 'settled' ? result.entries[0] : null
    if (!createdEntry || createdEntry.status !== 'completed') {
      throw new TypeError('Expected completed file transfer')
    }
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, createdEntry.resourceId)
    await expect(
      asDm(campaign).query(api.resources.queries.loadPlainTransfer, {
        campaignId: campaignUuid,
        jobId,
      }),
    ).resolves.toMatchObject({
      status: 'settled',
      jobId,
      entries: [
        {
          status: 'completed',
          resourceId,
          sourceId: 'selected-file',
          sourcePath: 'payload.bin',
        },
      ],
    })
    await expect(commitTestPlainTransfer(asDm(campaign), args)).resolves.toMatchObject({
      status: 'settled',
    })
    const conflictingUpload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([bytes], { type: 'application/octet-stream' }),
      'payload.bin',
    )
    await expect(
      commitTestPlainTransfer(
        asDm(campaign),
        singleFileTransferArgs(
          {
            campaignId: campaignUuid,
            jobId,
            operationId,
            destinationParentId: null,
            uploadSessionId: conflictingUpload.sessionId,
          },
          'payload.bin',
        ),
      ),
    ).resolves.toMatchObject({ status: 'settled' })
    await expect(
      asDm(campaign).query(api.resources.queries.loadPlainTransfer, {
        campaignId: campaignUuid,
        jobId,
      }),
    ).resolves.toMatchObject({
      status: 'settled',
      entries: [{ status: 'completed', resourceId }],
    })
    const rejectedArgs = singleFileTransferArgs(
      {
        campaignId: campaignUuid,
        jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        destinationParentId: null,
        uploadSessionId: upload.sessionId,
      },
      'payload.bin',
    )
    const rejected = await commitTestPlainTransfer(asDm(campaign), rejectedArgs)
    expect(rejected).toMatchObject({
      status: 'settled',
      entries: [{ status: 'rejected' }],
    })
    await expect(commitTestPlainTransfer(asDm(campaign), rejectedArgs)).resolves.toEqual(rejected)
    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      expect(content).toMatchObject({
        state: 'ready',
        assetUuid: upload.assetId,
        ...metadata,
        version: expect.objectContaining({ revision: 1 }),
      })
      await expect(
        ctx.db
          .query('resourceAssetOwners')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
          .unique(),
      ).resolves.toMatchObject({ assetUuid: upload.assetId })
      await expect(
        ctx.db
          .query('resourceSourcePathAliases')
          .withIndex('by_import_entry', (query) =>
            query
              .eq('campaignUuid', campaignUuid)
              .eq('resourceUuid', resourceId)
              .eq('importJobUuid', jobId)
              .eq('sourceRootId', 'selected-file')
              .eq('normalizedPath', 'payload.bin'),
          )
          .unique(),
      ).resolves.toMatchObject({
        rawPath: 'payload.bin',
      })
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadResourcePreview, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toMatchObject({ status: 'ready', preview: { kind: 'file' } })
  })

  it('commits one nested folder, note, and file inventory as one replayable transfer job', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const markdownBytes = new TextEncoder().encode('# Session\n\nArrival notes')
    const fileBytes = Uint8Array.from([0, 1, 2, 3])
    const markdownUpload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([markdownBytes], { type: 'text/markdown' }),
      'Session.md',
    )
    const fileUpload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([fileBytes], { type: 'application/octet-stream' }),
      'evidence.bin',
    )
    const args = {
      campaignId: campaignUuid,
      jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      destinationParentId: null,
      textFileHandling: 'notes' as const,
      sources: [{ id: 'campaign-directory', kind: 'directory' as const, name: 'Campaign' }],
      entries: [
        {
          sourceId: 'campaign-directory',
          path: 'Docs',
          type: 'directory' as const,
        },
        {
          sourceId: 'campaign-directory',
          path: 'Docs/Session.md',
          type: 'file' as const,
          uploadSessionId: markdownUpload.sessionId,
        },
        {
          sourceId: 'campaign-directory',
          path: 'Docs/evidence.bin',
          type: 'file' as const,
          uploadSessionId: fileUpload.sessionId,
        },
      ],
    }

    const result = await commitTestPlainTransfer(asDm(campaign), args)

    if (result.status !== 'settled') {
      throw new TypeError(`Expected settled transfer: ${JSON.stringify(result)}`)
    }
    expect(
      result.entries.map((entry) => ({
        status: entry.status,
        sourcePath: entry.sourcePath,
        kind: entry.status === 'completed' ? entry.kind : null,
      })),
    ).toEqual([
      { status: 'completed', sourcePath: 'Campaign', kind: 'folder' },
      { status: 'completed', sourcePath: 'Campaign/Docs', kind: 'folder' },
      { status: 'completed', sourcePath: 'Campaign/Docs/Session.md', kind: 'note' },
      { status: 'completed', sourcePath: 'Campaign/Docs/evidence.bin', kind: 'file' },
    ])
    const completed = result.entries.filter(
      (entry): entry is Extract<(typeof result.entries)[number], { status: 'completed' }> =>
        entry.status === 'completed',
    )
    const folder = completed.find((entry) => entry.sourcePath === 'Campaign/Docs')
    const note = completed.find((entry) => entry.kind === 'note')
    const file = completed.find((entry) => entry.kind === 'file')
    if (!folder || !note || !file) throw new TypeError('Expected all imported resource kinds')
    const folderId = assertDomainId(DOMAIN_ID_KIND.resource, folder.resourceId)
    const noteId = assertDomainId(DOMAIN_ID_KIND.resource, note.resourceId)
    const fileId = assertDomainId(DOMAIN_ID_KIND.resource, file.resourceId)
    await expect(storedParentIds(noteId, fileId)).resolves.toEqual([folderId, folderId])
    const noteSnapshot = await asDm(campaign).query(api.resources.queries.loadNoteContent, {
      campaignId: campaignUuid,
      resourceId: noteId,
    })
    if (noteSnapshot.status !== 'ready') throw new TypeError('Expected imported note content')
    expect(
      decodeNoteYjsUpdatesToBlocks([{ update: noteSnapshot.update }], NOTE_YJS_FRAGMENT),
    ).toMatchObject([
      { type: 'heading', content: [{ type: 'text', text: 'Session' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Arrival notes' }] },
    ])
    await expect(
      asDm(campaign).query(api.resources.queries.loadFileContent, {
        campaignId: campaignUuid,
        resourceId: fileId,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      content: { attachment: 'attached', byteSize: fileBytes.byteLength, extension: 'bin' },
    })
    await t.run(async (ctx) => {
      await expect(ctx.db.get('fileStorage', markdownUpload.sessionId)).resolves.toBeNull()
      await expect(ctx.storage.get(markdownUpload.storageId)).resolves.toBeNull()
      await expect(ctx.db.get('fileStorage', fileUpload.sessionId)).resolves.toMatchObject({
        status: 'committed',
      })
      await expect(ctx.storage.get(fileUpload.storageId)).resolves.not.toBeNull()
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadPlainTransfer, {
        campaignId: campaignUuid,
        jobId: args.jobId,
      }),
    ).resolves.toMatchObject({
      status: 'settled',
      entries: [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'completed' },
        { status: 'completed' },
      ],
    })
    await expect(
      asDm(campaign).action(api.resources.actions.commitPlainTransfer, {
        campaignId: campaignUuid,
        jobId: args.jobId,
      }),
    ).resolves.toEqual(result)
    await t.run(async (ctx) => {
      const aliases = await ctx.db
        .query('resourceSourcePathAliases')
        .withIndex('by_campaign_and_resource', (query) => query.eq('campaignUuid', campaignUuid))
        .collect()
      expect(aliases.map((alias) => alias.rawPath).sort()).toEqual([
        'Campaign',
        'Campaign/Docs',
        'Campaign/Docs/Session.md',
        'Campaign/Docs/evidence.bin',
      ])
    })
    const partialArgs = {
      ...args,
      jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      sources: [{ id: 'partial-directory', kind: 'directory' as const, name: 'Partial' }],
      entries: [
        {
          sourceId: 'partial-directory',
          path: 'evidence.bin',
          type: 'file' as const,
          uploadSessionId: fileUpload.sessionId,
        },
      ],
    }
    const partial = await commitTestPlainTransfer(asDm(campaign), partialArgs)
    expect(partial).toMatchObject({
      status: 'settled',
      entries: [{ status: 'rejected' }, { status: 'rejected' }],
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadPlainTransfer, {
        campaignId: campaignUuid,
        jobId: partialArgs.jobId,
      }),
    ).resolves.toMatchObject({ status: 'settled' })
    await expect(commitTestPlainTransfer(asDm(campaign), partialArgs)).resolves.toEqual(partial)
  })

  it('rejects limit-plus-one manifests before reserving a job or entries', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const jobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    const entries = Array.from({ length: PLAIN_TRANSFER_LIMITS.maxEntries + 1 }, (_, index) => ({
      sourceId: 'directory',
      path: `${index}.bin`,
      type: 'file' as const,
      byteSize: 0,
    }))

    await expect(
      asDm(campaign).mutation(api.resources.mutations.reservePlainTransfer, {
        campaignId: campaignUuid,
        jobId,
        destinationParentId: null,
        textFileHandling: 'files',
        sources: [{ id: 'directory', kind: 'directory', name: 'Directory' }],
        entries,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_request' })
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resourceTransferJobs')
          .withIndex('by_campaign_and_importJobUuid', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('importJobUuid', jobId),
          )
          .unique(),
      ).resolves.toBeNull()
      await expect(
        ctx.db
          .query('resourceTransferEntries')
          .withIndex('by_campaign_and_job', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('importJobUuid', jobId),
          )
          .take(1),
      ).resolves.toEqual([])
    })
  })

  it('rejects conflicting job reuse while exact reservation replay keeps one plan', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const jobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    const manifest = {
      campaignId: campaignUuid,
      jobId,
      destinationParentId: null,
      textFileHandling: 'files' as const,
      sources: [{ id: 'directory', kind: 'directory' as const, name: 'Directory' }],
      entries: [
        {
          sourceId: 'directory',
          path: 'Folder',
          type: 'directory' as const,
        },
      ],
    }

    const first = await asDm(campaign).mutation(
      api.resources.mutations.reservePlainTransfer,
      manifest,
    )
    await expect(
      asDm(campaign).mutation(api.resources.mutations.reservePlainTransfer, manifest),
    ).resolves.toEqual(first)
    await expect(
      asDm(campaign).mutation(api.resources.mutations.reservePlainTransfer, {
        ...manifest,
        entries: [{ ...manifest.entries[0]!, path: 'Different' }],
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'job_conflict' })
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resourceTransferJobs')
          .withIndex('by_campaign_and_importJobUuid', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('importJobUuid', jobId),
          )
          .unique(),
      ).resolves.not.toBeNull()
      await expect(
        ctx.db
          .query('resourceTransferEntries')
          .withIndex('by_campaign_and_job', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('importJobUuid', jobId),
          )
          .take(PLAIN_TRANSFER_LIMITS.maxEntries + 1),
      ).resolves.toHaveLength(2)
    })
  })

  it('rejects upload metadata mismatches before materializing any resource', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const jobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob(['two bytes']),
      'mismatch.bin',
    )
    const reservation = await asDm(campaign).mutation(
      api.resources.mutations.reservePlainTransfer,
      {
        campaignId: campaignUuid,
        jobId,
        destinationParentId: null,
        textFileHandling: 'files',
        sources: [{ id: 'file', kind: 'file', name: 'mismatch.bin' }],
        entries: [
          {
            sourceId: 'file',
            path: 'mismatch.bin',
            type: 'file',
            byteSize: 1,
          },
        ],
      },
    )
    if (reservation.status !== 'reserved' || !reservation.uploadTargets[0]) {
      throw new TypeError('Expected mismatched upload reservation')
    }
    const plannedResourceId = await t.run(async (ctx) => {
      const entry = await ctx.db
        .query('resourceTransferEntries')
        .withIndex('by_campaign_and_job', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('importJobUuid', jobId),
        )
        .unique()
      if (!entry) throw new TypeError('Expected reserved transfer entry')
      await ctx.db.delete('fileStorage', reservation.uploadTargets[0]!.sessionId)
      await ctx.db.patch('resourceTransferEntries', entry._id, {
        uploadSessionUuid: upload.sessionId,
      })
      return entry.plannedResourceUuid
    })

    await expect(
      asDm(campaign).action(api.resources.actions.commitPlainTransfer, {
        campaignId: campaignUuid,
        jobId,
      }),
    ).resolves.toMatchObject({
      status: 'settled',
      entries: [{ status: 'rejected', reason: 'invalid_source' }],
    })
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resources')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', plannedResourceId))
          .unique(),
      ).resolves.toBeNull()
      await expect(ctx.db.get('fileStorage', upload.sessionId)).resolves.toBeNull()
      await expect(ctx.storage.get(upload.storageId)).resolves.toBeNull()
    })
  })

  it('resumes pending entries after a completed note source has been retired', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const jobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    const noteBytes = new TextEncoder().encode('# Completed')
    const fileBytes = Uint8Array.from([1, 2, 3])
    const noteUpload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([noteBytes]),
      'completed.md',
    )
    const fileUpload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([fileBytes]),
      'pending.bin',
    )
    const reservation = await asDm(campaign).mutation(
      api.resources.mutations.reservePlainTransfer,
      {
        campaignId: campaignUuid,
        jobId,
        destinationParentId: null,
        textFileHandling: 'notes',
        sources: [
          { id: 'note', kind: 'file', name: 'completed.md' },
          { id: 'file', kind: 'file', name: 'pending.bin' },
        ],
        entries: [
          {
            sourceId: 'note',
            path: 'completed.md',
            type: 'file',
            byteSize: noteBytes.byteLength,
          },
          {
            sourceId: 'file',
            path: 'pending.bin',
            type: 'file',
            byteSize: fileBytes.byteLength,
          },
        ],
      },
    )
    if (reservation.status !== 'reserved') {
      throw new TypeError('Expected resumable transfer reservation')
    }
    const planned = await t.run(async (ctx) => {
      const job = await ctx.db
        .query('resourceTransferJobs')
        .withIndex('by_campaign_and_importJobUuid', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('importJobUuid', jobId),
        )
        .unique()
      const entries = await ctx.db
        .query('resourceTransferEntries')
        .withIndex('by_campaign_and_job', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('importJobUuid', jobId),
        )
        .take(PLAIN_TRANSFER_LIMITS.maxEntries + 1)
      const note = entries.find((entry) => entry.sourceRootId === 'note')
      const file = entries.find((entry) => entry.sourceRootId === 'file')
      if (!job || !note || !file) throw new TypeError('Expected resumable transfer plan')
      for (const target of reservation.uploadTargets) {
        await ctx.db.delete('fileStorage', target.sessionId)
      }
      await ctx.db.patch('resourceTransferJobs', job._id, { status: 'running' })
      await ctx.storage.delete(noteUpload.storageId)
      await ctx.db.delete('fileStorage', noteUpload.sessionId)
      await ctx.db.patch('resourceTransferEntries', note._id, {
        status: 'completed',
        resourceKind: 'note',
        resourceUuid: note.plannedResourceUuid,
        uploadSessionUuid: null,
      })
      await ctx.db.patch('resourceTransferEntries', file._id, {
        uploadSessionUuid: fileUpload.sessionId,
      })
      return {
        fileResourceId: file.plannedResourceUuid,
        noteResourceId: note.plannedResourceUuid,
      }
    })

    const result = await asDm(campaign).action(api.resources.actions.commitPlainTransfer, {
      campaignId: campaignUuid,
      jobId,
    })
    expect(result).toMatchObject({
      status: 'settled',
      entries: [
        {
          status: 'completed',
          resourceId: planned.fileResourceId,
          kind: 'file',
        },
        {
          status: 'completed',
          resourceId: planned.noteResourceId,
          kind: 'note',
        },
      ],
    })
    await expect(
      asDm(campaign).action(api.resources.actions.commitPlainTransfer, {
        campaignId: campaignUuid,
        jobId,
      }),
    ).resolves.toEqual(result)
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resources')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', planned.fileResourceId))
          .unique(),
      ).resolves.not.toBeNull()
      await expect(ctx.db.get('fileStorage', fileUpload.sessionId)).resolves.toMatchObject({
        status: 'committed',
      })
    })
  })

  it('replaces file content once, advances its version, and retires the previous asset', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const original = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob(['original'], { type: 'text/plain' }),
      'evidence.txt',
    )
    const created = await commitTestPlainTransfer(
      asDm(campaign),
      singleFileTransferArgs({
        campaignId: campaignUuid,
        jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
        operationId,
        destinationParentId: null,
        uploadSessionId: original.sessionId,
      }),
    )
    const createdEntry = created.status === 'settled' ? created.entries[0] : null
    if (!createdEntry || createdEntry.status !== 'completed') {
      throw new TypeError('Expected completed file transfer')
    }
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, createdEntry.resourceId)
    const expectedVersion = await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      if (!content) throw new TypeError('Expected file content')
      return content.version
    })
    const replacement = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob(['replacement'], { type: 'text/plain' }),
      'replacement.txt',
    )
    const args = {
      campaignId: campaignUuid,
      resourceId,
      expectedVersion,
      uploadSessionId: replacement.sessionId,
    }

    const result = await asDm(campaign).action(api.resources.actions.replaceFileContent, args)
    expect(result).toMatchObject({
      status: 'completed',
      content: { attachment: 'attached', byteSize: 11, extension: 'txt' },
      version: { revision: 2 },
    })
    await expect(
      asDm(campaign).action(api.resources.actions.replaceFileContent, args),
    ).resolves.toEqual(result)

    const retirementCandidateId = await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      expect(content).toMatchObject({
        assetUuid: replacement.assetId,
        byteSize: 11,
        extension: 'txt',
        version: { revision: 2 },
      })
      await expect(
        ctx.db
          .query('resourceAssetOwners')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
          .unique(),
      ).resolves.toMatchObject({ assetUuid: replacement.assetId })
      const candidate = await ctx.db
        .query('resourceAssetRetirementCandidates')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
        .unique()
      expect(candidate).toMatchObject({ status: 'pending' })
      const history = await ctx.db
        .query('itemHistoryEntries')
        .withIndex('by_resource_action_history', (query) =>
          query
            .eq('campaignUuid', campaignUuid)
            .eq('resourceUuid', resourceId)
            .eq('action', ITEM_HISTORY_ACTION.fileReplaced),
        )
        .collect()
      expect(history).toHaveLength(1)
      return candidate!._id
    })

    await t.action(internal.resources.internalActions.processAssetRetirement, {
      candidateId: retirementCandidateId,
    })
    await t.run(async (ctx) => {
      await expect(ctx.db.get('fileStorage', original.sessionId)).resolves.toBeNull()
      await expect(ctx.storage.get(original.storageId)).resolves.toBeNull()
    })
  })

  it('binds one upload to one resource across create, replace, campaign, and deletion lifecycles', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const otherCampaign = await createCampaignWithDm(t, campaign.dm.profile)
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob(['exclusive'], { type: 'text/plain' }),
      'exclusive.txt',
    )
    const ownerJobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    const ownerOperationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const ownerArgs = singleFileTransferArgs({
      campaignId: campaignUuid,
      jobId: ownerJobId,
      operationId: ownerOperationId,
      destinationParentId: null,
      uploadSessionId: upload.sessionId,
    })
    const created = await commitTestPlainTransfer(asDm(campaign), ownerArgs)
    expect(created).toMatchObject({ status: 'settled' })
    const ownerEntry = created.status === 'settled' ? created.entries[0] : null
    if (!ownerEntry || ownerEntry.status !== 'completed') {
      throw new TypeError('Expected completed file transfer')
    }
    const ownerResourceId = assertDomainId(DOMAIN_ID_KIND.resource, ownerEntry.resourceId)
    await expect(commitTestPlainTransfer(asDm(campaign), ownerArgs)).resolves.toEqual(created)

    await expect(
      commitTestPlainTransfer(
        asDm(campaign),
        singleFileTransferArgs({
          campaignId: campaignUuid,
          jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
          operationId: generateDomainId(DOMAIN_ID_KIND.operation),
          destinationParentId: null,
          uploadSessionId: upload.sessionId,
        }),
      ),
    ).resolves.toMatchObject({ status: 'settled', entries: [{ status: 'rejected' }] })

    await expect(
      commitTestPlainTransfer(
        campaign.dm.authed,
        singleFileTransferArgs({
          campaignId: otherCampaign.campaignDomainId,
          jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
          operationId: generateDomainId(DOMAIN_ID_KIND.operation),
          destinationParentId: null,
          uploadSessionId: upload.sessionId,
        }),
      ),
    ).resolves.toMatchObject({ status: 'settled', entries: [{ status: 'rejected' }] })

    const ownerVersion = await storedFileVersion(ownerResourceId)
    await expect(
      asDm(campaign).action(api.resources.actions.replaceFileContent, {
        campaignId: campaignUuid,
        resourceId: ownerResourceId,
        expectedVersion: ownerVersion,
        uploadSessionId: upload.sessionId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_file' })

    const replacementTargetId = await createResource(
      campaign,
      campaignUuid,
      'file',
      null,
      'Replacement target',
    )
    await expect(
      asDm(campaign).action(api.resources.actions.replaceFileContent, {
        campaignId: campaignUuid,
        resourceId: replacementTargetId,
        expectedVersion: await storedFileVersion(replacementTargetId),
        uploadSessionId: upload.sessionId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_file' })

    const crossCampaignUpload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob(['other'], { type: 'text/plain' }),
      'other.txt',
    )
    const crossCampaignCreated = await commitTestPlainTransfer(
      campaign.dm.authed,
      singleFileTransferArgs({
        campaignId: otherCampaign.campaignDomainId,
        jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        destinationParentId: null,
        uploadSessionId: crossCampaignUpload.sessionId,
      }),
    )
    const crossCampaignEntry =
      crossCampaignCreated.status === 'settled' ? crossCampaignCreated.entries[0] : null
    if (!crossCampaignEntry || crossCampaignEntry.status !== 'completed') {
      throw new TypeError('Expected completed cross-campaign file transfer')
    }
    const crossCampaignTargetId = assertDomainId(
      DOMAIN_ID_KIND.resource,
      crossCampaignEntry.resourceId,
    )
    await expect(
      campaign.dm.authed.action(api.resources.actions.replaceFileContent, {
        campaignId: otherCampaign.campaignDomainId,
        resourceId: crossCampaignTargetId,
        expectedVersion: await storedFileVersion(crossCampaignTargetId),
        uploadSessionId: upload.sessionId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_file' })

    await t.run(async (ctx) => {
      const owners = await ctx.db
        .query('resourceAssetOwners')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', upload.assetId))
        .take(2)
      expect(owners).toEqual([
        expect.objectContaining({ campaignUuid, resourceUuid: ownerResourceId }),
      ])
    })
    const integrity = await t.query(internal.resources.integrity.diagnose, {
      diagnostic: { type: 'dangling_domain_asset', source: 'owner' },
      cursor: null,
      limit: 1_000,
    })
    expect(integrity.issues).not.toContainEqual(
      expect.objectContaining({ assetUuid: upload.assetId }),
    )

    await execute(campaign, campaignUuid, { type: 'trash', resourceIds: [ownerResourceId] })
    await execute(campaign, campaignUuid, {
      type: 'permanentlyDelete',
      resourceIds: [ownerResourceId],
    })
    const retirementCandidateId = await t.run(async (ctx) => {
      const candidate = await ctx.db
        .query('resourceAssetRetirementCandidates')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', upload.assetId))
        .unique()
      expect(candidate).toMatchObject({ status: 'pending' })
      return candidate!._id
    })
    await t.action(internal.resources.internalActions.processAssetRetirement, {
      candidateId: retirementCandidateId,
    })
    await t.run(async (ctx) => {
      await expect(ctx.db.get('fileStorage', upload.sessionId)).resolves.toBeNull()
      await expect(ctx.storage.get(upload.storageId)).resolves.toBeNull()
      await expect(
        ctx.db
          .query('resourceAssetOwners')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', upload.assetId))
          .unique(),
      ).resolves.toBeNull()
    })
  })

  it('serializes concurrent create claims for one upload', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob(['concurrent create'], { type: 'text/plain' }),
      'concurrent.txt',
    )
    const jobs = [
      generateDomainId(DOMAIN_ID_KIND.importJob),
      generateDomainId(DOMAIN_ID_KIND.importJob),
    ] as const
    const results = await Promise.all(
      jobs.map(
        async (jobId) =>
          await commitTestPlainTransfer(
            asDm(campaign),
            singleFileTransferArgs({
              campaignId: campaignUuid,
              jobId,
              operationId: generateDomainId(DOMAIN_ID_KIND.operation),
              destinationParentId: null,
              uploadSessionId: upload.sessionId,
            }),
          ),
      ),
    )
    expect(
      results.map(({ status }) => status).sort((left, right) => left.localeCompare(right)),
    ).toEqual(['settled', 'settled'])
    expect(results).toContainEqual(
      expect.objectContaining({ entries: [expect.objectContaining({ status: 'rejected' })] }),
    )

    await t.run(async (ctx) => {
      const owners = await ctx.db
        .query('resourceAssetOwners')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', upload.assetId))
        .take(2)
      expect(owners).toHaveLength(1)
      await expect(
        ctx.db
          .query('resourceFileContents')
          .withIndex('by_resourceUuid', (query) =>
            query.eq('resourceUuid', owners[0]!.resourceUuid),
          )
          .unique(),
      ).resolves.toMatchObject({ assetUuid: upload.assetId })
    })
  })

  it('settles cancellation by job identity and preserves its truthful receipt on retry', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const jobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    const bytes = new TextEncoder().encode('cancelled transfer')
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([bytes], { type: 'text/plain' }),
      'cancelled.txt',
    )
    await asDm(campaign).mutation(api.resources.mutations.reservePlainTransfer, {
      campaignId: campaignUuid,
      jobId,
      destinationParentId: null,
      textFileHandling: 'files',
      sources: [{ id: 'selected-file', kind: 'file', name: 'cancelled.txt' }],
      entries: [
        {
          sourceId: 'selected-file',
          path: 'cancelled.txt',
          type: 'file',
          byteSize: bytes.byteLength,
        },
      ],
    })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.cancelPlainTransfer, {
        campaignId: campaignUuid,
        jobId,
      }),
    ).resolves.toMatchObject({
      status: 'settled',
      entries: [{ status: 'cancelled' }],
    })
    await expect(
      asDm(campaign).action(api.resources.actions.commitPlainTransfer, {
        campaignId: campaignUuid,
        jobId,
      }),
    ).resolves.toMatchObject({
      status: 'settled',
      entries: [{ status: 'cancelled' }],
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadPlainTransfer, {
        campaignId: campaignUuid,
        jobId,
      }),
    ).resolves.toMatchObject({
      status: 'settled',
      entries: [
        {
          status: 'cancelled',
          sourceId: 'selected-file',
          sourcePath: 'cancelled.txt',
        },
      ],
    })
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resourceAssetOwners')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', upload.assetId))
          .unique(),
      ).resolves.toBeNull()
      await expect(ctx.db.get('fileStorage', upload.sessionId)).resolves.toMatchObject({
        status: 'uncommitted',
      })
    })
  })

  it('preserves completed entries when cancellation settles the remaining plan', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const jobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    const reservation = await asDm(campaign).mutation(
      api.resources.mutations.reservePlainTransfer,
      {
        campaignId: campaignUuid,
        jobId,
        destinationParentId: null,
        textFileHandling: 'files',
        sources: [{ id: 'directory', kind: 'directory', name: 'Bundle' }],
        entries: [
          { sourceId: 'directory', path: 'First', type: 'directory' },
          { sourceId: 'directory', path: 'Second', type: 'directory' },
        ],
      },
    )
    if (reservation.status !== 'reserved') {
      throw new TypeError('Expected partial cancellation reservation')
    }
    const completed = await t.run(async (ctx) => {
      const entries = await ctx.db
        .query('resourceTransferEntries')
        .withIndex('by_campaign_and_job', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('importJobUuid', jobId),
        )
        .take(PLAIN_TRANSFER_LIMITS.maxEntries + 1)
      const entry = entries.find((candidate) => candidate.rawPath === 'Bundle/First')
      if (!entry) throw new TypeError('Expected first transfer entry')
      await ctx.db.patch('resourceTransferEntries', entry._id, {
        status: 'completed',
        resourceKind: 'folder',
        resourceUuid: entry.plannedResourceUuid,
      })
      return entry
    })

    const cancelled = await asDm(campaign).mutation(api.resources.mutations.cancelPlainTransfer, {
      campaignId: campaignUuid,
      jobId,
    })
    expect(cancelled.status).toBe('settled')
    if (cancelled.status !== 'settled') return
    expect(cancelled.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'completed',
          sourcePath: 'Bundle/First',
          resourceId: completed.plannedResourceUuid,
          kind: 'folder',
        }),
        expect.objectContaining({ status: 'cancelled', sourcePath: 'Bundle' }),
        expect.objectContaining({ status: 'cancelled', sourcePath: 'Bundle/Second' }),
      ]),
    )
    await expect(
      asDm(campaign).mutation(api.resources.mutations.cancelPlainTransfer, {
        campaignId: campaignUuid,
        jobId,
      }),
    ).resolves.toEqual(cancelled)
  })

  it('serializes concurrent replacement claims and preserves exact response replay', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceIds = await Promise.all([
      createResource(campaign, campaignUuid, 'file', null, 'First'),
      createResource(campaign, campaignUuid, 'file', null, 'Second'),
    ])
    const versions = await Promise.all(resourceIds.map(storedFileVersion))
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob(['concurrent replacement'], { type: 'text/plain' }),
      'replacement.txt',
    )
    const replacements = resourceIds.map((resourceId, index) => ({
      campaignId: campaignUuid,
      resourceId,
      expectedVersion: versions[index]!,
      uploadSessionId: upload.sessionId,
    }))
    const results = await Promise.all(
      replacements.map((args) =>
        asDm(campaign).action(api.resources.actions.replaceFileContent, args),
      ),
    )
    expect(results.map(({ status }) => status).sort()).toEqual(['completed', 'rejected'])
    expect(results).toContainEqual({ status: 'rejected', reason: 'invalid_file' })
    const winnerIndex = results.findIndex(({ status }) => status === 'completed')
    const loserIndex = winnerIndex === 0 ? 1 : 0
    await expect(
      asDm(campaign).action(api.resources.actions.replaceFileContent, replacements[winnerIndex]!),
    ).resolves.toEqual(results[winnerIndex])
    await expect(
      asDm(campaign).action(api.resources.actions.replaceFileContent, replacements[loserIndex]!),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_file' })

    await t.run(async (ctx) => {
      const owners = await ctx.db
        .query('resourceAssetOwners')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', upload.assetId))
        .take(2)
      expect(owners).toEqual([
        expect.objectContaining({ campaignUuid, resourceUuid: resourceIds[winnerIndex] }),
      ])
      const contents = await Promise.all(
        resourceIds.map((resourceId) =>
          ctx.db
            .query('resourceFileContents')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .unique(),
        ),
      )
      expect(contents[winnerIndex]).toMatchObject({
        assetUuid: upload.assetId,
        version: { revision: versions[winnerIndex]!.revision + 1 },
      })
      expect(contents[loserIndex]?.version).toEqual(versions[loserIndex])
      expect(contents[loserIndex]?.assetUuid).not.toBe(upload.assetId)
    })
  })

  it('rejects a stale file replacement before committing its upload', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = await createResource(campaign, campaignUuid, 'file', null, 'File')
    const currentVersion = await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      if (!content) throw new TypeError('Expected file content')
      return content.version
    })
    const staleVersion = { ...currentVersion, revision: currentVersion.revision + 1 }
    const replacement = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob(['replacement'], { type: 'text/plain' }),
      'replacement.txt',
    )

    await expect(
      asDm(campaign).action(api.resources.actions.replaceFileContent, {
        campaignId: campaignUuid,
        resourceId,
        expectedVersion: staleVersion,
        uploadSessionId: replacement.sessionId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'version_conflict' })
    await t.run(async (ctx) => {
      await expect(ctx.db.get('fileStorage', replacement.sessionId)).resolves.toMatchObject({
        status: 'uncommitted',
      })
    })
  })

  it('replaces opaque map bytes idempotently, advances the version, and retires old assets', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = await createResource(campaign, campaignUuid, 'map', null, 'Map')
    const initialVersion = await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceMapContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      if (!content) throw new TypeError('Expected map content')
      return content.version
    })
    const originalBytes = Uint8Array.from([0, 1, 2, 3])
    const original = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([Uint8Array.from(originalBytes).buffer], {
        type: 'application/octet-stream',
      }),
      'payload.bin',
    )
    const originalArgs = {
      campaignId: campaignUuid,
      resourceId,
      expectedVersion: initialVersion,
      layerId: null,
      uploadSessionId: original.sessionId,
    }
    const attached = await asDm(campaign).action(
      api.resources.actions.replaceMapImage,
      originalArgs,
    )
    expect(attached).toMatchObject({
      status: 'completed',
      content: {
        image: {
          status: 'attached',
          byteSize: originalBytes.byteLength,
          mediaType: 'application/octet-stream',
        },
      },
      version: { revision: 2 },
    })
    await expect(
      asDm(campaign).action(api.resources.actions.replaceMapImage, originalArgs),
    ).resolves.toEqual(attached)
    if (attached.status !== 'completed') throw new TypeError('Expected attached map image')

    const otherMapId = await createResource(campaign, campaignUuid, 'map', null, 'Other map')
    await expect(
      asDm(campaign).action(api.resources.actions.replaceMapImage, {
        campaignId: campaignUuid,
        resourceId: otherMapId,
        expectedVersion: await storedMapVersion(otherMapId),
        layerId: null,
        uploadSessionId: original.sessionId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_command' })
    const fileId = await createResource(campaign, campaignUuid, 'file', null, 'File')
    await expect(
      asDm(campaign).action(api.resources.actions.replaceFileContent, {
        campaignId: campaignUuid,
        resourceId: fileId,
        expectedVersion: await storedFileVersion(fileId),
        uploadSessionId: original.sessionId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_file' })
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resourceAssetOwners')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
          .take(2),
      ).resolves.toEqual([expect.objectContaining({ campaignUuid, resourceUuid: resourceId })])
    })

    const replacementBytes = testPng(2, 3)
    const replacement = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([Uint8Array.from(replacementBytes).buffer], { type: 'image/png' }),
      'replacement.png',
    )
    const replaced = await asDm(campaign).action(api.resources.actions.replaceMapImage, {
      ...originalArgs,
      expectedVersion: attached.version,
      uploadSessionId: replacement.sessionId,
    })
    expect(replaced).toMatchObject({ status: 'completed', version: { revision: 3 } })

    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resourceMapContents')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
          .unique(),
      ).resolves.toMatchObject({
        image: {
          assetUuid: replacement.assetId,
          byteSize: replacementBytes.byteLength,
          mediaType: 'image/png',
        },
        version: { revision: 3 },
      })
      await expect(
        ctx.db
          .query('resourceAssetOwners')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
          .unique(),
      ).resolves.toMatchObject({ assetUuid: replacement.assetId })
      await expect(
        ctx.db
          .query('resourceAssetRetirementCandidates')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
          .unique(),
      ).resolves.toMatchObject({ status: 'pending' })
    })
    const stale = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([Uint8Array.from(testPng(4, 4)).buffer], { type: 'image/png' }),
      'stale.png',
    )
    await expect(
      asDm(campaign).action(api.resources.actions.replaceMapImage, {
        ...originalArgs,
        uploadSessionId: stale.sessionId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'version_conflict' })
    await t.run(async (ctx) => {
      await expect(ctx.db.get('fileStorage', stale.sessionId)).resolves.toMatchObject({
        status: 'uncommitted',
      })
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadMapImage, {
        campaignId: campaignUuid,
        resourceId,
        layerId: null,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      image: {
        status: 'attached',
        byteSize: replacementBytes.byteLength,
        mediaType: 'image/png',
      },
      version: { revision: 3 },
      url: expect.any(String),
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadResourcePreview, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toMatchObject({ status: 'ready', preview: { kind: 'map' } })
  })

  it('retains replaced map assets until bounded history cleanup releases them', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = await createResource(campaign, campaignUuid, 'map', null, 'Shared map')
    const originalBytes = testPng(1, 1)
    const original = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([Uint8Array.from(originalBytes).buffer], { type: 'image/png' }),
      'shared.png',
    )
    const attached = await asDm(campaign).action(api.resources.actions.replaceMapImage, {
      campaignId: campaignUuid,
      resourceId,
      expectedVersion: await storedMapVersion(resourceId),
      layerId: null,
      uploadSessionId: original.sessionId,
    })
    if (attached.status !== 'completed') throw new TypeError('Expected attached map image')
    const sharedLayerId = 'shared-layer'
    const sharedVersion = await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceMapContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      if (!content?.image) throw new TypeError('Expected attached map content')
      const layers = [{ id: sharedLayerId, name: 'Shared layer', image: content.image }]
      const projected = projectMapContent({ image: content.image, layers }, [])
      const version = await advanceMapContentVersion(assertVersionStamp(content.version), projected)
      await ctx.db.patch('resourceMapContents', content._id, { layers, version })
      return version
    })
    const replacementUploads = await Promise.all(
      [testPng(2, 3), testPng(4, 4)].map((bytes, index) =>
        storeUncommittedTestUploadSession(
          t,
          campaign.dm.profile._id,
          new Blob([Uint8Array.from(bytes).buffer], { type: 'image/png' }),
          `replacement-${index}.png`,
        ),
      ),
    )
    const attempts = [
      { layerId: null, uploadSessionId: replacementUploads[0]!.sessionId },
      { layerId: sharedLayerId, uploadSessionId: replacementUploads[1]!.sessionId },
    ] as const
    const results = await Promise.all(
      attempts.map((attempt) =>
        asDm(campaign).action(api.resources.actions.replaceMapImage, {
          campaignId: campaignUuid,
          resourceId,
          expectedVersion: sharedVersion,
          ...attempt,
        }),
      ),
    )
    const winnerIndex = results.findIndex((result) => result.status === 'completed')
    const loserIndex = results.findIndex(
      (result) => result.status === 'rejected' && result.reason === 'version_conflict',
    )
    expect([winnerIndex, loserIndex].sort((left, right) => left - right)).toEqual([0, 1])
    const winner = results[winnerIndex]!
    if (winner.status !== 'completed') throw new TypeError('Expected one completed replacement')

    await expect(
      asDm(campaign).action(api.resources.actions.replaceMapImage, {
        campaignId: campaignUuid,
        resourceId,
        expectedVersion: sharedVersion,
        ...attempts[winnerIndex]!,
      }),
    ).resolves.toEqual(winner)

    const remainingLayerId = attempts[loserIndex]!.layerId
    await expect(
      asDm(campaign).query(api.resources.queries.loadMapImage, {
        campaignId: campaignUuid,
        resourceId,
        layerId: remainingLayerId,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      image: { status: 'attached', byteSize: originalBytes.byteLength },
      url: expect.any(String),
    })
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resourceAssetOwners')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
          .take(2),
      ).resolves.toEqual([expect.objectContaining({ resourceUuid: resourceId })])
      await expect(
        ctx.db
          .query('resourceAssetRetirementCandidates')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
          .unique(),
      ).resolves.toBeNull()
    })

    const finalReplacementArgs = {
      campaignId: campaignUuid,
      resourceId,
      expectedVersion: winner.version,
      layerId: remainingLayerId,
      uploadSessionId: replacementUploads[loserIndex]!.sessionId,
    }
    const finalReplacement = await asDm(campaign).action(
      api.resources.actions.replaceMapImage,
      finalReplacementArgs,
    )
    expect(finalReplacement).toMatchObject({ status: 'completed' })
    const retirementCandidateId = await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resourceAssetOwners')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
          .unique(),
      ).resolves.toBeNull()
      await expect(
        ctx.db
          .query('resourceAssetRetirementCandidates')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
          .take(2),
      ).resolves.toEqual([expect.objectContaining({ status: 'pending' })])
      const candidate = await ctx.db
        .query('resourceAssetRetirementCandidates')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
        .unique()
      return candidate!._id
    })
    await expect(
      asDm(campaign).action(api.resources.actions.replaceMapImage, finalReplacementArgs),
    ).resolves.toEqual(finalReplacement)
    await t.action(internal.resources.internalActions.processAssetRetirement, {
      candidateId: retirementCandidateId,
    })
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resourceAssetRetirementCandidates')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
          .unique(),
      ).resolves.toBeNull()
      await expect(
        ctx.db
          .query('itemHistoryCheckpointAssets')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
          .first(),
      ).resolves.toMatchObject({ assetUuid: original.assetId })
      await expect(ctx.db.get('fileStorage', original.sessionId)).resolves.toMatchObject({
        status: 'committed',
      })
      await expect(ctx.storage.get(original.storageId)).resolves.toEqual(expect.any(Blob))
      const imageEntries = await ctx.db
        .query('itemHistoryEntries')
        .withIndex('by_resource_action_history', (query) =>
          query
            .eq('campaignUuid', campaignUuid)
            .eq('resourceUuid', resourceId)
            .eq('action', ITEM_HISTORY_ACTION.mapImageChanged),
        )
        .collect()
      expect(imageEntries).toHaveLength(3)
      expect(imageEntries.map((entry) => entry.metadata)).toEqual(
        expect.arrayContaining([
          { layerId: null },
          { layerId: attempts[winnerIndex]!.layerId },
          { layerId: remainingLayerId },
        ]),
      )
    })

    const restoreOperationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const restoredHistoryEntryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const preservedSnapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)
    await t.run(async (ctx) => {
      await ctx.db.insert('itemHistoryRestoreOperations', {
        campaignUuid,
        actorMemberUuid: campaign.dm.memberDomainId,
        resourceUuid: resourceId,
        operationUuid: restoreOperationId,
        protocolVersion: ITEM_HISTORY_RESTORE_PROTOCOL_VERSION,
        fingerprint: '0'.repeat(64),
        receipt: {
          status: 'restored',
          operationId: restoreOperationId,
          historyEntryId: restoredHistoryEntryId,
          preservedSnapshotId,
          restoredFromEntryId: restoredHistoryEntryId,
        },
      })
    })
    await expect(
      execute(campaign, campaignUuid, { type: 'trash', resourceIds: [resourceId] }),
    ).resolves.toMatchObject({ status: 'completed' })
    await expect(
      execute(campaign, campaignUuid, {
        type: 'permanentlyDelete',
        resourceIds: [resourceId],
      }),
    ).resolves.toMatchObject({ status: 'completed' })
    let cleanupStage: ItemHistoryCleanupStage | null = 'restoreOperations'
    while (cleanupStage) {
      const stage: ItemHistoryCleanupStage = cleanupStage
      cleanupStage = await t.run(
        async (ctx): Promise<ItemHistoryCleanupStage | null> =>
          await deleteResourceItemHistoryBatch(
            ctx,
            assertDomainId(DOMAIN_ID_KIND.campaign, campaignUuid),
            resourceId,
            stage,
          ),
      )
    }
    const originalRetirementCandidateId = await t.run(async (ctx) => {
      const candidate = await ctx.db
        .query('resourceAssetRetirementCandidates')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
        .unique()
      if (!candidate) throw new TypeError('Expected original asset retirement candidate')
      return candidate._id
    })
    await t.action(internal.resources.internalActions.processAssetRetirement, {
      candidateId: originalRetirementCandidateId,
    })
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('itemHistoryRestoreOperations')
          .withIndex('by_resource', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('resourceUuid', resourceId),
          )
          .unique(),
      ).resolves.toBeNull()
      await expect(
        ctx.db
          .query('itemHistoryCheckpointAssets')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', original.assetId))
          .first(),
      ).resolves.toBeNull()
      await expect(ctx.db.get('fileStorage', original.sessionId)).resolves.toBeNull()
      await expect(ctx.storage.get(original.storageId)).resolves.toBeNull()
    })
  })

  it('executes one idempotent bounded map-pin command path', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const mapId = await createResource(campaign, campaignUuid, 'map', null, 'Map')
    const targetId = await createResource(campaign, campaignUuid, 'note', null, 'Target')
    const pinId = generateDomainId(DOMAIN_ID_KIND.mapPin)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const initialVersion = await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceMapContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', mapId))
        .unique()
      if (!content) throw new TypeError('Expected map content')
      return content.version
    })
    const createArgs = {
      campaignId: campaignUuid,
      resourceId: mapId,
      operationId,
      expectedVersion: initialVersion,
      command: {
        type: 'createPins' as const,
        pins: [
          {
            id: pinId,
            destination: {
              kind: 'internal' as const,
              target: { kind: 'resource' as const, resourceId: targetId },
            },
            layerId: null,
            x: 25,
            y: 40,
          },
        ],
      },
    }
    const created = await asDm(campaign).mutation(
      api.resources.mutations.executeMapContentCommand,
      createArgs,
    )
    expect(created).toMatchObject({
      status: 'completed',
      content: {
        pins: [{ id: pinId, x: 25, y: 40, visible: true }],
      },
      version: { revision: 2 },
    })
    if (created.status !== 'completed') throw new TypeError('Expected pin creation')
    await t.run(async (ctx) => {
      const edge = await ctx.db
        .query('resourceReferenceEdges')
        .withIndex('by_campaign_and_source', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('sourceResourceUuid', mapId),
        )
        .unique()
      expect(edge).toMatchObject({
        sourceVersion: created.version,
        target: { kind: 'resource', resourceId: targetId },
      })
    })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeMapContentCommand, createArgs),
    ).resolves.toEqual(created)
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeMapContentCommand, {
        ...createArgs,
        command: { type: 'removePin', pinId },
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'operation_id_reused' })
    let version = created.version
    for (let index = 0; index < 35; index += 1) {
      const result = await asDm(campaign).mutation(
        api.resources.mutations.executeMapContentCommand,
        {
          campaignId: campaignUuid,
          resourceId: mapId,
          operationId: generateDomainId(DOMAIN_ID_KIND.operation),
          expectedVersion: version,
          command: { type: 'setPinVisibility', pinId, visible: index % 2 === 0 },
        },
      )
      if (result.status !== 'completed') throw new TypeError('Expected visibility update')
      version = result.version
    }
    const moved = await asDm(campaign).mutation(api.resources.mutations.executeMapContentCommand, {
      campaignId: campaignUuid,
      resourceId: mapId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      expectedVersion: version,
      command: { type: 'movePin', pinId, x: 80, y: 90 },
    })
    expect(moved).toMatchObject({
      status: 'completed',
      content: { pins: [{ id: pinId, x: 80, y: 90 }] },
    })
    if (moved.status !== 'completed') throw new TypeError('Expected pin move')
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeMapContentCommand, {
        campaignId: campaignUuid,
        resourceId: mapId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        expectedVersion: moved.version,
        command: { type: 'removePin', pinId },
      }),
    ).resolves.toMatchObject({ status: 'completed', content: { pins: [] } })
    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceMapContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', mapId))
        .unique()
      expect(content?.recentOperations).toHaveLength(32)
      expect(
        await ctx.db
          .query('resourceReferenceEdges')
          .withIndex('by_campaign_and_source', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('sourceResourceUuid', mapId),
          )
          .collect(),
      ).toEqual([])
      await expect(
        ctx.db
          .query('resourceMapPins')
          .withIndex('by_mapResourceUuid', (query) => query.eq('mapResourceUuid', mapId))
          .unique(),
      ).resolves.toBeNull()
      const entries = await ctx.db
        .query('itemHistoryEntries')
        .withIndex('by_resource_history', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('resourceUuid', mapId),
        )
        .collect()
      const checkpoints = await ctx.db
        .query('itemHistoryCheckpoints')
        .withIndex('by_resource_snapshot', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('resourceUuid', mapId),
        )
        .collect()
      expect(entries).toHaveLength(39)
      expect(checkpoints).toHaveLength(38)
      expect(
        entries.filter((entry) => entry.action === ITEM_HISTORY_ACTION.mapPinVisibilityChanged),
      ).toHaveLength(35)
      expect(
        entries
          .map((entry) => entry.metadata)
          .filter((metadata) => metadata !== null && 'pinLabel' in metadata),
      ).toEqual(Array.from({ length: 38 }, () => expect.objectContaining({ pinLabel: 'Target' })))
      const removed = entries.find((entry) => entry.action === ITEM_HISTORY_ACTION.mapPinRemoved)
      if (removed?.action !== ITEM_HISTORY_ACTION.mapPinRemoved) {
        throw new TypeError('Expected removed pin history')
      }
      const removedCheckpoint = checkpoints.find(
        (checkpoint) => checkpoint.snapshotUuid === removed.checkpoint.snapshotId,
      )
      expect(removedCheckpoint).toMatchObject({
        kind: 'map',
        pins: [],
        version: removed.checkpoint.version,
      })
    })
  })

  it('rejects kind-owned creation through the generic structure mutation', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const args = {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'create' as const,
        resourceId,
        kind: 'note' as const,
        parentId: null,
        title: '  Session\r\nNotes  ',
        icon: null,
        color: null,
      },
    }

    const result = await asDm(campaign).mutation(
      api.resources.mutations.executeStructureCommand,
      args,
    )
    expect(result).toEqual({ status: 'rejected', reason: 'invalid_command' })
    await t.run(async (ctx) => {
      expect(
        await ctx.db
          .query('resources')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
          .unique(),
      ).toBeNull()
    })
  })

  it('creates a note and its content atomically and rejects operation replay with replacement content', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const command = {
      type: 'create' as const,
      resourceId,
      kind: 'note' as const,
      parentId: null,
      title: 'Note',
      icon: null,
      color: null,
    }
    const update = makeYjsUpdateWithBlocks([
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Local edit' }],
      },
    ])
    const args = { campaignId: campaignUuid, operationId, command, update }

    const first = await asDm(campaign).mutation(api.resources.mutations.createNoteResource, args)
    const replay = await asDm(campaign).mutation(api.resources.mutations.createNoteResource, args)

    expect(first).toEqual(
      expect.objectContaining({
        status: 'completed',
        receipt: expect.objectContaining({ operationId }),
      }),
    )
    expect(replay).toEqual(first)
    await expect(
      asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
        ...args,
        update: makeYjsUpdateWithBlocks([
          {
            id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
            type: 'paragraph',
            content: [{ type: 'text', text: 'Replacement' }],
          },
        ]),
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'operation_id_reused' })
    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      expect(content).toEqual(
        expect.objectContaining({
          creationOperationUuid: operationId,
          version: await initialNoteContentVersion(new Uint8Array(update)),
        }),
      )
    })
  })

  it('merges large concurrent canonical note updates and advances the content revision', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const baseUpdate = makeYjsUpdateWithBlocks([
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Middle' }],
      },
    ])
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'create',
        resourceId,
        kind: 'note',
        parentId: null,
        title: 'Collaborative note',
        icon: null,
        color: null,
      },
      update: baseUpdate,
    })

    const firstClient = new Y.Doc()
    const secondClient = new Y.Doc()
    Y.applyUpdate(firstClient, new Uint8Array(baseUpdate))
    Y.applyUpdate(secondClient, new Uint8Array(baseUpdate))
    const firstDeltas: Array<Uint8Array> = []
    const secondDeltas: Array<Uint8Array> = []
    firstClient.on('update', (update) => firstDeltas.push(Uint8Array.from(update)))
    secondClient.on('update', (update) => secondDeltas.push(Uint8Array.from(update)))
    const firstInsertion = 'First '.repeat(256)
    const secondInsertion = ' Second'.repeat(256)
    noteTextType(firstClient).insert(0, firstInsertion)
    const secondText = noteTextType(secondClient)
    secondText.insert(secondText.length, secondInsertion)
    const firstUpdate = Uint8Array.from(Y.mergeUpdates(firstDeltas)).buffer
    const secondUpdate = Uint8Array.from(Y.mergeUpdates(secondDeltas)).buffer
    firstClient.destroy()
    secondClient.destroy()
    const results = await Promise.all([
      asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId,
        update: firstUpdate,
      }),
      asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId,
        update: secondUpdate,
      }),
    ])

    expect(
      results
        .map((result) => (result.status === 'completed' ? result.version.revision : null))
        .sort((left, right) => (left ?? 0) - (right ?? 0)),
    ).toEqual([2, 3])
    const final = results.find(
      (result) => result.status === 'completed' && result.version.revision === 3,
    )
    if (!final || final.status !== 'completed') throw new Error('Expected merged note content')
    const blocks = decodeNoteYjsUpdatesToBlocks([{ update: final.update }], NOTE_YJS_FRAGMENT)
    expect(
      blocks
        .flatMap((block) =>
          Array.isArray(block.content)
            ? block.content.flatMap((inline) => (inline.type === 'text' ? [inline.text] : []))
            : [],
        )
        .join(''),
    ).toBe(`${firstInsertion}Middle${secondInsertion}`)
  })

  it('replaces canonical note reference edges at the exact committed content version', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const targetId = await createResource(campaign, campaignUuid, 'note', null, 'Target')
    const sourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const sourceUpdate = makeYjsUpdateWithBlocks([
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [
          {
            type: 'resourceLink',
            props: {
              destination: serializeAuthoredDestination({
                kind: 'internal',
                target: { kind: 'resource', resourceId: targetId },
              }),
              label: 'Target',
            },
          },
        ],
      },
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Retained' }],
      },
    ])
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId: sourceId,
        kind: 'note',
        parentId: null,
        title: 'Source',
        icon: null,
        color: null,
      },
      update: sourceUpdate,
    })

    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', sourceId))
        .unique()
      const edges = await ctx.db
        .query('resourceReferenceEdges')
        .withIndex('by_campaign_and_source', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('sourceResourceUuid', sourceId),
        )
        .collect()
      expect(edges).toEqual([
        expect.objectContaining({
          sourceResourceUuid: sourceId,
          sourceVersion: content!.version,
          source: { kind: 'noteBlock', blockId: expect.any(String) },
          targetResourceUuid: targetId,
          target: { kind: 'resource', resourceId: targetId },
        }),
      ])
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadResourceReferences, {
        campaignId: campaignUuid,
        resourceId: sourceId,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      outgoing: {
        status: 'ready',
        edges: [
          {
            sourceResourceId: sourceId,
            target: { kind: 'resource', resourceId: targetId },
          },
        ],
      },
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadResourceReferences, {
        campaignId: campaignUuid,
        resourceId: targetId,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      backlinks: {
        status: 'ready',
        edges: [
          {
            sourceResourceId: sourceId,
            target: { kind: 'resource', resourceId: targetId },
          },
        ],
      },
    })

    const document = new Y.Doc()
    Y.applyUpdate(document, new Uint8Array(sourceUpdate))
    const stateVector = Y.encodeStateVector(document)
    const blockGroup = document.getXmlFragment(NOTE_YJS_FRAGMENT).get(0)
    if (!(blockGroup instanceof Y.XmlElement)) throw new TypeError('Expected note block group')
    blockGroup.delete(0, 1)
    const removeLink = Uint8Array.from(Y.encodeStateAsUpdate(document, stateVector)).buffer
    document.destroy()
    const saved = await asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
      campaignId: campaignUuid,
      generation: INITIAL_CONTENT_GENERATION,
      resourceId: sourceId,
      update: removeLink,
    })
    expect(saved).toMatchObject({ status: 'completed', version: { revision: 2 } })
    await t.run(async (ctx) => {
      expect(
        await ctx.db
          .query('resourceReferenceEdges')
          .withIndex('by_campaign_and_source', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('sourceResourceUuid', sourceId),
          )
          .collect(),
      ).toEqual([])
    })
  })

  it('replays reference backfill projection without duplicate or stale rows', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const sourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const targetId = generateDomainId(DOMAIN_ID_KIND.resource)
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const destination = {
      kind: 'internal' as const,
      target: { kind: 'resource' as const, resourceId: targetId },
    }
    const initialVersion = assertVersionStamp({
      scheme: 'authoritative-revision-v1',
      revision: 1,
      digest: '1'.repeat(64),
    })
    const advancedVersion = assertVersionStamp({
      scheme: 'authoritative-revision-v1',
      revision: 2,
      digest: '2'.repeat(64),
    })
    const projection = {
      campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, campaignUuid),
      sourceResourceId: sourceId,
      sourceVersion: initialVersion,
      occurrences: [{ source: { kind: 'noteBlock' as const, blockId }, destination }],
    }

    await t.run(async (ctx) => {
      await expect(replaceResourceReferenceProjection(ctx, projection)).resolves.toEqual({
        status: 'completed',
      })
      await expect(replaceResourceReferenceProjection(ctx, projection)).resolves.toEqual({
        status: 'completed',
      })
      await expect(
        replaceResourceReferenceProjection(ctx, {
          ...projection,
          sourceVersion: advancedVersion,
        }),
      ).resolves.toEqual({ status: 'completed' })
      await expect(
        replaceResourceReferenceProjection(ctx, {
          ...projection,
          sourceVersion: advancedVersion,
        }),
      ).resolves.toEqual({ status: 'completed' })
      const rows = await ctx.db
        .query('resourceReferenceEdges')
        .withIndex('by_campaign_and_source', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('sourceResourceUuid', sourceId),
        )
        .collect()
      expect(rows).toEqual([
        expect.objectContaining({
          sourceResourceUuid: sourceId,
          sourceVersion: advancedVersion,
          source: { kind: 'noteBlock', blockId },
          targetResourceUuid: targetId,
          target: destination.target,
        }),
      ])
      await expect(
        replaceResourceReferenceProjection(ctx, {
          ...projection,
          sourceVersion: advancedVersion,
          occurrences: [],
        }),
      ).resolves.toEqual({ status: 'completed' })
      await expect(
        replaceResourceReferenceProjection(ctx, {
          ...projection,
          sourceVersion: advancedVersion,
          occurrences: [],
        }),
      ).resolves.toEqual({ status: 'completed' })
      await expect(
        ctx.db
          .query('resourceReferenceEdges')
          .withIndex('by_campaign_and_source', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('sourceResourceUuid', sourceId),
          )
          .collect(),
      ).resolves.toEqual([])
    })
  })

  it('completes a causally incomplete note delta from the authoritative state vector', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const baseUpdate = makeYjsUpdateWithBlocks([
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Causal note' }],
      },
    ])
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId,
        kind: 'note',
        parentId: null,
        title: 'Causal note',
        icon: null,
        color: null,
      },
      update: baseUpdate,
    })

    const client = new Y.Doc()
    Y.applyUpdate(client, new Uint8Array(baseUpdate))
    const deltas: Array<Uint8Array> = []
    client.on('update', (update) => deltas.push(Uint8Array.from(update)))
    client.getMap('causal').set('prerequisite', true)
    client.getMap('causal').set('dependent', true)
    const prerequisite = Uint8Array.from(deltas[0]!).buffer
    const dependent = Uint8Array.from(deltas[1]!).buffer

    const pending = await asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
      campaignId: campaignUuid,
      generation: INITIAL_CONTENT_GENERATION,
      resourceId,
      update: dependent,
    })
    expect(pending).toMatchObject({ status: 'retryable', reason: 'dependency_pending' })
    if (pending.status !== 'retryable') throw new Error('Expected causal dependency request')
    const repair = Uint8Array.from(
      Y.encodeStateAsUpdate(client, new Uint8Array(pending.stateVector)),
    ).buffer
    client.destroy()
    expect(new Uint8Array(repair).byteLength).toBeGreaterThan(
      new Uint8Array(prerequisite).byteLength,
    )
    const completed = await asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
      campaignId: campaignUuid,
      generation: INITIAL_CONTENT_GENERATION,
      resourceId,
      update: repair,
    })
    expect(completed).toMatchObject({ status: 'completed', version: { revision: 2 } })
    if (completed.status !== 'completed') throw new Error('Expected causal note merge')
    const merged = new Y.Doc()
    Y.applyUpdate(merged, new Uint8Array(completed.update))
    expect(merged.getMap('causal').toJSON()).toEqual({ prerequisite: true, dependent: true })
    merged.destroy()
  })

  it('rejects duplicate top-level and nested note block identities on create', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    for (const nested of [false, true]) {
      const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
      const result = await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'create',
          resourceId,
          kind: 'note',
          parentId: null,
          title: nested ? 'Nested duplicate' : 'Top-level duplicate',
          icon: null,
          color: null,
        },
        update: noteUpdateWithDuplicateBlockIds(nested),
      })
      expect(result).toEqual({ status: 'rejected', reason: 'content_integrity_failure' })
      await t.run(async (ctx) => {
        expect(
          await ctx.db
            .query('resources')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .unique(),
        ).toBeNull()
      })
    }
  })

  it('canonicalizes duplicate note block identities formed by concurrent updates', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const base = noteBlocksToYDoc(
      [
        { id: generateDomainId(DOMAIN_ID_KIND.noteBlock), type: 'paragraph' },
        { id: generateDomainId(DOMAIN_ID_KIND.noteBlock), type: 'paragraph' },
      ],
      NOTE_YJS_FRAGMENT,
    )
    const baseUpdate = noteDocumentUpdate(base)
    base.destroy()
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId,
        kind: 'note',
        parentId: null,
        title: 'Concurrent identities',
        icon: null,
        color: null,
      },
      update: baseUpdate,
    })

    const collisionId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const updateIdentity = (index: number) => {
      const document = new Y.Doc()
      Y.applyUpdate(document, new Uint8Array(baseUpdate))
      const vector = Y.encodeStateVector(document)
      noteBlockElements(document)[index]!.setAttribute('id', collisionId)
      const update = noteDocumentUpdate(document, vector)
      document.destroy()
      return update
    }
    const first = await asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
      campaignId: campaignUuid,
      generation: INITIAL_CONTENT_GENERATION,
      resourceId,
      update: updateIdentity(0),
    })
    const second = await asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
      campaignId: campaignUuid,
      generation: INITIAL_CONTENT_GENERATION,
      resourceId,
      update: updateIdentity(1),
    })

    expect(first).toMatchObject({ status: 'completed', version: { revision: 2 } })
    expect(second).toMatchObject({ status: 'completed', version: { revision: 3 } })
    if (second.status !== 'completed') throw new Error('Expected canonical note merge')
    const blocks = decodeNoteYjsUpdatesToBlocks([{ update: second.update }], NOTE_YJS_FRAGMENT)
    expect(blocks).toHaveLength(2)
    expect(blocks.filter((block) => block.id === collisionId)).toHaveLength(1)
    expect(new Set(blocks.map((block) => block.id)).size).toBe(2)
    await expect(
      asDm(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toMatchObject({ status: 'ready', version: { revision: 3 } })
  })

  it('authorizes every note and canvas write against current role and lifecycle', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const noteId = await createResource(campaign, campaignUuid, 'note', null, 'Protected note')
    const canvasId = await createResource(
      campaign,
      campaignUuid,
      'canvas',
      null,
      'Protected canvas',
    )
    const guessedId = generateDomainId(DOMAIN_ID_KIND.resource)
    const noteUpdate = makeYjsUpdateWithBlocks([
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Denied edit' }],
      },
    ])
    const canvasDocument = createCanvasDocumentDoc({
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
    const canvasUpdate = Uint8Array.from(Y.encodeStateAsUpdate(canvasDocument)).buffer
    canvasDocument.destroy()
    const before = await storedContentState(noteId, canvasId)

    await expect(
      asPlayer(campaign).mutation(api.resources.mutations.saveNoteContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId: noteId,
        update: noteUpdate,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
    await expect(
      asPlayer(campaign).mutation(api.resources.mutations.saveCanvasContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId: canvasId,
        update: canvasUpdate,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
    await expect(
      asPlayer(campaign).mutation(api.resources.mutations.saveCanvasContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId: guessedId,
        update: canvasUpdate,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
    expect(await storedContentState(noteId, canvasId)).toEqual(before)

    await expect(
      asDm(campaign).mutation(api.resources.mutations.saveCanvasContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId: canvasId,
        update: canvasUpdate,
      }),
    ).resolves.toMatchObject({ status: 'completed', version: { revision: 2 } })
    const afterDmWrite = await storedContentState(noteId, canvasId)

    await t.run(async (ctx) => {
      await ctx.db.patch('campaignMembers', campaign.dm.memberId, {
        role: CAMPAIGN_MEMBER_ROLE.Player,
      })
    })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId: noteId,
        update: noteUpdate,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
    expect(await storedContentState(noteId, canvasId)).toEqual(afterDmWrite)

    await t.run(async (ctx) => {
      await ctx.db.patch('campaignMembers', campaign.dm.memberId, {
        role: CAMPAIGN_MEMBER_ROLE.DM,
      })
    })
    await execute(campaign, campaignUuid, { type: 'trash', resourceIds: [noteId] })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId: noteId,
        update: noteUpdate,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
    expect(await storedContentState(noteId, canvasId)).toEqual(afterDmWrite)
  })

  it('merges concurrent canonical canvas updates and rejects invalid document state', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = await createResource(campaign, campaignUuid, 'canvas', null, 'Canvas')
    const targetId = await createResource(campaign, campaignUuid, 'note', null, 'Target')
    const firstNodeId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    const secondNodeId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    const firstDocument = createCanvasDocumentDoc({
      nodes: [
        {
          id: firstNodeId,
          type: 'embed',
          position: { x: 10, y: 20 },
          data: {
            destination: {
              kind: 'internal',
              target: { kind: 'resource', resourceId: targetId },
            },
          },
        },
      ],
      edges: [],
    })
    const secondDocument = createCanvasDocumentDoc({
      nodes: [
        {
          id: secondNodeId,
          type: 'text',
          position: { x: 30, y: 40 },
          data: {},
        },
      ],
      edges: [],
    })

    const first = await asDm(campaign).mutation(api.resources.mutations.saveCanvasContent, {
      campaignId: campaignUuid,
      generation: INITIAL_CONTENT_GENERATION,
      resourceId,
      update: Uint8Array.from(Y.encodeStateAsUpdate(firstDocument)).buffer,
    })
    const second = await asDm(campaign).mutation(api.resources.mutations.saveCanvasContent, {
      campaignId: campaignUuid,
      generation: INITIAL_CONTENT_GENERATION,
      resourceId,
      update: Uint8Array.from(Y.encodeStateAsUpdate(secondDocument)).buffer,
    })
    firstDocument.destroy()
    secondDocument.destroy()

    expect(first).toMatchObject({ status: 'completed', version: { revision: 2 } })
    expect(second).toMatchObject({ status: 'completed', version: { revision: 3 } })
    if (second.status !== 'completed') throw new Error('Expected merged canvas content')
    const merged = new Y.Doc()
    Y.applyUpdate(merged, new Uint8Array(second.update))
    expect(readCanvasDocumentContent(merged).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstNodeId }),
        expect.objectContaining({ id: secondNodeId }),
      ]),
    )
    merged.destroy()
    await t.run(async (ctx) => {
      const edge = await ctx.db
        .query('resourceReferenceEdges')
        .withIndex('by_campaign_and_source', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('sourceResourceUuid', resourceId),
        )
        .unique()
      expect(edge).toMatchObject({
        sourceVersion: second.version,
        target: { kind: 'resource', resourceId: targetId },
      })
    })

    const invalid = new Y.Doc()
    invalid.getMap('nodes').set('invalid-node-id', {
      id: 'invalid-node-id',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.saveCanvasContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId,
        update: Uint8Array.from(Y.encodeStateAsUpdate(invalid)).buffer,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'content_corrupt' })
    invalid.destroy()

    await expect(
      asDm(campaign).mutation(api.resources.mutations.saveCanvasContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId,
        update: new Uint8Array(CANVAS_WORKLOAD_LIMITS.encodedBytes + 1).buffer,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'content_limit_exceeded' })

    await expect(
      asDm(campaign).query(api.resources.queries.loadCanvasContent, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      version: { revision: 3 },
    })
  })

  it.each(['note', 'canvas'] as const)(
    'authenticates two %s presence clients and disconnects them deterministically',
    async (kind) => {
      const campaign = await setupCampaignContext(t)
      const campaignUuid = await getCampaignUuid(campaign.campaignId)
      const resourceId = await createResource(campaign, campaignUuid, kind, null, 'Presence')
      const spoofedMemberId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
      const first = resourcePresenceUpdate({
        memberId: spoofedMemberId,
        user: { name: 'Spoofed', color: '#000000' },
      })
      const second = resourcePresenceUpdate()
      const connect = (clientId: number) =>
        asDm(campaign).mutation(api.resources.mutations.heartbeatResourcePresence, {
          campaignId: campaignUuid,
          resourceId,
          clientId,
          sessionId: generateDomainId(DOMAIN_ID_KIND.operation),
        })
      const firstSession = await connect(first.clientId)
      const secondSession = await connect(second.clientId)
      if (firstSession.status !== 'active' || secondSession.status !== 'active') {
        throw new Error('Expected active presence sessions')
      }
      await expect(
        asDm(campaign).mutation(api.resources.mutations.updateResourcePresence, {
          campaignId: campaignUuid,
          resourceId,
          clientId: first.clientId,
          state: first.update,
        }),
      ).resolves.toEqual({ status: 'active' })
      await expect(
        asDm(campaign).mutation(api.resources.mutations.updateResourcePresence, {
          campaignId: campaignUuid,
          resourceId,
          clientId: second.clientId,
          state: second.update,
        }),
      ).resolves.toEqual({ status: 'active' })

      const snapshot = await asDm(campaign).query(api.resources.queries.loadResourcePresence, {
        campaignId: campaignUuid,
        resourceId,
        roomToken: firstSession.roomToken,
      })
      if (snapshot.status !== 'ready') throw new Error('Expected ready presence snapshot')
      expect(snapshot.entries).toHaveLength(2)
      const firstEntry = snapshot.entries.find((entry) => entry.clientId === first.clientId)
      expect(firstEntry).toMatchObject({
        memberId: campaign.dm.memberDomainId,
        user: { color: collaborationColor(campaign.dm.memberDomainId) },
      })
      expect(firstEntry?.user.name).not.toBe('Spoofed')

      await expect(
        asPlayer(campaign).mutation(api.resources.mutations.heartbeatResourcePresence, {
          campaignId: campaignUuid,
          resourceId,
          clientId: first.clientId,
          sessionId: generateDomainId(DOMAIN_ID_KIND.operation),
        }),
      ).resolves.toEqual({ status: 'unavailable' })
      await expect(
        asPlayer(campaign).query(api.resources.queries.loadResourcePresence, {
          campaignId: campaignUuid,
          resourceId,
          roomToken: firstSession.roomToken,
        }),
      ).resolves.toEqual({ status: 'unavailable', reason: 'unauthorized' })

      await expect(
        asDm(campaign).mutation(api.resources.mutations.disconnectResourcePresence, {
          campaignId: campaignUuid,
          resourceId,
          sessionToken: firstSession.sessionToken,
        }),
      ).resolves.toEqual({ status: 'released' })
      await expect(
        asDm(campaign).query(api.resources.queries.loadResourcePresence, {
          campaignId: campaignUuid,
          resourceId,
          roomToken: firstSession.roomToken,
        }),
      ).resolves.toMatchObject({
        status: 'ready',
        entries: [{ clientId: second.clientId }],
      })
      await expect(
        asDm(campaign).mutation(api.resources.mutations.disconnectResourcePresence, {
          campaignId: campaignUuid,
          resourceId,
          sessionToken: secondSession.sessionToken,
        }),
      ).resolves.toEqual({ status: 'released' })
    },
  )

  it('rejects invalid sessions and oversized updates', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = await createResource(campaign, campaignUuid, 'note', null, 'Invalid')
    const valid = resourcePresenceUpdate()
    const update = (clientId: number, state: ArrayBuffer) =>
      asDm(campaign).mutation(api.resources.mutations.updateResourcePresence, {
        campaignId: campaignUuid,
        resourceId,
        clientId,
        state,
      })

    await expect(
      asDm(campaign).mutation(api.resources.mutations.heartbeatResourcePresence, {
        campaignId: campaignUuid,
        resourceId,
        clientId: -1,
        sessionId: 'invalid',
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_client' })
    await expect(update(valid.clientId, new ArrayBuffer(2_049))).resolves.toEqual({
      status: 'rejected',
      reason: 'payload_too_large',
    })
    await expect(update(-1, valid.update)).resolves.toEqual({
      status: 'rejected',
      reason: 'invalid_update',
    })
  })

  it('creates ready revision-1 content for files, maps, and canvases', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const fileId = await createResource(campaign, campaignUuid, 'file', null, 'File')
    const mapId = await createResource(campaign, campaignUuid, 'map', null, 'Map')
    const canvasId = await createResource(campaign, campaignUuid, 'canvas', null, 'Canvas')

    await t.run(async (ctx) => {
      const file = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', fileId))
        .unique()
      const map = await ctx.db
        .query('resourceMapContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', mapId))
        .unique()
      const canvas = await ctx.db
        .query('resourceCanvasContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', canvasId))
        .unique()
      expect(file).toEqual(
        expect.objectContaining({
          assetUuid: expect.any(String),
          version: expect.objectContaining({ revision: 1 }),
        }),
      )
      expect(map).toEqual(
        expect.objectContaining({ layers: [], version: expect.objectContaining({ revision: 1 }) }),
      )
      expect(canvas).toEqual(
        expect.objectContaining({ version: expect.objectContaining({ revision: 1 }) }),
      )
    })
  })

  it('rejects operation UUID reuse by another actor or command', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const command = {
      type: 'create' as const,
      resourceId,
      kind: 'folder' as const,
      parentId: null,
      title: canonicalizeResourceTitle('Root'),
      icon: null,
      color: null,
    }
    await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaignUuid,
      operationId,
      command,
    })

    await expect(
      asPlayer(campaign).mutation(api.resources.mutations.executeStructureCommand, {
        campaignId: campaignUuid,
        operationId,
        command,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
        campaignId: campaignUuid,
        operationId,
        command: { ...command, title: canonicalizeResourceTitle('Different') },
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'operation_id_reused' })
  })

  it('advances metadata versions only for semantic changes', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    await execute(campaign, campaignUuid, {
      type: 'create',
      resourceId,
      kind: 'folder',
      parentId: null,
      title: canonicalizeResourceTitle('Original'),
      icon: null,
      color: null,
    })
    const createdVersion = await getMetadataVersion(resourceId)

    await execute(campaign, campaignUuid, {
      type: 'updateMetadata',
      resourceId,
      changes: { title: canonicalizeResourceTitle('Original') },
    })
    expect(await getMetadataVersion(resourceId)).toEqual(createdVersion)

    await execute(campaign, campaignUuid, {
      type: 'updateMetadata',
      resourceId,
      changes: { title: canonicalizeResourceTitle('Renamed') },
    })
    const renamedVersion = await getMetadataVersion(resourceId)
    expect(renamedVersion.revision).toBe(createdVersion.revision + 1)
    expect(renamedVersion.digest).not.toBe(createdVersion.digest)
  })

  it('moves selected roots without allowing invalid parents or hierarchy cycles', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const rootId = await createResource(campaign, campaignUuid, 'folder', null, 'Root')
    const childFolderId = await createResource(campaign, campaignUuid, 'folder', rootId, 'Child')
    const noteId = await createResource(campaign, campaignUuid, 'note', null, 'Note')
    const initialVersion = await getMetadataVersion(noteId)

    await expect(
      execute(campaign, campaignUuid, {
        type: 'move',
        resourceIds: [rootId],
        destinationParentId: childFolderId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'hierarchy_cycle' })
    await expect(
      execute(campaign, campaignUuid, {
        type: 'move',
        resourceIds: [rootId],
        destinationParentId: noteId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_parent_kind' })

    const moved = await execute(campaign, campaignUuid, {
      type: 'move',
      resourceIds: [noteId],
      destinationParentId: rootId,
    })
    expect(moved).toEqual(
      expect.objectContaining({
        status: 'completed',
        receipt: expect.objectContaining({
          result: { type: 'moved', resourceIds: [noteId] },
        }),
      }),
    )
    await t.run(async (ctx) => {
      const note = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', noteId))
        .unique()
      expect(note!.parentResourceUuid).toBe(rootId)
      expect(note!.metadataVersion.revision).toBe(initialVersion.revision + 1)
    })
  })

  it('validates an entire multi-resource mutation before writing', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const folderId = await createResource(campaign, campaignUuid, 'folder', null, 'Folder')
    const activeId = await createResource(campaign, campaignUuid, 'note', null, 'Active')
    const trashedId = await createResource(campaign, campaignUuid, 'note', null, 'Trashed')
    await execute(campaign, campaignUuid, { type: 'trash', resourceIds: [trashedId] })

    await expect(
      execute(campaign, campaignUuid, {
        type: 'move',
        resourceIds: [activeId, trashedId],
        destinationParentId: folderId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_lifecycle' })
    await t.run(async (ctx) => {
      const active = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', activeId))
        .unique()
      expect(active!.parentResourceUuid).toBeNull()
    })
  })

  it('deep copies a bounded folder closure with final UUIDs and replayable receipts', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const destinationId = await createResource(
      campaign,
      campaignUuid,
      'folder',
      null,
      'Destination',
    )
    const sourceRootId = await createResource(campaign, campaignUuid, 'folder', null, 'Archive')
    const sourceChildId = await createResource(
      campaign,
      campaignUuid,
      'folder',
      sourceRootId,
      'Archive',
    )
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const args = {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'deepCopy' as const,
        sourceRootIds: [sourceRootId],
        destinationParentId: destinationId,
      },
    }

    const first = await asDm(campaign).mutation(
      api.resources.mutations.executeStructureCommand,
      args,
    )
    const replay = await asDm(campaign).mutation(
      api.resources.mutations.executeStructureCommand,
      args,
    )

    expect(replay).toEqual(first)
    expect(first).toMatchObject({
      status: 'completed',
      receipt: {
        campaignId: campaignUuid,
        operationId,
        result: {
          type: 'deepCopied',
          roots: [{ sourceRootId, destinationRootId: expect.any(String) }],
        },
        postconditions: [
          { state: 'present', resourceId: expect.any(String) },
          { state: 'present', resourceId: expect.any(String) },
        ],
      },
    })
    if (first.status !== 'completed' || first.receipt.result.type !== 'deepCopied') {
      throw new Error('Expected completed deep copy')
    }
    const destinationRootId = first.receipt.result.roots[0]!.destinationRootId
    expect(destinationRootId).not.toBe(sourceRootId)

    await t.run(async (ctx) => {
      const destinationRoot = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', destinationRootId))
        .unique()
      const destinationChildren = await ctx.db
        .query('resources')
        .withIndex('by_campaign_and_parent', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('parentResourceUuid', destinationRootId),
        )
        .take(2)
      expect(destinationRoot).toEqual(
        expect.objectContaining({
          campaignUuid,
          parentResourceUuid: destinationId,
          title: 'Archive',
          metadataVersion: expect.objectContaining({ revision: 1 }),
        }),
      )
      expect(destinationChildren[0]!.resourceUuid).not.toBe(sourceChildId)
      expect(destinationChildren).toEqual([
        expect.objectContaining({
          parentResourceUuid: destinationRootId,
          title: 'Archive',
          metadataVersion: expect.objectContaining({ revision: 1 }),
        }),
      ])
    })
  })

  it('deep copies independent note, file, map, and canvas content with internal references', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const sourceRootId = await createResource(campaign, campaignUuid, 'folder', null, 'Source')
    const fileId = await createResource(campaign, campaignUuid, 'file', sourceRootId, 'File')
    const mapId = await createResource(campaign, campaignUuid, 'map', sourceRootId, 'Map')
    const canvasId = await createResource(campaign, campaignUuid, 'canvas', sourceRootId, 'Canvas')
    const noteId = generateDomainId(DOMAIN_ID_KIND.resource)
    const noteOperationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const sourceBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId: noteOperationId,
      command: {
        type: 'create',
        resourceId: noteId,
        kind: 'note',
        parentId: sourceRootId,
        title: 'Note',
        icon: null,
        color: null,
      },
      update: makeYjsUpdateWithBlocks([
        {
          id: sourceBlockId,
          type: 'embed',
          props: {
            destination: serializeAuthoredDestination({
              kind: 'internal',
              target: { kind: 'resource', resourceId: mapId },
            }),
          },
        },
      ]),
    })
    const sourcePinId = generateDomainId(DOMAIN_ID_KIND.mapPin)
    const sourceNodeId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    const canvasDoc = createCanvasDocumentDoc({
      nodes: [
        {
          id: sourceNodeId,
          type: 'embed',
          position: { x: 10, y: 20 },
          data: {
            destination: {
              kind: 'internal',
              target: { kind: 'resource', resourceId: fileId },
            },
          },
        },
      ],
      edges: [],
    })
    const canvasUpdate = Uint8Array.from(Y.encodeStateAsUpdate(canvasDoc)).buffer
    canvasDoc.destroy()
    await t.run(async (ctx) => {
      const fileContent = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', fileId))
        .unique()
      const fileMetadata = {
        classification: 'inert_file' as const,
        byteSize: 0,
        detectedFormat: null,
        extension: 'txt',
        mediaType: 'application/octet-stream',
        viewerUnavailableReason: 'empty_file' as const,
      }
      await ctx.db.replace('resourceFileContents', fileContent!._id, {
        campaignUuid,
        resourceUuid: fileId,
        state: 'ready',
        assetUuid: null,
        ...fileMetadata,
        version: await initialFileContentVersion(new Uint8Array(), fileMetadata),
      })
      const mapContent = await ctx.db
        .query('resourceMapContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', mapId))
        .unique()
      await ctx.db.replace('resourceMapContents', mapContent!._id, {
        campaignUuid,
        resourceUuid: mapId,
        state: 'ready',
        image: null,
        layers: [],
        recentOperations: [],
        version: await initialJsonContentVersion({
          image: null,
          layers: [],
          pins: [
            {
              mapPinUuid: sourcePinId,
              destination: {
                kind: 'internal',
                target: { kind: 'resource', resourceId: noteId },
              },
            },
          ],
        }),
      })
      await ctx.db.insert('resourceMapPins', {
        campaignUuid,
        mapResourceUuid: mapId,
        mapPinUuid: sourcePinId,
        destination: {
          kind: 'internal',
          target: { kind: 'resource', resourceId: noteId },
        },
        layerId: null,
        x: 1,
        y: 2,
        visible: true,
      })
      const canvasContent = await ctx.db
        .query('resourceCanvasContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', canvasId))
        .unique()
      await ctx.db.replace('resourceCanvasContents', canvasContent!._id, {
        campaignUuid,
        resourceUuid: canvasId,
        update: canvasUpdate,
        version: await initialBinaryContentVersion(canvasUpdate),
      })
    })

    const result = await execute(campaign, campaignUuid, {
      type: 'deepCopy',
      sourceRootIds: [sourceRootId],
      destinationParentId: null,
    })
    if (result.status !== 'completed' || result.receipt.result.type !== 'deepCopied') {
      throw new Error('Expected completed deep copy')
    }
    const destinationRootId = result.receipt.result.roots[0]!.destinationRootId

    await t.run(async (ctx) => {
      const children = await ctx.db
        .query('resources')
        .withIndex('by_campaign_and_parent', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('parentResourceUuid', destinationRootId),
        )
        .take(10)
      const destinations = new Map(children.map((resource) => [resource.kind, resource]))
      const copiedNote = destinations.get('note')!
      const copiedMap = destinations.get('map')!
      const copiedFile = destinations.get('file')!
      const copiedCanvas = destinations.get('canvas')!

      const noteContent = await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', copiedNote.resourceUuid))
        .unique()
      expect(noteContent).toEqual(
        expect.objectContaining({
          version: expect.objectContaining({ revision: 1 }),
        }),
      )
      if (!noteContent) throw new Error('Expected copied note')
      const [copiedBlock] = decodeNoteYjsUpdatesToBlocks(
        [{ update: noteContent.update }],
        NOTE_YJS_FRAGMENT,
      )
      expect(copiedBlock).toEqual(
        expect.objectContaining({ id: expect.not.stringMatching(sourceBlockId) }),
      )
      if (copiedBlock?.type !== 'embed') throw new Error('Expected copied embed')
      expect(parseSerializedAuthoredDestination(copiedBlock.props.destination)).toEqual({
        kind: 'internal',
        target: { kind: 'resource', resourceId: copiedMap.resourceUuid },
      })

      const [copiedPin] = await ctx.db
        .query('resourceMapPins')
        .withIndex('by_mapResourceUuid', (query) =>
          query.eq('mapResourceUuid', copiedMap.resourceUuid),
        )
        .take(2)
      expect(copiedPin).toEqual(
        expect.objectContaining({
          mapPinUuid: expect.not.stringMatching(sourcePinId),
          destination: {
            kind: 'internal',
            target: { kind: 'resource', resourceId: copiedNote.resourceUuid },
          },
        }),
      )

      const canvasContent = await ctx.db
        .query('resourceCanvasContents')
        .withIndex('by_resourceUuid', (query) =>
          query.eq('resourceUuid', copiedCanvas.resourceUuid),
        )
        .unique()
      const copiedCanvasDoc = new Y.Doc()
      Y.applyUpdate(copiedCanvasDoc, new Uint8Array(canvasContent!.update))
      const copiedCanvasDocument = readCanvasDocumentContent(copiedCanvasDoc)
      copiedCanvasDoc.destroy()
      expect(copiedCanvasDocument.nodes[0]).toEqual(
        expect.objectContaining({
          id: expect.not.stringMatching(sourceNodeId),
          data: {
            destination: {
              kind: 'internal',
              target: { kind: 'resource', resourceId: copiedFile.resourceUuid },
            },
          },
        }),
      )

      const fileContent = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', copiedFile.resourceUuid))
        .unique()
      expect(fileContent).toEqual(
        expect.objectContaining({
          assetUuid: null,
          classification: 'inert_file',
          byteSize: 0,
          detectedFormat: null,
          extension: 'txt',
          mediaType: 'application/octet-stream',
          viewerUnavailableReason: 'empty_file',
          version: expect.objectContaining({ revision: 1 }),
        }),
      )
    })
  })

  it('copies and retires content assets through authoritative lifecycle work', async () => {
    vi.useFakeTimers()
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const sourceFileId = await createResource(campaign, campaignUuid, 'file', null, 'Asset')
    const sourceAsset = await storeCommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob(['asset bytes']),
      'asset.txt',
    )
    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', sourceFileId))
        .unique()
      const fileMetadata = {
        classification: 'inert_file' as const,
        byteSize: 11,
        detectedFormat: null,
        extension: 'txt',
        mediaType: 'application/octet-stream',
        viewerUnavailableReason: 'unsupported_format' as const,
      }
      const semanticContent = { assetUuid: sourceAsset.assetId, ...fileMetadata }
      await ctx.db.replace('resourceFileContents', content!._id, {
        campaignUuid,
        resourceUuid: sourceFileId,
        state: 'ready',
        ...semanticContent,
        version: await initialFileContentVersion(
          new TextEncoder().encode('asset bytes'),
          fileMetadata,
        ),
      })
    })

    const copy = await execute(campaign, campaignUuid, {
      type: 'deepCopy',
      sourceRootIds: [sourceFileId],
      destinationParentId: null,
    })
    if (copy.status !== 'completed' || copy.receipt.result.type !== 'deepCopied') {
      throw new Error('Expected completed deep copy')
    }
    const destinationFileId = copy.receipt.result.roots[0]!.destinationRootId
    const pendingCopy = await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', destinationFileId))
        .unique()
      expect(content).toEqual(
        expect.objectContaining({
          state: 'initializing',
          assetUuid: expect.not.stringMatching(sourceAsset.assetId),
          version: expect.objectContaining({ revision: 1 }),
        }),
      )
      const intent = await ctx.db
        .query('resourceAssetCopyIntents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', destinationFileId))
        .unique()
      expect(intent).toEqual(
        expect.objectContaining({
          sourceAssetUuid: sourceAsset.assetId,
          destinationAssetUuid: content!.assetUuid,
          status: 'pending',
        }),
      )
      return { assetId: content!.assetUuid!, intentId: intent!._id }
    })

    await execute(campaign, campaignUuid, { type: 'trash', resourceIds: [sourceFileId] })
    await execute(campaign, campaignUuid, {
      type: 'permanentlyDelete',
      resourceIds: [sourceFileId],
    })
    const sourceRetirementCandidateId = await t.run(async (ctx) => {
      const candidate = await ctx.db
        .query('resourceAssetRetirementCandidates')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', sourceAsset.assetId))
        .unique()
      return candidate!._id
    })
    await t.mutation(internal.resources.internalMutations.claimAssetRetirement, {
      candidateId: sourceRetirementCandidateId,
    })
    await expect(
      t.mutation(internal.resources.internalMutations.authorizeAssetRetirement, {
        candidateId: sourceRetirementCandidateId,
      }),
    ).resolves.toEqual({ status: 'deferred' })
    await t.action(internal.resources.internalActions.processAssetCopy, {
      intentId: pendingCopy.intentId,
    })
    await t.action(internal.resources.internalActions.processAssetRetirement, {
      candidateId: sourceRetirementCandidateId,
    })
    const destinationStorageId = await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', destinationFileId))
        .unique()
      expect(content?.state).toBe('ready')
      expect(
        await ctx.db
          .query('resourceAssetCopyIntents')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', destinationFileId))
          .unique(),
      ).toBeNull()
      expect(
        await ctx.db
          .query('resourceAssetOwners')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', pendingCopy.assetId))
          .unique(),
      ).toEqual(expect.objectContaining({ resourceUuid: destinationFileId }))
      const storage = await ctx.db
        .query('fileStorage')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', pendingCopy.assetId))
        .unique()
      expect(await (await ctx.storage.get(storage!.storageId!))!.text()).toBe('asset bytes')
      expect(
        await ctx.db
          .query('fileStorage')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', sourceAsset.assetId))
          .unique(),
      ).toBeNull()
      expect(await ctx.storage.get(sourceAsset.storageId)).toBeNull()
      return storage!.storageId!
    })

    const staleCandidateId = await t.run((ctx) =>
      ctx.db.insert('resourceAssetRetirementCandidates', {
        assetUuid: pendingCopy.assetId,
        status: 'pending',
        attempts: 0,
        lastAttemptAt: null,
        lastError: null,
        createdAt: Date.now(),
      }),
    )
    await t.action(internal.resources.internalActions.processAssetRetirement, {
      candidateId: staleCandidateId,
    })
    await t.run(async (ctx) => {
      expect(await ctx.db.get(staleCandidateId)).toBeNull()
      expect(await ctx.storage.get(destinationStorageId)).not.toBeNull()
    })

    await execute(campaign, campaignUuid, {
      type: 'trash',
      resourceIds: [destinationFileId],
    })
    await execute(campaign, campaignUuid, {
      type: 'permanentlyDelete',
      resourceIds: [destinationFileId],
    })
    const destinationRetirementCandidateId = await t.run(async (ctx) => {
      const candidate = await ctx.db
        .query('resourceAssetRetirementCandidates')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', pendingCopy.assetId))
        .unique()
      return candidate!._id
    })
    await t.action(internal.resources.internalActions.processAssetRetirement, {
      candidateId: destinationRetirementCandidateId,
    })
    await t.run(async (ctx) => {
      expect(
        await ctx.db
          .query('resourceAssetCopyIntents')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', destinationFileId))
          .unique(),
      ).toBeNull()
      expect(
        await ctx.db
          .query('resourceAssetRetirementCandidates')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', pendingCopy.assetId))
          .unique(),
      ).toBeNull()
      expect(
        await ctx.db
          .query('resourceAssetOwners')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', pendingCopy.assetId))
          .unique(),
      ).toBeNull()
      expect(
        await ctx.db
          .query('fileStorage')
          .withIndex('by_assetUuid', (query) => query.eq('assetUuid', pendingCopy.assetId))
          .unique(),
      ).toBeNull()
      expect(await ctx.storage.get(destinationStorageId)).toBeNull()
    })
  })

  it('rejects deep copy before writes when a content-owned plan is unavailable', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const noteId = await createResource(campaign, campaignUuid, 'note', null, 'Note')
    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', noteId))
        .unique()
      await ctx.db.delete(content!._id)
    })

    await expect(
      execute(campaign, campaignUuid, {
        type: 'deepCopy',
        sourceRootIds: [noteId],
        destinationParentId: null,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'content_integrity_failure' })
    await t.run(async (ctx) => {
      const roots = await ctx.db
        .query('resources')
        .withIndex('by_campaign_and_parent', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('parentResourceUuid', null),
        )
        .take(2)
      expect(roots).toHaveLength(1)
      expect(roots[0]!.resourceUuid).toBe(noteId)
    })
  })

  it('rejects deep copy through the canonical note identity invariant', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const noteId = await createResource(campaign, campaignUuid, 'note', null, 'Invalid note')
    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', noteId))
        .unique()
      await ctx.db.patch(content!._id, { update: noteUpdateWithDuplicateBlockIds(false) })
    })

    await expect(
      execute(campaign, campaignUuid, {
        type: 'deepCopy',
        sourceRootIds: [noteId],
        destinationParentId: null,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'content_integrity_failure' })
    await t.run(async (ctx) => {
      const roots = await ctx.db
        .query('resources')
        .withIndex('by_campaign_and_parent', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('parentResourceUuid', null),
        )
        .take(2)
      expect(roots).toHaveLength(1)
      expect(roots[0]!.resourceUuid).toBe(noteId)
    })
  })

  it('recursively trashes, restores with root fallback, and permanently deletes catalog state', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const rootId = await createResource(campaign, campaignUuid, 'folder', null, 'Root')
    const childId = await createResource(campaign, campaignUuid, 'note', rootId, 'Child')
    await execute(campaign, campaignUuid, { type: 'trash', resourceIds: [rootId] })

    await expect(
      execute(campaign, campaignUuid, {
        type: 'permanentlyDelete',
        resourceIds: [childId],
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_root_selection' })
    await execute(campaign, campaignUuid, { type: 'restore', resourceIds: [childId] })
    await t.run(async (ctx) => {
      const child = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', childId))
        .unique()
      expect(child).toEqual(
        expect.objectContaining({ lifecycle: 'active', parentResourceUuid: null }),
      )
    })

    const deleteRootId = await createResource(campaign, campaignUuid, 'folder', null, 'Delete')
    const deleteChildId = await createResource(
      campaign,
      campaignUuid,
      'note',
      deleteRootId,
      'Delete child',
    )
    await t.run(async (ctx) => {
      await ctx.db.insert('resourceSourcePathAliases', {
        campaignUuid,
        resourceUuid: deleteChildId,
        importJobUuid: generateDomainId(DOMAIN_ID_KIND.importJob),
        sourceRootId: 'upload',
        rawPath: 'Notes/Child.md',
        normalizedPath: 'Notes/Child.md',
      })
      await ctx.db.insert('resourceAssetsFolders', {
        campaignUuid,
        resourceUuid: deleteRootId,
      })
    })
    await execute(campaign, campaignUuid, { type: 'trash', resourceIds: [deleteRootId] })
    const deleted = await execute(campaign, campaignUuid, {
      type: 'permanentlyDelete',
      resourceIds: [deleteRootId],
    })
    expect(deleted).toEqual(
      expect.objectContaining({
        status: 'completed',
        receipt: expect.objectContaining({
          result: {
            type: 'permanentlyDeleted',
            resourceIds: [deleteRootId, deleteChildId].sort(),
          },
        }),
      }),
    )
    await t.run(async (ctx) => {
      for (const resourceId of [deleteRootId, deleteChildId]) {
        expect(
          await ctx.db
            .query('resources')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .unique(),
        ).toBeNull()
        expect(
          await ctx.db
            .query('resourceTombstones')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .unique(),
        ).not.toBeNull()
      }
      expect(
        await ctx.db
          .query('resourceSourcePathAliases')
          .withIndex('by_campaign_and_resource', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('resourceUuid', deleteChildId),
          )
          .take(1),
      ).toHaveLength(0)
      expect(
        await ctx.db
          .query('resourceAssetsFolders')
          .withIndex('by_campaign_and_resource', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('resourceUuid', deleteRootId),
          )
          .take(1),
      ).toHaveLength(0)
      expect(
        await ctx.db
          .query('resourceNoteContents')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', deleteChildId))
          .take(1),
      ).toHaveLength(0)
      for (const resourceId of [deleteRootId, deleteChildId]) {
        expect(
          await ctx.db
            .query('resourceSearchDocuments')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .unique(),
        ).toBeNull()
      }
    })
  })

  it('rejects closures above the synchronous resource limit', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const rootId = generateDomainId(DOMAIN_ID_KIND.resource)
    let parentId: ResourceId | null = null
    await t.run(async (ctx) => {
      for (let index = 0; index <= 500; index += 1) {
        const resourceId = index === 0 ? rootId : generateDomainId(DOMAIN_ID_KIND.resource)
        const metadata = {
          parentId,
          kind: 'folder' as const,
          title: canonicalizeResourceTitle(`Folder ${index}`),
          icon: null,
          color: null,
          lifecycle: 'active' as const,
        }
        await ctx.db.insert('resources', {
          resourceUuid: resourceId,
          campaignUuid,
          parentResourceUuid: parentId,
          kind: metadata.kind,
          title: metadata.title,
          icon: null,
          color: null,
          lifecycle: 'active',
          trashedAt: null,
          trashedByMemberUuid: null,
          metadataVersion: await initialResourceMetadataVersion(metadata),
          createdAt: 1,
          createdByMemberUuid: actorId,
          updatedAt: 1,
          updatedByMemberUuid: actorId,
        })
        parentId = resourceId
      }
    })

    await expect(
      execute(campaign, campaignUuid, { type: 'trash', resourceIds: [rootId] }),
    ).resolves.toEqual({ status: 'rejected', reason: 'closure_too_large' })
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', rootId))
        .unique()
      expect(root!.lifecycle).toBe('active')
    })
  }, 15_000)

  it('returns domain rejections for invalid UUID and title input', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const command = {
      type: 'create' as const,
      resourceId,
      kind: 'folder' as const,
      parentId: null,
      title: 'Valid',
      icon: null,
      color: null,
    }

    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
        campaignId: campaignUuid,
        operationId: 'not-a-uuid' as never,
        command,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_uuid' })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: { ...command, title: '\ud800' },
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_title' })
  })

  it('stores actor-scoped bookmarks through an idempotent command', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = await createResource(campaign, campaignUuid, 'folder', null, 'Reference')
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const args = {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'setBookmarkState' as const,
        resourceIds: [resourceId],
        bookmarked: true,
      },
    }

    const first = await asDm(campaign).mutation(
      api.resources.mutations.executeBookmarkCommand,
      args,
    )
    const replay = await asDm(campaign).mutation(
      api.resources.mutations.executeBookmarkCommand,
      args,
    )

    expect(first).toEqual(replay)
    expect(first).toMatchObject({ status: 'completed', receipt: { resourceIds: [resourceId] } })
    await t.run(async (ctx) => {
      const operation = await ctx.db
        .query('resourceBookmarkOperations')
        .withIndex('by_campaign_and_operation', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('operationUuid', operationId),
        )
        .unique()
      expect(operation).toMatchObject({
        protocolVersion: RESOURCE_COMMAND_PROTOCOL_VERSION,
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        receipt: { operationId, resourceIds: [resourceId], bookmarked: true },
      })
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadBookmarks, { campaignId: campaignUuid }),
    ).resolves.toMatchObject({
      resourceIds: [resourceId],
      snapshot: { resources: [{ id: resourceId }], missingResourceIds: [], collections: [] },
    })
  })

  it('consumes the campaign folder access default and preserves only propagation on deep copy', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    await t.run(async (ctx) => {
      await ctx.db.patch('campaigns', campaign.campaignId, {
        resourceAccessDefaults: { folderInheritance: 'enabled' },
      })
    })
    const sourceId = await createResource(campaign, campaignUuid, 'folder', null, 'Shared source')
    await executeAccess(campaign, campaignUuid, {
      type: 'setAudienceAccess',
      resourceIds: [sourceId],
      permission: 'edit',
    })
    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [sourceId],
      memberId: campaign.player.memberDomainId,
      permission: 'view',
    })

    const copied = await execute(campaign, campaignUuid, {
      type: 'deepCopy',
      sourceRootIds: [sourceId],
      destinationParentId: null,
    })
    if (copied.status !== 'completed' || copied.receipt.result.type !== 'deepCopied') {
      throw new Error('Expected completed deep copy')
    }
    const destinationId = copied.receipt.result.roots[0]!.destinationRootId

    await t.run(async (ctx) => {
      const policies = await Promise.all(
        [sourceId, destinationId].map((resourceId) =>
          ctx.db
            .query('resourceAccessPolicies')
            .withIndex('by_campaign_and_resource', (query) =>
              query.eq('campaignUuid', campaignUuid).eq('resourceUuid', resourceId),
            )
            .unique(),
        ),
      )
      expect(policies).toEqual([
        expect.objectContaining({
          subject: 'folder',
          inheritance: 'enabled',
          audienceAccess: { state: 'explicit', permission: 'edit' },
        }),
        expect.objectContaining({
          subject: 'folder',
          inheritance: 'enabled',
          audienceAccess: { state: 'default' },
        }),
      ])
      const copiedMemberAccess = await ctx.db
        .query('resourceMemberAccess')
        .withIndex('by_resource_and_member', (query) =>
          query
            .eq('campaignUuid', campaignUuid)
            .eq('resourceUuid', destinationId)
            .eq('memberUuid', campaign.player.memberDomainId),
        )
        .unique()
      expect(copiedMemberAccess).toBeNull()
    })
  })

  it('enforces view and edit permissions at the canonical content boundary', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const noteId = await createResource(campaign, campaignUuid, 'note', null, 'Shared note')
    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [noteId],
      memberId: campaign.player.memberDomainId,
      permission: 'view',
    })

    await expect(
      asPlayer(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toEqual({ status: 'empty', reason: 'no_visible_blocks' })
    const update = makeYjsUpdateWithBlocks([
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Player edit' }],
      },
    ])
    await expect(
      asPlayer(campaign).mutation(api.resources.mutations.saveNoteContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId: noteId,
        update,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })

    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [noteId],
      memberId: campaign.player.memberDomainId,
      permission: 'edit',
    })
    await expect(
      asPlayer(campaign).mutation(api.resources.mutations.saveNoteContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId: noteId,
        update,
      }),
    ).resolves.toMatchObject({ status: 'completed', version: { revision: 2 } })
  })

  it('replays identical access commands and rejects operation id reuse', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = await createResource(campaign, campaignUuid, 'note', null, 'Idempotent')
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const args = {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'setAudienceAccess' as const,
        resourceIds: [resourceId],
        permission: 'view' as const,
      },
    }

    const first = await asDm(campaign).mutation(
      api.resources.mutations.executeResourceAccessCommand,
      args,
    )
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeResourceAccessCommand, args),
    ).resolves.toEqual(first)
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeResourceAccessCommand, {
        ...args,
        command: { ...args.command, permission: 'edit' },
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'operation_id_reused' })
  })

  it('rejects oversized access selections before operation or policy writes', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeResourceAccessCommand, {
        campaignId: campaignUuid,
        operationId,
        command: {
          type: 'clearAudienceAccess',
          resourceIds: Array.from({ length: 65 }, () => generateDomainId(DOMAIN_ID_KIND.resource)),
        },
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_command' })
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('resourceAccessOperations')
          .withIndex('by_campaign_and_operation', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('operationUuid', operationId),
          )
          .unique(),
      ).resolves.toBeNull()
    })
  })

  it('replays one canonical block access command without advancing note content', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const noteId = await createResource(campaign, campaignUuid, 'note', null, 'Blocks')
    const snapshot = await asDm(campaign).query(api.resources.queries.loadNoteContent, {
      campaignId: campaignUuid,
      resourceId: noteId,
    })
    if (snapshot.status !== 'ready') throw new TypeError('Expected note content')
    const [block] = decodeNoteYjsUpdatesToBlocks([{ update: snapshot.update }], NOTE_YJS_FRAGMENT)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const args = {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'setNoteBlockAudienceAccess' as const,
        noteId,
        blockIds: [block!.id],
        shared: true,
      },
    }

    const first = await asDm(campaign).mutation(
      api.resources.mutations.executeNoteBlockAccessCommand,
      args,
    )
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeNoteBlockAccessCommand, args),
    ).resolves.toEqual(first)
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeNoteBlockAccessCommand, {
        ...args,
        command: { ...args.command, shared: false },
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'operation_id_reused' })
    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', noteId))
        .unique()
      expect(content?.update).toEqual(snapshot.update)
      expect(content?.version).toEqual(snapshot.version)
      await expect(
        ctx.db
          .query('noteBlockAudienceAccess')
          .withIndex('by_note_and_block', (query) =>
            query
              .eq('campaignUuid', campaignUuid)
              .eq('noteUuid', noteId)
              .eq('blockUuid', block!.id),
          )
          .unique(),
      ).resolves.not.toBeNull()
    })
  })

  it('preserves concurrent note content and block access changes', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const noteId = generateDomainId(DOMAIN_ID_KIND.resource)
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId: noteId,
        kind: 'note',
        parentId: null,
        title: 'Concurrent blocks',
        icon: null,
        color: null,
      },
      update: makeYjsUpdateWithBlocks([
        {
          id: blockId,
          type: 'paragraph',
          content: [{ type: 'text', text: 'Base' }],
        },
      ]),
    })
    const snapshot = await asDm(campaign).query(api.resources.queries.loadNoteContent, {
      campaignId: campaignUuid,
      resourceId: noteId,
    })
    if (snapshot.status !== 'ready') throw new TypeError('Expected note content')
    const client = new Y.Doc()
    Y.applyUpdate(client, new Uint8Array(snapshot.update))
    const deltas: Array<Uint8Array> = []
    client.on('update', (update) => deltas.push(Uint8Array.from(update)))
    noteTextType(client).insert(noteTextType(client).length, ' concurrent edit')
    const update = Uint8Array.from(Y.mergeUpdates(deltas)).buffer
    client.destroy()

    const [access, content] = await Promise.all([
      asDm(campaign).mutation(api.resources.mutations.executeNoteBlockAccessCommand, {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'setNoteBlockAudienceAccess',
          noteId,
          blockIds: [blockId],
          shared: true,
        },
      }),
      asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
        campaignId: campaignUuid,
        generation: INITIAL_CONTENT_GENERATION,
        resourceId: noteId,
        update,
      }),
    ])

    expect(access.status).toBe('completed')
    expect(content).toMatchObject({
      status: 'completed',
      version: { revision: snapshot.version.revision + 1 },
    })
    const current = await asDm(campaign).query(api.resources.queries.loadNoteContent, {
      campaignId: campaignUuid,
      resourceId: noteId,
    })
    expect(current).toMatchObject({
      status: 'ready',
      version: { revision: snapshot.version.revision + 1 },
    })
    if (current.status !== 'ready') throw new TypeError('Expected updated note content')
    expect(
      JSON.stringify(decodeNoteYjsUpdatesToBlocks([{ update: current.update }], NOTE_YJS_FRAGMENT)),
    ).toContain('concurrent edit')
    await t.run(async (ctx) => {
      await expect(
        ctx.db
          .query('noteBlockAudienceAccess')
          .withIndex('by_note_and_block', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('noteUuid', noteId).eq('blockUuid', blockId),
          )
          .unique(),
      ).resolves.not.toBeNull()
    })
  })

  it('projects only the current actor policies when other-member volume exceeds the read bound', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const noteId = await createResource(campaign, campaignUuid, 'note', null, 'Bounded policies')
    const snapshot = await asDm(campaign).query(api.resources.queries.loadNoteContent, {
      campaignId: campaignUuid,
      resourceId: noteId,
    })
    if (snapshot.status !== 'ready') throw new TypeError('Expected note content')
    const [block] = decodeNoteYjsUpdatesToBlocks([{ update: snapshot.update }], NOTE_YJS_FRAGMENT)
    if (!block) throw new TypeError('Expected note block')
    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [noteId],
      memberId: campaign.player.memberDomainId,
      permission: 'view',
    })
    await asDm(campaign).mutation(api.resources.mutations.executeNoteBlockAccessCommand, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'setNoteBlockAudienceAccess',
        noteId,
        blockIds: [block.id],
        shared: true,
      },
    })
    const unrelatedRows = Array.from({ length: 4_100 }, () => ({
      blockId: generateDomainId(DOMAIN_ID_KIND.noteBlock),
      memberId: generateDomainId(DOMAIN_ID_KIND.campaignMember),
    }))
    for (let offset = 0; offset < unrelatedRows.length; offset += 250) {
      const chunk = unrelatedRows.slice(offset, offset + 250)
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await t.run(async (ctx) => {
        await Promise.all(
          chunk.map(({ blockId, memberId }) =>
            ctx.db.insert('noteBlockMemberAccess', {
              campaignUuid,
              noteUuid: noteId,
              blockUuid: blockId,
              memberUuid: memberId,
              visibility: 'visible',
            }),
          ),
        )
      })
    }

    await expect(
      asPlayer(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toMatchObject({ status: 'ready' })
  })

  it('acknowledges note saves before removed-block policy cleanup drains in bounded batches', async () => {
    vi.useFakeTimers()
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const noteId = generateDomainId(DOMAIN_ID_KIND.resource)
    const blockIds = Array.from({ length: 130 }, () => generateDomainId(DOMAIN_ID_KIND.noteBlock))
    const update = makeYjsUpdateWithBlocks(
      blockIds.map((id, index) => ({
        id,
        type: 'paragraph',
        content: [{ type: 'text', text: `Block ${index}` }],
      })),
    )
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId: noteId,
        kind: 'note',
        parentId: null,
        title: 'Cleanup',
        icon: null,
        color: null,
      },
      update,
    })
    await t.run(async (ctx) => {
      await Promise.all(
        blockIds.flatMap((blockId) => [
          ctx.db.insert('noteBlockAudienceAccess', {
            campaignUuid,
            noteUuid: noteId,
            blockUuid: blockId,
          }),
          ctx.db.insert('noteBlockMemberAccess', {
            campaignUuid,
            noteUuid: noteId,
            blockUuid: blockId,
            memberUuid: campaign.player.memberDomainId,
            visibility: 'visible',
          }),
        ]),
      )
    })
    const document = new Y.Doc()
    Y.applyUpdate(document, new Uint8Array(update))
    const stateVector = Y.encodeStateVector(document)
    const blockGroup = document.getXmlFragment(NOTE_YJS_FRAGMENT).get(0)
    if (!(blockGroup instanceof Y.XmlElement)) throw new TypeError('Expected note block group')
    blockGroup.delete(1, blockIds.length - 1)
    const delta = Uint8Array.from(Y.encodeStateAsUpdate(document, stateVector)).buffer
    document.destroy()

    const saved = await asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
      campaignId: campaignUuid,
      generation: INITIAL_CONTENT_GENERATION,
      resourceId: noteId,
      update: delta,
    })
    expect(saved).toMatchObject({ status: 'completed', version: { revision: 2 } })
    if (saved.status !== 'completed') throw new TypeError('Expected completed save')
    await t.run(async (ctx) => {
      expect(
        await ctx.db
          .query('noteBlockAudienceAccess')
          .withIndex('by_note', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('noteUuid', noteId),
          )
          .collect(),
      ).toHaveLength(130)
      await expect(
        ctx.db
          .query('noteBlockAccessCleanupIntents')
          .withIndex('by_note', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('noteUuid', noteId),
          )
          .unique(),
      ).resolves.toMatchObject({ stage: 'audience', cursor: null })
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    await t.run(async (ctx) => {
      const [audienceRows, memberRows, intent] = await Promise.all([
        ctx.db
          .query('noteBlockAudienceAccess')
          .withIndex('by_note', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('noteUuid', noteId),
          )
          .collect(),
        ctx.db
          .query('noteBlockMemberAccess')
          .withIndex('by_note', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('noteUuid', noteId),
          )
          .collect(),
        ctx.db
          .query('noteBlockAccessCleanupIntents')
          .withIndex('by_note', (query) =>
            query.eq('campaignUuid', campaignUuid).eq('noteUuid', noteId),
          )
          .unique(),
      ])
      expect(audienceRows.map((row) => row.blockUuid)).toEqual([blockIds[0]])
      expect(memberRows.map((row) => row.blockUuid)).toEqual([blockIds[0]])
      expect(intent).toBeNull()
    })
    await expect(
      t.mutation(internal.resources.internalMutations.cleanupNoteBlockAccess, {
        campaignId: campaignUuid,
        noteId,
        contentVersion: saved.version,
      }),
    ).resolves.toBeNull()
  })

  it('revokes a removed member immediately without deleting retained access rows', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = await createResource(campaign, campaignUuid, 'note', null, 'Membership')
    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [resourceId],
      memberId: campaign.player.memberDomainId,
      permission: 'view',
    })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResource, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toMatchObject({ resources: [{ id: resourceId, permission: 'view' }] })

    await asDm(campaign).mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignUuid,
      memberId: campaign.player.memberDomainId,
      status: CAMPAIGN_MEMBER_STATUS.Removed,
    })

    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResource, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).rejects.toThrow()
    await t.run(async (ctx) => {
      const retained = await ctx.db
        .query('resourceMemberAccess')
        .withIndex('by_resource_and_member', (query) =>
          query
            .eq('campaignUuid', campaignUuid)
            .eq('resourceUuid', resourceId)
            .eq('memberUuid', campaign.player.memberDomainId),
        )
        .unique()
      expect(retained?.permission).toBe('view')
    })
  })

  async function getCampaignUuid(campaignId: Id<'campaigns'>) {
    return await t.run(async (ctx) => {
      return (await ctx.db.get('campaigns', campaignId))!.campaignUuid
    })
  }

  async function getMetadataVersion(resourceId: ResourceId) {
    return await t.run(async (ctx) => {
      const resource = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      return resource!.metadataVersion
    })
  }

  async function storedFileVersion(resourceId: ResourceId) {
    return await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      if (!content) throw new TypeError('Expected file content')
      return content.version
    })
  }

  async function storedMapVersion(resourceId: ResourceId) {
    return await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceMapContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      if (!content) throw new TypeError('Expected map content')
      return content.version
    })
  }

  async function createResource(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    campaignUuid: string,
    kind: 'canvas' | 'file' | 'folder' | 'map' | 'note',
    parentId: ResourceId | null,
    title: string,
  ): Promise<ResourceId> {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const command = {
      type: 'create',
      resourceId,
      kind,
      parentId,
      title,
      icon: null,
      color: null,
    } as const
    if (kind === 'file') {
      const result = await createEmptyFile(campaign, campaignUuid, operationId, parentId)
      expect(result.status).toBe('settled')
      const entry = result.status === 'settled' ? result.entries[0] : null
      if (!entry || entry.status !== 'completed') {
        throw new TypeError('Expected completed file transfer')
      }
      return assertDomainId(DOMAIN_ID_KIND.resource, entry.resourceId)
    }
    const result =
      kind === 'folder'
        ? await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
            campaignId: campaignUuid,
            operationId,
            command,
          })
        : kind === 'note'
          ? await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
              campaignId: campaignUuid,
              operationId,
              command,
              update: makeYjsUpdateWithBlocks([{ type: 'paragraph' }]),
            })
          : kind === 'map'
            ? await asDm(campaign).mutation(api.resources.mutations.createMapResource, {
                campaignId: campaignUuid,
                operationId,
                command,
              })
            : await asDm(campaign).mutation(api.resources.mutations.createCanvasResource, {
                campaignId: campaignUuid,
                operationId,
                command,
              })
    expect(result.status).toBe('completed')
    return resourceId
  }

  async function createEmptyFile(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    campaignUuid: string,
    operationId: string,
    parentId: ResourceId | null,
  ) {
    const bytes = new TextEncoder().encode('x')
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([bytes]),
      'empty.txt',
    )
    return await commitTestPlainTransfer(
      asDm(campaign),
      singleFileTransferArgs({
        campaignId: campaignUuid,
        jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
        operationId,
        destinationParentId: parentId,
        uploadSessionId: upload.sessionId,
      }),
    )
  }

  function singleFileTransferArgs(
    args: Readonly<{
      campaignId: string
      jobId: string
      operationId: string
      destinationParentId: ResourceId | null
      uploadSessionId: Id<'fileStorage'>
    }>,
    fileName = 'fixture.txt',
  ) {
    const { uploadSessionId, ...intent } = args
    return {
      ...intent,
      textFileHandling: 'files' as const,
      sources: [{ id: 'selected-file', kind: 'file' as const, name: fileName }],
      entries: [
        {
          sourceId: 'selected-file',
          path: fileName,
          type: 'file' as const,
          uploadSessionId,
        },
      ],
    }
  }

  async function commitTestPlainTransfer(
    client: ReturnType<typeof asDm>,
    transfer: Readonly<{
      campaignId: string
      jobId: string
      destinationParentId: ResourceId | null
      textFileHandling: 'files' | 'notes'
      sources: ReadonlyArray<{
        id: string
        kind: 'directory' | 'file' | 'zip'
        name: string
      }>
      entries: ReadonlyArray<
        | Readonly<{ sourceId: string; path: string; type: 'directory' }>
        | Readonly<{
            sourceId: string
            path: string
            type: 'file'
            uploadSessionId: Id<'fileStorage'>
          }>
      >
    }>,
  ) {
    const entries = await Promise.all(
      transfer.entries.map(async (entry) => {
        if (entry.type === 'directory') return entry
        const byteSize = await t.run(async (ctx) => {
          const session = await ctx.db.get('fileStorage', entry.uploadSessionId)
          if (!session?.storageId) throw new TypeError('Expected a bound test upload')
          const metadata = await ctx.db.system.get('_storage', session.storageId)
          if (!metadata) throw new TypeError('Expected test upload metadata')
          return metadata.size
        })
        return { sourceId: entry.sourceId, path: entry.path, type: 'file' as const, byteSize }
      }),
    )
    const reservation = await client.mutation(api.resources.mutations.reservePlainTransfer, {
      campaignId: transfer.campaignId,
      jobId: transfer.jobId,
      destinationParentId: transfer.destinationParentId,
      textFileHandling: transfer.textFileHandling,
      sources: [...transfer.sources],
      entries,
    })
    if (reservation.status === 'rejected') return reservation
    for (const target of reservation.uploadTargets) {
      const entry = transfer.entries.find(
        (candidate) =>
          candidate.type === 'file' &&
          candidate.sourceId === target.sourceId &&
          candidate.path === target.sourcePath,
      )
      if (!entry || entry.type !== 'file') throw new TypeError('Expected reserved test upload')
      await t.run(async (ctx) => {
        const source = await ctx.db.get('fileStorage', entry.uploadSessionId)
        if (source?.status !== 'uncommitted') return
        const transferEntries = await ctx.db
          .query('resourceTransferEntries')
          .withIndex('by_campaign_and_job', (query) =>
            query.eq('campaignUuid', transfer.campaignId).eq('importJobUuid', transfer.jobId),
          )
          .take(100)
        const transferEntry = transferEntries.find(
          (candidate) =>
            candidate.sourceRootId === target.sourceId &&
            candidate.sourceEntryPath === target.sourcePath,
        )
        if (!transferEntry) throw new TypeError('Expected reserved transfer entry')
        await ctx.db.delete('fileStorage', target.sessionId)
        await ctx.db.patch('resourceTransferEntries', transferEntry._id, {
          uploadSessionUuid: source._id,
        })
        await ctx.db.patch('fileStorage', source._id, {
          originalFileName: target.sourcePath.slice(target.sourcePath.lastIndexOf('/') + 1),
        })
      })
    }
    return await client.action(api.resources.actions.commitPlainTransfer, {
      campaignId: transfer.campaignId,
      jobId: transfer.jobId,
    })
  }

  async function execute(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    campaignUuid: string,
    command: StoredResourceStructureCommand,
  ) {
    return await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command,
    })
  }

  async function executeAccess(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    campaignUuid: string,
    command: StoredResourceAccessCommand,
  ) {
    const result = await asDm(campaign).mutation(
      api.resources.mutations.executeResourceAccessCommand,
      {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command,
      },
    )
    expect(result.status).toBe('completed')
    return result
  }

  async function storedParentIds(...resourceIds: ReadonlyArray<ResourceId>) {
    return await t.run(async (ctx) =>
      Promise.all(
        resourceIds.map(async (resourceId) => {
          const resource = await ctx.db
            .query('resources')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .unique()
          return resource?.parentResourceUuid ?? null
        }),
      ),
    )
  }

  async function storedContentState(noteId: ResourceId, canvasId: ResourceId) {
    return await t.run(async (ctx) => {
      const note = await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', noteId))
        .unique()
      const canvas = await ctx.db
        .query('resourceCanvasContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', canvasId))
        .unique()
      return {
        note: note
          ? { update: Array.from(new Uint8Array(note.update)), version: note.version }
          : null,
        canvas: canvas
          ? { update: Array.from(new Uint8Array(canvas.update)), version: canvas.version }
          : null,
      }
    })
  }
})

function testPng(width: number, height: number): Uint8Array {
  const encoded = TEST_PNGS[`${width}x${height}` as keyof typeof TEST_PNGS]
  if (!encoded) throw new Error(`Missing ${width}x${height} PNG fixture`)
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
}

const TEST_PNGS = {
  '1x1':
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGMQYGD4DwABRAEQxIHbdwAAAABJRU5ErkJggg==',
  '2x3':
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGNwYGD4D8IMGAwAXlMHe5y9UukAAAAASUVORK5CYII=',
  '4x4':
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVR4nGNoYGD4j4wZSBcAACJpF/G0gtPTAAAAAElFTkSuQmCC',
} as const

function noteTextType(document: Y.Doc): Y.XmlText {
  const group = document.getXmlFragment(NOTE_YJS_FRAGMENT).get(0)
  const container = group instanceof Y.XmlElement ? group.get(0) : null
  const paragraph = container instanceof Y.XmlElement ? container.get(0) : null
  const text = paragraph instanceof Y.XmlElement ? paragraph.get(0) : null
  if (!(text instanceof Y.XmlText)) throw new Error('Expected canonical note text')
  return text
}

function noteUpdateWithDuplicateBlockIds(nested: boolean): ArrayBuffer {
  const document = noteBlocksToYDoc(
    nested
      ? [
          {
            type: 'paragraph',
            children: [{ type: 'paragraph' }],
          },
        ]
      : [{ type: 'paragraph' }, { type: 'paragraph' }],
    NOTE_YJS_FRAGMENT,
  )
  const elements = noteBlockElements(document)
  elements[1]!.setAttribute('id', elements[0]!.getAttribute('id')!)
  const update = noteDocumentUpdate(document)
  document.destroy()
  return update
}

function noteBlockElements(document: Y.Doc): Array<Y.XmlElement> {
  const elements: Array<Y.XmlElement> = []
  const pending: Array<Y.XmlFragment | Y.XmlElement> = [document.getXmlFragment(NOTE_YJS_FRAGMENT)]
  while (pending.length > 0) {
    const parent = pending.pop()!
    for (let index = parent.length - 1; index >= 0; index -= 1) {
      const child = parent.get(index)
      if (!(child instanceof Y.XmlElement)) continue
      if (typeof child.getAttribute('id') === 'string') elements.push(child)
      pending.push(child)
    }
  }
  return elements
}

function noteDocumentUpdate(document: Y.Doc, vector?: Uint8Array): ArrayBuffer {
  return Uint8Array.from(Y.encodeStateAsUpdate(document, vector)).buffer
}
