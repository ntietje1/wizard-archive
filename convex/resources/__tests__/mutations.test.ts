import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { initialResourceMetadataVersion } from '@wizard-archive/editor/resources/resource-metadata-version'
import type { FunctionArgs } from 'convex/server'
import { api, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { makeYjsUpdateWithBlocks } from '../../_test/yjs.helper'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import {
  createCanvasDocumentDoc,
  readCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import * as Y from 'yjs'
import { initialBinaryContentVersion, initialJsonContentVersion } from '../functions/contentVersion'
import {
  storeCommittedTestUploadSession,
  storeUncommittedTestUploadSession,
} from '../../_test/storage.helper'
import { initialFileContentVersion } from '@wizard-archive/editor/resources/content-version'

type StoredResourceStructureCommand = FunctionArgs<
  typeof api.resources.mutations.executeStructureCommand
>['command']

describe('resource structure commands', () => {
  const t = createTestContext()

  afterEach(() => vi.useRealTimers())

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
    const compensation = {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'updateMetadata' as const,
        resourceId,
        changes: { title: 'Original' },
      },
      expectedPostconditions: renamed.receipt.postconditions,
    }

    const first = await asDm(campaign).mutation(
      api.resources.mutations.executeStructureCompensation,
      compensation,
    )
    const replay = await asDm(campaign).mutation(
      api.resources.mutations.executeStructureCompensation,
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
      asDm(campaign).mutation(api.resources.mutations.executeStructureCompensation, {
        ...compensation,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        expectedPostconditions: first.status === 'completed' ? first.receipt.postconditions : [],
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'stale_history' })
    await t.run(async (ctx) => {
      const resource = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      expect(resource?.title).toBe('Later edit')
    })
  })

  it('atomically creates a file resource from one owned upload', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const bytes = new TextEncoder().encode('uploaded bytes')
    const metadata = {
      classification: 'inert_file' as const,
      byteSize: bytes.byteLength,
      detectedFormat: null,
      extension: 'txt',
      mediaType: 'application/octet-stream',
      viewerUnavailableReason: 'unsupported_format' as const,
    }
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([bytes]),
      'evidence.txt',
    )

    const result = await asDm(campaign).mutation(api.resources.mutations.createFileResource, {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'create',
        resourceId,
        kind: 'file',
        parentId: null,
        title: 'evidence.txt',
        icon: null,
        color: null,
      },
      uploadSessionId: upload.sessionId,
      metadata,
      version: await initialFileContentVersion(bytes, metadata),
    })

    expect(result).toMatchObject({
      status: 'completed',
      receipt: { result: { type: 'created', resourceId } },
    })
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
    })
  })

  it('creates a canonical resource and stores an actor-bound replay receipt', async () => {
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

    const first = await asDm(campaign).mutation(
      api.resources.mutations.executeStructureCommand,
      args,
    )
    const replay = await asDm(campaign).mutation(
      api.resources.mutations.executeStructureCommand,
      args,
    )

    expect(first.status).toBe('completed')
    expect(replay).toEqual(first)
    await t.run(async (ctx) => {
      const resource = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      expect(resource).toEqual(
        expect.objectContaining({
          campaignUuid,
          lifecycle: 'active',
          resourceUuid: resourceId,
          title: 'Session Notes',
        }),
      )
      const operations = await ctx.db
        .query('resourceOperations')
        .withIndex('by_campaign_and_operation', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('operationUuid', operationId),
        )
        .take(2)
      expect(operations).toHaveLength(1)
      expect(
        await ctx.db
          .query('resourceNoteContents')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
          .unique(),
      ).toEqual(
        expect.objectContaining({
          initializationOperationUuid: operationId,
          state: 'initializing',
        }),
      )
      expect(
        await ctx.db
          .query('resourceNoteInitializationIntents')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
          .unique(),
      ).toEqual(expect.objectContaining({ operationUuid: operationId, status: 'pending' }))
    })
  })

  it('binds the creating note document idempotently and rejects replacement content', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'create',
        resourceId,
        kind: 'note',
        parentId: null,
        title: 'Note',
        icon: null,
        color: null,
      },
    })
    const update = makeYjsUpdateWithBlocks([
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Local edit' }],
      },
    ])
    const args = { campaignId: campaignUuid, operationId, resourceId, update }

    const first = await asDm(campaign).mutation(api.resources.mutations.bindNoteContent, args)
    const replay = await asDm(campaign).mutation(api.resources.mutations.bindNoteContent, args)

    expect(first).toEqual(
      expect.objectContaining({
        status: 'completed',
        resourceId,
        version: expect.objectContaining({ revision: 1 }),
      }),
    )
    expect(replay).toEqual(first)
    await expect(
      asDm(campaign).mutation(api.resources.mutations.bindNoteContent, {
        ...args,
        update: makeYjsUpdateWithBlocks([
          {
            id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
            type: 'paragraph',
            content: [{ type: 'text', text: 'Replacement' }],
          },
        ]),
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'already_initialized' })
    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      expect(content).toEqual(
        expect.objectContaining({
          state: 'ready',
          version: expect.objectContaining({ revision: 1 }),
        }),
      )
      expect(
        await ctx.db
          .query('resourceNoteInitializationIntents')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
          .take(1),
      ).toHaveLength(0)
    })
  })

  it('merges concurrent canonical note updates and advances the content revision', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
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
    })
    const baseUpdate = makeYjsUpdateWithBlocks([
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Middle' }],
      },
    ])
    await asDm(campaign).mutation(api.resources.mutations.bindNoteContent, {
      campaignId: campaignUuid,
      operationId,
      resourceId,
      update: baseUpdate,
    })

    const firstClient = new Y.Doc()
    const secondClient = new Y.Doc()
    Y.applyUpdate(firstClient, new Uint8Array(baseUpdate))
    Y.applyUpdate(secondClient, new Uint8Array(baseUpdate))
    noteTextType(firstClient).insert(0, 'First ')
    const secondText = noteTextType(secondClient)
    secondText.insert(secondText.length, ' Second')
    const firstUpdate = Uint8Array.from(Y.encodeStateAsUpdate(firstClient)).buffer
    const secondUpdate = Uint8Array.from(Y.encodeStateAsUpdate(secondClient)).buffer
    firstClient.destroy()
    secondClient.destroy()
    const first = await asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
      campaignId: campaignUuid,
      resourceId,
      update: firstUpdate,
    })
    const second = await asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
      campaignId: campaignUuid,
      resourceId,
      update: secondUpdate,
    })

    expect(first).toMatchObject({ status: 'completed', version: { revision: 2 } })
    expect(second).toMatchObject({ status: 'completed', version: { revision: 3 } })
    if (second.status !== 'completed') throw new Error('Expected merged note content')
    const blocks = decodeNoteYjsUpdatesToBlocks([{ update: second.update }], NOTE_YJS_FRAGMENT)
    expect(
      blocks
        .flatMap((block) =>
          Array.isArray(block.content)
            ? block.content.flatMap((inline) => (inline.type === 'text' ? [inline.text] : []))
            : [],
        )
        .join(''),
    ).toBe('First Middle Second')
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
          assetUuid: null,
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
      kind: 'note',
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
    await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
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
    })
    const sourceBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    await asDm(campaign).mutation(api.resources.mutations.bindNoteContent, {
      campaignId: campaignUuid,
      operationId: noteOperationId,
      resourceId: noteId,
      update: makeYjsUpdateWithBlocks([
        {
          id: sourceBlockId,
          type: 'embed',
          props: { targetKind: 'resource', resourceId: mapId },
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
          data: { target: { kind: 'resource', resourceId: fileId } },
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
        imageAssetUuid: null,
        layers: [],
        version: await initialJsonContentVersion({
          imageAssetUuid: null,
          layers: [],
          pins: [{ mapPinUuid: sourcePinId, targetResourceUuid: noteId }],
        }),
      })
      await ctx.db.insert('resourceMapPins', {
        campaignUuid,
        mapResourceUuid: mapId,
        mapPinUuid: sourcePinId,
        targetResourceUuid: noteId,
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
          state: 'ready',
          version: expect.objectContaining({ revision: 1 }),
        }),
      )
      if (!noteContent || noteContent.state !== 'ready') throw new Error('Expected copied note')
      const [copiedBlock] = decodeNoteYjsUpdatesToBlocks(
        [{ update: noteContent.update }],
        NOTE_YJS_FRAGMENT,
      )
      expect(copiedBlock).toEqual(
        expect.objectContaining({
          id: expect.not.stringMatching(sourceBlockId),
          props: expect.objectContaining({ resourceId: copiedMap.resourceUuid }),
        }),
      )

      const [copiedPin] = await ctx.db
        .query('resourceMapPins')
        .withIndex('by_mapResourceUuid', (query) =>
          query.eq('mapResourceUuid', copiedMap.resourceUuid),
        )
        .take(2)
      expect(copiedPin).toEqual(
        expect.objectContaining({
          mapPinUuid: expect.not.stringMatching(sourcePinId),
          targetResourceUuid: copiedNote.resourceUuid,
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
          data: { target: { kind: 'resource', resourceId: copiedFile.resourceUuid } },
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
      expect(intent).not.toHaveProperty('storageId')
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

    await expect(
      execute(campaign, campaignUuid, {
        type: 'deepCopy',
        sourceRootIds: [noteId],
        destinationParentId: null,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'content_unavailable' })
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
      expect(
        await ctx.db
          .query('resourceNoteInitializationIntents')
          .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', deleteChildId))
          .take(1),
      ).toHaveLength(0)
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
      kind: 'note' as const,
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
    await expect(
      asDm(campaign).query(api.resources.queries.loadBookmarks, { campaignId: campaignUuid }),
    ).resolves.toEqual([resourceId])
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

  async function createResource(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    campaignUuid: string,
    kind: 'canvas' | 'file' | 'folder' | 'map' | 'note',
    parentId: ResourceId | null,
    title: string,
  ) {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const result = await execute(campaign, campaignUuid, {
      type: 'create',
      resourceId,
      kind,
      parentId,
      title,
      icon: null,
      color: null,
    })
    expect(result.status).toBe('completed')
    return resourceId
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
})

function noteTextType(document: Y.Doc): Y.XmlText {
  const group = document.getXmlFragment(NOTE_YJS_FRAGMENT).get(0)
  const container = group instanceof Y.XmlElement ? group.get(0) : null
  const paragraph = container instanceof Y.XmlElement ? container.get(0) : null
  const text = paragraph instanceof Y.XmlElement ? paragraph.get(0) : null
  if (!(text instanceof Y.XmlText)) throw new Error('Expected canonical note text')
  return text
}
