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

  it('distinguishes initializing, ready, unauthorized, and missing note content', async () => {
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

    await expect(
      asDm(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toEqual({ status: 'initializing', operationId })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'unauthorized' })

    const update = makeYjsUpdateWithBlocks([
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Ready' }],
      },
    ])
    const bound = await asDm(campaign).mutation(api.resources.mutations.bindNoteContent, {
      campaignId: campaignUuid,
      operationId,
      resourceId,
      update,
    })
    if (bound.status !== 'completed') throw new Error('Expected note content to bind')
    await expect(
      asDm(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toEqual({ status: 'ready', update, version: bound.version })

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
          assetId: null,
          extension: null,
          mediaType: 'application/octet-stream',
          originalName: null,
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
    const result = await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command,
    })
    expect(result.status).toBe('completed')
    return resourceId
  }
})
