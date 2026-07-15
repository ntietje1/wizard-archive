import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-record'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import type { FunctionArgs } from 'convex/server'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { makeYjsUpdateWithBlocks } from '../../_test/yjs.helper'
import {
  storeCommittedTestUploadSession,
  storeUncommittedTestUploadSession,
} from '../../_test/storage.helper'
import { initialFileContentVersion } from '@wizard-archive/editor/resources/content-version'

type StoredResourceStructureCommand = FunctionArgs<
  typeof api.resources.mutations.executeStructureCommand
>['command']

describe('authorized resource projection', () => {
  const t = createTestContext()

  it('loads an authorized resource with its complete visible ancestor spine', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const rootId = await createResource(campaign, campaignUuid, 'folder', null, 'Root')
    const folderId = await createResource(campaign, campaignUuid, 'folder', rootId, 'Folder')
    const noteId = await createResource(campaign, campaignUuid, 'note', folderId, 'Note')

    const snapshot = await asDm(campaign).query(api.resources.queries.loadResource, {
      campaignId: campaignUuid,
      resourceId: noteId,
    })

    expect(snapshot.scope).toEqual({
      campaignId: campaignUuid,
      actorId: await getMemberUuid(campaign.dm.memberId),
      projection: 'dm',
      schema: RESOURCE_INDEX_SCHEMA,
    })
    expect(snapshot.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: rootId, displayParentId: null }),
        expect.objectContaining({ id: folderId, displayParentId: rootId }),
        expect.objectContaining({ id: noteId, displayParentId: folderId }),
      ]),
    )
    expect(snapshot.resources).toHaveLength(3)
    expect(snapshot.missingResourceIds).toEqual([])
  })

  it('returns neutral missing and empty collection knowledge to an actor without access', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = await createResource(campaign, campaignUuid, 'note', null, 'Secret')

    const resource = await asPlayer(campaign).query(api.resources.queries.loadResource, {
      campaignId: campaignUuid,
      resourceId,
    })
    const collection = await asPlayer(campaign).query(api.resources.queries.loadCollection, {
      campaignId: campaignUuid,
      query: { parentId: null, lifecycle: 'active' },
    })

    expect(resource.resources).toEqual([])
    expect(resource.missingResourceIds).toEqual([resourceId])
    expect(collection.snapshot.resources).toEqual([])
    expect(collection.snapshot.collections).toEqual([
      {
        query: { parentId: null, lifecycle: 'active' },
        resourceIds: [],
        complete: true,
      },
    ])
  })

  it('loads normalized authorized collections without exposing unrelated resource kinds', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const folderId = await createResource(campaign, campaignUuid, 'folder', null, 'Folder')
    await createResource(campaign, campaignUuid, 'note', null, 'Note')

    const first = await asDm(campaign).query(api.resources.queries.loadCollection, {
      campaignId: campaignUuid,
      query: { parentId: null, lifecycle: 'active', kinds: ['folder', 'folder'] },
    })
    const replay = await asDm(campaign).query(api.resources.queries.loadCollection, {
      campaignId: campaignUuid,
      query: { parentId: null, lifecycle: 'active', kinds: ['folder'] },
    })

    expect(first.snapshot.collections).toEqual([
      {
        query: { parentId: null, lifecycle: 'active', kinds: ['folder'] },
        resourceIds: [folderId],
        complete: true,
      },
    ])
    expect(first.snapshot.resources).toEqual([
      expect.objectContaining({ id: folderId, kind: 'folder' }),
    ])
    expect(first.cursor).toBeNull()
    expect(first.snapshot.revision).toBe(replay.snapshot.revision)
  })

  it('projects trashed children of active folders as canonical trash roots', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const folderId = await createResource(campaign, campaignUuid, 'folder', null, 'Folder')
    const childId = await createResource(campaign, campaignUuid, 'note', folderId, 'Child')
    await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: { type: 'trash', resourceIds: [childId] },
    })

    const page = await asDm(campaign).query(api.resources.queries.loadCollection, {
      campaignId: campaignUuid,
      query: { parentId: null, lifecycle: 'trashed' },
    })

    expect(page.snapshot.collections).toEqual([
      {
        query: { parentId: null, lifecycle: 'trashed' },
        resourceIds: [childId],
        complete: true,
      },
    ])
    expect(page.snapshot.resources).toEqual([
      expect.objectContaining({ id: childId, displayParentId: null, lifecycle: 'trashed' }),
    ])
  })

  it('does not reveal a resource owned by another campaign', async () => {
    const firstCampaign = await setupCampaignContext(t)
    const secondCampaign = await setupCampaignContext(t)
    const firstCampaignUuid = await getCampaignUuid(firstCampaign.campaignId)
    const secondCampaignUuid = await getCampaignUuid(secondCampaign.campaignId)
    const foreignId = await createResource(
      secondCampaign,
      secondCampaignUuid,
      'note',
      null,
      'Foreign',
    )

    const snapshot = await asDm(firstCampaign).query(api.resources.queries.loadResource, {
      campaignId: firstCampaignUuid,
      resourceId: foreignId,
    })

    expect(snapshot.resources).toEqual([])
    expect(snapshot.missingResourceIds).toEqual([foreignId])
  })

  it('distinguishes ready, unauthorized, and missing note content', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const update = makeYjsUpdateWithBlocks([
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Ready' }],
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
        title: 'Note',
        icon: null,
        color: null,
      },
      update,
    })

    await expect(
      asDm(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toEqual({ status: 'ready', update, version: expect.any(Object) })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'unauthorized' })

    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      await ctx.db.delete(content!._id)
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toEqual({ status: 'integrity_error', issue: 'content_missing' })
  })

  it('loads provider-neutral file, map, and canvas content states', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const fileId = await createResource(campaign, campaignUuid, 'file', null, 'File')
    const mapId = await createResource(campaign, campaignUuid, 'map', null, 'Map')
    const canvasId = await createResource(campaign, campaignUuid, 'canvas', null, 'Canvas')

    await expect(
      asDm(campaign).query(api.resources.queries.loadContent, {
        campaignId: campaignUuid,
        resourceId: fileId,
        kind: 'file',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        kind: 'file',
        content: {
          assetId: expect.any(String),
          classification: 'inert_file',
          byteSize: 1,
          detectedFormat: null,
          extension: 'txt',
          mediaType: 'text/plain',
          viewerUnavailableReason: 'unsupported_format',
        },
      }),
    )
    await expect(
      asDm(campaign).query(api.resources.queries.loadContent, {
        campaignId: campaignUuid,
        resourceId: mapId,
        kind: 'map',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        kind: 'map',
        content: { imageAssetId: null, layers: [], pins: [] },
      }),
    )
    await expect(
      asDm(campaign).query(api.resources.queries.loadContent, {
        campaignId: campaignUuid,
        resourceId: canvasId,
        kind: 'canvas',
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 'ready', kind: 'canvas' }))

    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', fileId))
        .unique()
      await ctx.db.patch(content!._id, { state: 'initializing' })
      await ctx.db.insert('resourceAssetCopyIntents', {
        campaignUuid,
        resourceUuid: fileId,
        operationUuid: operationId,
        sourceAssetUuid: generateDomainId(DOMAIN_ID_KIND.asset),
        destinationAssetUuid: generateDomainId(DOMAIN_ID_KIND.asset),
        status: 'pending',
        attempts: 0,
        lastAttemptAt: null,
        lastError: null,
        createdAt: Date.now(),
      })
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadContent, {
        campaignId: campaignUuid,
        resourceId: fileId,
        kind: 'file',
      }),
    ).resolves.toEqual({ status: 'initializing', operationId })
    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', fileId))
        .unique()
      await ctx.db.patch(content!._id, { state: 'failed' })
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadContent, {
        campaignId: campaignUuid,
        resourceId: fileId,
        kind: 'file',
      }),
    ).resolves.toEqual({ status: 'integrity_error', issue: 'content_missing' })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadContent, {
        campaignId: campaignUuid,
        resourceId: mapId,
        kind: 'map',
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'unauthorized' })
    await expect(
      asDm(campaign).query(api.resources.queries.loadContent, {
        campaignId: campaignUuid,
        resourceId: mapId,
        kind: 'canvas',
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'capability_not_supported' })
  })

  it('resolves file downloads only through the authorized file owner', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const fileId = await createResource(campaign, campaignUuid, 'file', null, 'Evidence')
    const bytes = new TextEncoder().encode('exact evidence bytes')
    const upload = await storeCommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([bytes]),
      'evidence.txt',
    )
    await t.run(async (ctx) => {
      const content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', fileId))
        .unique()
      const metadata = {
        classification: 'inert_file' as const,
        byteSize: bytes.byteLength,
        detectedFormat: null,
        extension: 'txt',
        mediaType: 'text/plain',
        viewerUnavailableReason: 'unsupported_format' as const,
      }
      await ctx.db.replace(content!._id, {
        campaignUuid,
        resourceUuid: fileId,
        state: 'ready',
        assetUuid: upload.assetId,
        ...metadata,
        version: await initialFileContentVersion(bytes, metadata),
      })
    })

    await expect(
      asDm(campaign).query(api.resources.queries.loadFileDownload, {
        campaignId: campaignUuid,
        resourceId: fileId,
      }),
    ).resolves.toEqual({ status: 'ready', url: expect.any(String) })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadFileDownload, {
        campaignId: campaignUuid,
        resourceId: fileId,
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'unauthorized' })
  })

  it('searches active resource titles and note bodies', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const noteId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'create',
        resourceId: noteId,
        kind: 'note',
        parentId: null,
        title: 'Adventure Log',
        icon: null,
        color: null,
      },
      update: makeYjsUpdateWithBlocks([
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'paragraph',
          content: [{ type: 'text', text: 'The hidden citadel awaits.' }],
        },
      ]),
    })

    const titleSearch = await asDm(campaign).query(api.resources.queries.searchResources, {
      campaignId: campaignUuid,
      query: 'adventure',
    })
    expect(titleSearch).toMatchObject({
      results: [{ resourceId: noteId, match: { type: 'title' } }],
      snapshot: { resources: [{ id: noteId }], missingResourceIds: [], collections: [] },
    })
    const bodySearch = await asDm(campaign).query(api.resources.queries.searchResources, {
      campaignId: campaignUuid,
      query: 'citadel',
    })
    expect(bodySearch).toMatchObject({
      results: [
        { resourceId: noteId, match: { type: 'body', text: 'The hidden citadel awaits.' } },
      ],
      snapshot: { resources: [{ id: noteId }], missingResourceIds: [], collections: [] },
    })

    await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: { type: 'trash', resourceIds: [noteId] },
    })
    await expect(
      asDm(campaign).query(api.resources.queries.searchResources, {
        campaignId: campaignUuid,
        query: 'citadel',
      }),
    ).resolves.toMatchObject({ results: [] })

    await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: { type: 'restore', resourceIds: [noteId] },
    })
    await expect(
      asDm(campaign).query(api.resources.queries.searchResources, {
        campaignId: campaignUuid,
        query: 'citadel',
      }),
    ).resolves.toMatchObject({ results: [{ resourceId: noteId }] })
  })

  async function getCampaignUuid(campaignId: Id<'campaigns'>) {
    return await t.run(async (ctx) => (await ctx.db.get('campaigns', campaignId))!.campaignUuid)
  }

  async function getMemberUuid(memberId: Id<'campaignMembers'>) {
    return await t.run(
      async (ctx) => (await ctx.db.get('campaignMembers', memberId))!.campaignMemberUuid,
    )
  }

  async function createResource(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    campaignUuid: string,
    kind: ResourceKind,
    parentId: ResourceId | null,
    title: string,
  ) {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const command: StoredResourceStructureCommand = {
      type: 'create',
      resourceId,
      kind,
      parentId,
      title,
      icon: null,
      color: null,
    }
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
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
              update: makeYjsUpdateWithBlocks([]),
            })
          : kind === 'map'
            ? await asDm(campaign).mutation(api.resources.mutations.createMapResource, {
                campaignId: campaignUuid,
                operationId,
                command,
              })
            : kind === 'canvas'
              ? await asDm(campaign).mutation(api.resources.mutations.createCanvasResource, {
                  campaignId: campaignUuid,
                  operationId,
                  command,
                })
              : await createEmptyFile(campaign, campaignUuid, operationId, command)
    expect(result.status).toBe('completed')
    return resourceId
  }

  async function createEmptyFile(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    campaignUuid: string,
    operationId: string,
    command: Extract<StoredResourceStructureCommand, { type: 'create' }>,
  ) {
    const bytes = new TextEncoder().encode('x')
    const metadata = {
      classification: 'inert_file' as const,
      byteSize: bytes.byteLength,
      detectedFormat: null,
      extension: 'txt',
      mediaType: 'text/plain',
      viewerUnavailableReason: 'unsupported_format' as const,
    }
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([bytes]),
      'empty.txt',
    )
    return await asDm(campaign).mutation(api.resources.mutations.createFileResource, {
      campaignId: campaignUuid,
      operationId,
      command,
      uploadSessionId: upload.sessionId,
      metadata,
      version: await initialFileContentVersion(bytes, metadata),
    })
  }
})
