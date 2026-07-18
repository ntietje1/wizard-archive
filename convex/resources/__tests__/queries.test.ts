import { describe, expect, it } from 'vite-plus/test'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-record'
import {
  MAX_SYNCHRONOUS_RESOURCE_CLOSURE,
  canonicalizeResourceTitle,
} from '@wizard-archive/editor/resources/resource-record'
import { initialResourceMetadataVersion } from '@wizard-archive/editor/resources/resource-metadata-version'
import { MAX_RESOURCE_BOOKMARKS_PER_ACTOR } from '@wizard-archive/editor/resources/command-contract'
import { VERSION_SCHEME } from '@wizard-archive/editor/resources/component-version'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import type { FunctionArgs } from 'convex/server'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { makeYjsUpdateWithBlocks } from '../../_test/yjs.helper'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import {
  storeCommittedTestUploadSession,
  storeUncommittedTestUploadSession,
} from '../../_test/storage.helper'
import { initialFileContentVersion } from '@wizard-archive/editor/resources/content-version'
import {
  MAX_WORKSPACE_SEARCH_DOCUMENT_READS,
  MAX_WORKSPACE_SEARCH_PROVIDER_READ_BYTES,
  createResourceSearchDocument,
  normalizeResourceSearchText,
  searchResourceDocuments,
} from '@wizard-archive/editor/resources/search-policy'
import { CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'

type StoredResourceStructureCommand = FunctionArgs<
  typeof api.resources.mutations.executeStructureCommand
>['command']
type StoredResourceAccessCommand = FunctionArgs<
  typeof api.resources.mutations.executeResourceAccessCommand
>['command']
type StoredNoteBlockAccessCommand = FunctionArgs<
  typeof api.resources.mutations.executeNoteBlockAccessCommand
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

  it('projects membership availability reactively without requiring accepted campaign access', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const args = {
      campaignId: campaignUuid,
      actorId: campaign.player.memberDomainId,
      projection: 'player' as const,
    }

    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResourceProjectionAvailability, args),
    ).resolves.toBe(true)
    await asDm(campaign).mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignUuid,
      memberId: campaign.player.memberDomainId,
      status: CAMPAIGN_MEMBER_STATUS.Removed,
    })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResourceProjectionAvailability, args),
    ).resolves.toBe(false)
    await asDm(campaign).mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignUuid,
      memberId: campaign.player.memberDomainId,
      status: CAMPAIGN_MEMBER_STATUS.Accepted,
    })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResourceProjectionAvailability, args),
    ).resolves.toBe(true)
  })

  it('lets only a DM request the exact readonly projection of an accepted player', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const sharedId = await createResource(campaign, campaignUuid, 'note', null, 'Shared')
    const privateId = await createResource(campaign, campaignUuid, 'note', null, 'Private')
    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [sharedId],
      memberId: campaign.player.memberDomainId,
      permission: 'view',
    })

    const shared = await asDm(campaign).query(api.resources.queries.loadResource, {
      campaignId: campaignUuid,
      viewAsParticipantId: campaign.player.memberDomainId,
      resourceId: sharedId,
    })
    const hidden = await asDm(campaign).query(api.resources.queries.loadResource, {
      campaignId: campaignUuid,
      viewAsParticipantId: campaign.player.memberDomainId,
      resourceId: privateId,
    })

    expect(shared.scope).toEqual({
      campaignId: campaignUuid,
      actorId: campaign.player.memberDomainId,
      projection: 'view_as_player',
      schema: RESOURCE_INDEX_SCHEMA,
    })
    expect(shared.resources).toEqual([
      expect.objectContaining({ id: sharedId, permission: 'view' }),
    ])
    expect(hidden).toMatchObject({ resources: [], missingResourceIds: [privateId] })
    await expectPermissionDenied(
      asPlayer(campaign).query(api.resources.queries.loadResource, {
        campaignId: campaignUuid,
        viewAsParticipantId: campaign.player.memberDomainId,
        resourceId: sharedId,
      }),
    )
  })

  it('preserves reference precedence and folder inheritance stops in player projections', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const rootId = await createResource(campaign, campaignUuid, 'folder', null, 'Root')
    const folderId = await createResource(campaign, campaignUuid, 'folder', rootId, 'Folder')
    const noteId = await createResource(campaign, campaignUuid, 'note', folderId, 'Note')
    await executeAccess(campaign, campaignUuid, {
      type: 'setAudienceAccess',
      resourceIds: [rootId],
      permission: 'edit',
    })
    await executeAccess(campaign, campaignUuid, {
      type: 'setFolderAccessInheritance',
      folderId: rootId,
      inheritance: 'enabled',
    })
    await executeAccess(campaign, campaignUuid, {
      type: 'setAudienceAccess',
      resourceIds: [folderId],
      permission: 'view',
    })
    await executeAccess(campaign, campaignUuid, {
      type: 'setFolderAccessInheritance',
      folderId,
      inheritance: 'enabled',
    })

    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResource, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toMatchObject({
      resources: expect.arrayContaining([
        expect.objectContaining({ id: rootId, permission: 'edit' }),
        expect.objectContaining({ id: folderId, permission: 'view' }),
        expect.objectContaining({ id: noteId, permission: 'view' }),
      ]),
      missingResourceIds: [],
    })

    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [noteId],
      memberId: campaign.player.memberDomainId,
      permission: 'edit',
    })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResource, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toMatchObject({
      resources: expect.arrayContaining([
        expect.objectContaining({ id: noteId, permission: 'edit' }),
      ]),
    })

    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [noteId],
      memberId: campaign.player.memberDomainId,
      permission: 'none',
    })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResource, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toMatchObject({ resources: [], missingResourceIds: [noteId] })

    await executeAccess(campaign, campaignUuid, {
      type: 'clearMemberAccess',
      resourceIds: [noteId],
      memberId: campaign.player.memberDomainId,
    })
    await executeAccess(campaign, campaignUuid, {
      type: 'setAudienceAccess',
      resourceIds: [noteId],
      permission: 'none',
    })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResource, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toMatchObject({ resources: [], missingResourceIds: [noteId] })

    await executeAccess(campaign, campaignUuid, {
      type: 'clearAudienceAccess',
      resourceIds: [noteId],
    })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResource, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toMatchObject({
      resources: expect.arrayContaining([
        expect.objectContaining({ id: noteId, permission: 'view' }),
      ]),
      missingResourceIds: [],
    })

    await executeAccess(campaign, campaignUuid, {
      type: 'setFolderAccessInheritance',
      folderId,
      inheritance: 'disabled',
    })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResource, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toMatchObject({ resources: [], missingResourceIds: [noteId] })
  })

  it('does not project a directly shared resource through an unauthorized parent', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const folderId = await createResource(campaign, campaignUuid, 'folder', null, 'Hidden')
    const noteId = await createResource(campaign, campaignUuid, 'note', folderId, 'Direct share')
    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [noteId],
      memberId: campaign.player.memberDomainId,
      permission: 'view',
    })

    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResource, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toMatchObject({ resources: [], missingResourceIds: [noteId] })
  })

  it('projects sharing presentation from the same policy resolver used for authorization', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const folderId = await createResource(campaign, campaignUuid, 'folder', null, 'Shared folder')
    const noteId = await createResource(campaign, campaignUuid, 'note', folderId, 'Shared note')
    await executeAccess(campaign, campaignUuid, {
      type: 'setAudienceAccess',
      resourceIds: [folderId],
      permission: 'view',
    })
    await executeAccess(campaign, campaignUuid, {
      type: 'setFolderAccessInheritance',
      folderId,
      inheritance: 'enabled',
    })

    await expect(
      asDm(campaign).query(api.resources.queries.loadResourceAccess, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toMatchObject({
      policy: {
        resourceId: noteId,
        subject: 'resource',
        audienceAccess: { state: 'default' },
      },
      defaultAccess: {
        permission: 'view',
        source: { type: 'audience', resourceId: folderId },
      },
      participants: [
        {
          id: campaign.player.memberDomainId,
          access: { state: 'default' },
          effectiveAccess: {
            permission: 'view',
            source: { type: 'audience', resourceId: folderId },
          },
        },
      ],
    })

    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [noteId],
      memberId: campaign.player.memberDomainId,
      permission: 'none',
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadResourceAccess, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toMatchObject({
      participants: [
        {
          id: campaign.player.memberDomainId,
          access: { state: 'explicit', permission: 'none' },
          effectiveAccess: {
            permission: 'none',
            source: { type: 'member', resourceId: noteId },
          },
        },
      ],
    })
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
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const update = makeYjsUpdateWithBlocks([
      {
        id: blockId,
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
        campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, campaignUuid),
        resourceId,
      }),
    ).resolves.toEqual({ status: 'ready', update, version: expect.any(Object) })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'unauthorized' })
    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [resourceId],
      memberId: campaign.player.memberDomainId,
      permission: 'view',
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        viewAsParticipantId: campaign.player.memberDomainId,
        resourceId,
      }),
    ).resolves.toEqual({ status: 'empty', reason: 'no_visible_blocks' })
    await executeBlockAccess(campaign, campaignUuid, {
      type: 'setNoteBlockAudienceAccess',
      noteId: resourceId,
      blockIds: [blockId],
      shared: true,
    })
    await expect(
      asDm(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        viewAsParticipantId: campaign.player.memberDomainId,
        resourceId,
      }),
    ).resolves.toMatchObject({ status: 'ready', version: expect.any(Object) })

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

  it('projects canonical block visibility with note access as the outer gate', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const noteId = generateDomainId(DOMAIN_ID_KIND.resource)
    const parentId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const childId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const siblingId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId: noteId,
        kind: 'note',
        parentId: null,
        title: 'Projected note',
        icon: null,
        color: null,
      },
      update: makeYjsUpdateWithBlocks([
        {
          id: parentId,
          type: 'paragraph',
          content: [{ type: 'text', text: 'Parent' }],
          children: [
            {
              id: childId,
              type: 'paragraph',
              content: [{ type: 'text', text: 'Child' }],
            },
          ],
        },
        {
          id: siblingId,
          type: 'paragraph',
          content: [{ type: 'text', text: 'Sibling' }],
        },
      ]),
    })
    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [noteId],
      memberId: campaign.player.memberDomainId,
      permission: 'view',
    })
    await executeBlockAccess(campaign, campaignUuid, {
      type: 'setNoteBlockAudienceAccess',
      noteId,
      blockIds: [childId],
      shared: true,
    })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadNoteContent, {
        campaignId: campaignUuid,
        resourceId: noteId,
      }),
    ).resolves.toEqual({ status: 'empty', reason: 'no_visible_blocks' })

    await executeBlockAccess(campaign, campaignUuid, {
      type: 'setNoteBlockMemberAccess',
      noteId,
      blockIds: [parentId],
      memberId: campaign.player.memberDomainId,
      permission: 'view',
    })
    const filtered = await asPlayer(campaign).query(api.resources.queries.loadNoteContent, {
      campaignId: campaignUuid,
      resourceId: noteId,
    })
    expect(filtered.status).toBe('ready')
    if (filtered.status !== 'ready') throw new TypeError('Expected filtered note content')
    const blocks = decodeNoteYjsUpdatesToBlocks([{ update: filtered.update }], NOTE_YJS_FRAGMENT)
    expect(blocks.map((block) => block.id)).toEqual([parentId])
    expect((blocks[0]?.children ?? []).map((block) => block.id)).toEqual([childId])

    await expect(
      asDm(campaign).query(api.resources.queries.loadNoteBlockAccess, {
        campaignId: campaignUuid,
        noteId,
      }),
    ).resolves.toMatchObject({
      noteId,
      blocks: [
        {
          blockId: parentId,
          audienceVisibility: 'hidden',
          memberAccess: [{ memberId: campaign.player.memberDomainId, visibility: 'visible' }],
        },
        { blockId: childId, audienceVisibility: 'visible' },
        { blockId: siblingId, audienceVisibility: 'hidden' },
      ],
      participants: [{ id: campaign.player.memberDomainId, notePermission: 'view' }],
    })

    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [noteId],
      memberId: campaign.player.memberDomainId,
      permission: 'edit',
    })
    const editable = await asPlayer(campaign).query(api.resources.queries.loadNoteContent, {
      campaignId: campaignUuid,
      resourceId: noteId,
    })
    expect(editable.status).toBe('ready')
    if (editable.status !== 'ready') throw new TypeError('Expected editable note content')
    expect(
      decodeNoteYjsUpdatesToBlocks([{ update: editable.update }], NOTE_YJS_FRAGMENT).map(
        (block) => block.id,
      ),
    ).toEqual([parentId, siblingId])
  })

  it('loads file, map, and canvas content through their owning queries', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const fileId = await createResource(campaign, campaignUuid, 'file', null, 'File')
    const mapId = await createResource(campaign, campaignUuid, 'map', null, 'Map')
    const canvasId = await createResource(campaign, campaignUuid, 'canvas', null, 'Canvas')

    await expect(
      asDm(campaign).query(api.resources.queries.loadFileContent, {
        campaignId: campaignUuid,
        resourceId: fileId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        content: {
          attachment: 'attached',
          classification: 'inert_file',
          byteSize: 1,
          detectedFormat: null,
          extension: 'txt',
          mediaType: 'application/octet-stream',
          viewerUnavailableReason: 'unsupported_format',
        },
      }),
    )
    await expect(
      asDm(campaign).query(api.resources.queries.loadMapContent, {
        campaignId: campaignUuid,
        resourceId: mapId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        content: { image: { status: 'unattached' }, layers: [], pins: [] },
      }),
    )
    await expect(
      asDm(campaign).query(api.resources.queries.loadCanvasContent, {
        campaignId: campaignUuid,
        resourceId: canvasId,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 'ready' }))

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
      asDm(campaign).query(api.resources.queries.loadFileContent, {
        campaignId: campaignUuid,
        resourceId: fileId,
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
      asDm(campaign).query(api.resources.queries.loadFileContent, {
        campaignId: campaignUuid,
        resourceId: fileId,
      }),
    ).resolves.toEqual({ status: 'integrity_error', issue: 'content_missing' })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadMapContent, {
        campaignId: campaignUuid,
        resourceId: mapId,
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'unauthorized' })
    await expect(
      asDm(campaign).query(api.resources.queries.loadFileContent, {
        campaignId: campaignUuid,
        resourceId: mapId,
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'capability_not_supported' })
    await expect(
      asDm(campaign).query(api.resources.queries.loadMapContent, {
        campaignId: campaignUuid,
        resourceId: canvasId,
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'capability_not_supported' })
    await expect(
      asDm(campaign).query(api.resources.queries.loadCanvasContent, {
        campaignId: campaignUuid,
        resourceId: fileId,
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
    ).resolves.toEqual({
      status: 'ready',
      url: expect.any(String),
      version: expect.objectContaining({ revision: 1 }),
    })
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

  it('globally ranks bounded tiers and reports broad lower-tier queries as incomplete', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const memberUuid = await getMemberUuid(campaign.dm.memberId)
    const resourceIds = Array.from({ length: 302 }, () => generateDomainId(DOMAIN_ID_KIND.resource))
    const sortedResourceIds = [...resourceIds].sort()
    const exactId = sortedResourceIds[sortedResourceIds.length - 1]!
    const unicodeId = sortedResourceIds[sortedResourceIds.length - 2]!
    const documents = resourceIds.map((resourceId, index) =>
      createResourceSearchDocument(
        resourceId,
        resourceId === exactId
          ? 'Needle'
          : resourceId === unicodeId
            ? 'Ärcane entry'
            : index < 60
              ? 'Journal entry shared'
              : `Journal entry ${index.toString().padStart(3, '0')}`,
        resourceId === unicodeId ? 'Shared archive citadèle' : 'Shared archive',
      ),
    )
    await t.run(async (ctx) => {
      for (const [index, document] of documents.entries()) {
        await ctx.db.insert('resources', {
          resourceUuid: document.resourceId,
          campaignUuid,
          parentResourceUuid: null,
          kind: 'note',
          title: document.title,
          icon: null,
          color: null,
          lifecycle: 'active',
          trashedAt: null,
          trashedByMemberUuid: null,
          metadataVersion: {
            scheme: VERSION_SCHEME,
            revision: 1,
            digest: index.toString(16).padStart(64, '0'),
          },
          createdAt: index,
          createdByMemberUuid: memberUuid,
          updatedAt: index,
          updatedByMemberUuid: memberUuid,
        })
        await ctx.db.insert('resourceSearchDocuments', {
          campaignUuid,
          resourceUuid: document.resourceId,
          title: document.title,
          normalizedTitle: normalizeResourceSearchText(document.title),
          body: document.body,
        })
      }
    })
    const first = await asDm(campaign).query(api.resources.queries.searchResources, {
      campaignId: campaignUuid,
      query: 'NEEDLE',
    })
    const second = await asDm(campaign).query(api.resources.queries.searchResources, {
      campaignId: campaignUuid,
      query: 'NEEDLE',
    })

    expect(first.results).toEqual(searchResourceDocuments(documents, 'NEEDLE'))
    expect(first.status).toBe('complete')
    expect(second.results).toEqual(first.results)
    expect(first.snapshot.resources).toHaveLength(first.results.length)
    expect(first.snapshot.missingResourceIds).toEqual([])

    for (const query of ['journal', 'ärcane', 'citadèle']) {
      const result = await asDm(campaign).query(api.resources.queries.searchResources, {
        campaignId: campaignUuid,
        query,
      })
      expect(result.results).toEqual(searchResourceDocuments(documents, query))
      expect(result.status).toBe('complete')
    }
    for (const query of ['entry', 'archive']) {
      const result = await asDm(campaign).query(api.resources.queries.searchResources, {
        campaignId: campaignUuid,
        query,
      })
      expect(result).toMatchObject({ status: 'incomplete', results: [] })
    }
  })

  it('returns rank-safe prefix results when more than 1,024 body matches exceed the budget', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const memberUuid = await getMemberUuid(campaign.dm.memberId)
    const exactId = generateDomainId(DOMAIN_ID_KIND.resource)
    await t.run(async (ctx) => {
      await ctx.db.insert('resources', {
        resourceUuid: exactId,
        campaignUuid,
        parentResourceUuid: null,
        kind: 'note',
        title: 'Common',
        icon: null,
        color: null,
        lifecycle: 'active',
        trashedAt: null,
        trashedByMemberUuid: null,
        metadataVersion: {
          scheme: VERSION_SCHEME,
          revision: 1,
          digest: 'f'.repeat(64),
        },
        createdAt: 0,
        createdByMemberUuid: memberUuid,
        updatedAt: 0,
        updatedByMemberUuid: memberUuid,
      })
      await ctx.db.insert('resourceSearchDocuments', {
        campaignUuid,
        resourceUuid: exactId,
        title: 'Common',
        normalizedTitle: 'common',
        body: '',
      })
      for (let index = 0; index < 1_025; index += 1) {
        const title = `Overflow ${index.toString().padStart(4, '0')}`
        await ctx.db.insert('resourceSearchDocuments', {
          campaignUuid,
          resourceUuid: generateDomainId(DOMAIN_ID_KIND.resource),
          title,
          normalizedTitle: normalizeResourceSearchText(title),
          body: 'Common overflow body',
        })
      }
    })

    await expect(
      asDm(campaign).query(api.resources.queries.searchResources, {
        campaignId: campaignUuid,
        query: 'common',
      }),
    ).resolves.toMatchObject({
      status: 'incomplete',
      results: [{ resourceId: exactId, match: { type: 'title' } }],
    })
    expect(MAX_WORKSPACE_SEARCH_DOCUMENT_READS).toBe(64)
    expect(MAX_WORKSPACE_SEARCH_PROVIDER_READ_BYTES).toBeLessThan(8 * 1024 * 1024)
  })

  it(
    'loads the maximum bookmark set through the maximum hierarchy depth',
    { timeout: 30_000 },
    async () => {
      const campaign = await setupCampaignContext(t)
      const campaignUuid = await getCampaignUuid(campaign.campaignId)
      const memberUuid = await getMemberUuid(campaign.dm.memberId)
      const folderIds = Array.from({ length: MAX_SYNCHRONOUS_RESOURCE_CLOSURE - 1 }, () =>
        generateDomainId(DOMAIN_ID_KIND.resource),
      )
      const bookmarkedIds = Array.from({ length: MAX_RESOURCE_BOOKMARKS_PER_ACTOR }, () =>
        generateDomainId(DOMAIN_ID_KIND.resource),
      )
      const metadataVersion = {
        scheme: VERSION_SCHEME,
        revision: 1,
        digest: '0'.repeat(64),
      }

      await t.run(async (ctx) => {
        for (const [index, resourceUuid] of folderIds.entries()) {
          await ctx.db.insert('resources', {
            resourceUuid,
            campaignUuid,
            parentResourceUuid: folderIds[index - 1] ?? null,
            kind: 'folder',
            title: `Folder ${index}`,
            icon: null,
            color: null,
            lifecycle: 'active',
            trashedAt: null,
            trashedByMemberUuid: null,
            metadataVersion,
            createdAt: index,
            createdByMemberUuid: memberUuid,
            updatedAt: index,
            updatedByMemberUuid: memberUuid,
          })
        }
        for (const [index, resourceUuid] of bookmarkedIds.entries()) {
          await ctx.db.insert('resources', {
            resourceUuid,
            campaignUuid,
            parentResourceUuid: folderIds[folderIds.length - 1]!,
            kind: 'note',
            title: `Bookmark ${index}`,
            icon: null,
            color: null,
            lifecycle: 'active',
            trashedAt: null,
            trashedByMemberUuid: null,
            metadataVersion,
            createdAt: folderIds.length + index,
            createdByMemberUuid: memberUuid,
            updatedAt: folderIds.length + index,
            updatedByMemberUuid: memberUuid,
          })
          await ctx.db.insert('resourceBookmarks', {
            campaignUuid,
            memberUuid,
            resourceUuid,
            bookmarkedAt: index,
          })
        }
      })

      const projection = await asDm(campaign).query(api.resources.queries.loadBookmarks, {
        campaignId: campaignUuid,
      })

      expect(projection.resourceIds).toHaveLength(MAX_RESOURCE_BOOKMARKS_PER_ACTOR)
      expect(projection.snapshot.resources).toHaveLength(
        MAX_RESOURCE_BOOKMARKS_PER_ACTOR + folderIds.length,
      )
      expect(projection.snapshot.missingResourceIds).toEqual([])
    },
  )

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
              update: makeYjsUpdateWithBlocks([{ type: 'paragraph' }]),
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

  async function executeBlockAccess(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    campaignUuid: string,
    command: StoredNoteBlockAccessCommand,
  ) {
    const result = await asDm(campaign).mutation(
      api.resources.mutations.executeNoteBlockAccessCommand,
      {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command,
      },
    )
    expect(result.status).toBe('completed')
    return result
  }

  async function createEmptyFile(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    campaignUuid: string,
    operationId: string,
    command: Extract<StoredResourceStructureCommand, { type: 'create' }>,
  ) {
    const bytes = new TextEncoder().encode('x')
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([bytes]),
      'empty.txt',
    )
    return await asDm(campaign).action(api.resources.actions.createFileResource, {
      campaignId: campaignUuid,
      operationId,
      alias: {
        campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, campaignUuid),
        resourceId: command.resourceId,
        importJobId: '01890f47-65f2-7cc0-8a3b-000000000001',
        sourceRootId: 'test-upload',
        rawPath: `${command.resourceId}.bin`,
        normalizedPath: `${command.resourceId}.bin`,
      },
      command,
      metadataVersion: await initialResourceMetadataVersion({
        parentId:
          command.parentId === null
            ? null
            : assertDomainId(DOMAIN_ID_KIND.resource, command.parentId),
        kind: command.kind,
        title: canonicalizeResourceTitle(command.title),
        icon: command.icon,
        color: command.color,
        lifecycle: 'active',
      }),
      uploadSessionId: upload.sessionId,
    })
  }
})
