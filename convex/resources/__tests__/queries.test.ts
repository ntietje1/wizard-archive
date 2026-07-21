import { describe, expect, it } from 'vite-plus/test'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type { NoteBlockId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-record'
import { MAX_SYNCHRONOUS_RESOURCE_CLOSURE } from '@wizard-archive/editor/resources/resource-record'
import { MAX_RESOURCE_BOOKMARKS_PER_ACTOR } from '@wizard-archive/editor/resources/bookmarks'
import { VERSION_SCHEME } from '@wizard-archive/editor/resources/component-version'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import type { FunctionArgs } from 'convex/server'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import {
  asDm,
  asPlayer,
  setupCampaignContext,
  setupMultiPlayerContext,
} from '../../_test/identities.helper'
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
import {
  MAX_RESOURCE_REFERENCE_OCCURRENCES,
  serializeAuthoredDestination,
} from '@wizard-archive/editor/resources/authored-destination'
import {
  createResourcePreview,
  RESOURCE_PREVIEW_EXCERPT_CODE_POINT_LIMIT,
  RESOURCE_PREVIEW_OUTLINE_LIMIT,
  RESOURCE_PREVIEW_OUTLINE_TEXT_CODE_POINT_LIMIT,
} from '@wizard-archive/editor/resources/preview'

type StoredResourceStructureCommand = FunctionArgs<
  typeof api.resources.mutations.executeStructureCommand
>['command']
type StoredResourceAccessCommand = FunctionArgs<
  typeof api.resources.mutations.executeResourceAccessCommand
>['command']
type StoredNoteBlockAccessCommand = FunctionArgs<
  typeof api.resources.mutations.executeNoteBlockAccessCommand
>['command']
type DmCampaignContext =
  | Awaited<ReturnType<typeof setupCampaignContext>>
  | Awaited<ReturnType<typeof setupMultiPlayerContext>>

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
        cursor: null,
      }),
    ).resolves.toMatchObject({
      cursor: null,
      presentation: {
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
      },
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
        cursor: null,
      }),
    ).resolves.toMatchObject({
      presentation: {
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
      },
    })
  })

  it('pages sharing participants without gaps or duplicates', async () => {
    const campaign = await setupMultiPlayerContext(t, 17)
    const resourceId = await createResource(
      campaign,
      campaign.campaignDomainId,
      'note',
      null,
      'Paged sharing',
    )
    const first = await asDm(campaign).query(api.resources.queries.loadResourceAccess, {
      campaignId: campaign.campaignDomainId,
      resourceId,
      cursor: null,
    })
    expect(first.presentation?.participants).toHaveLength(16)
    expect(first.cursor).not.toBeNull()
    const second = await asDm(campaign).query(api.resources.queries.loadResourceAccess, {
      campaignId: campaign.campaignDomainId,
      resourceId,
      cursor: first.cursor,
    })
    expect(second.presentation?.participants).toHaveLength(1)
    expect(second.cursor).toBeNull()
    const ids = [
      ...(first.presentation?.participants ?? []),
      ...(second.presentation?.participants ?? []),
    ].map((participant) => participant.id)
    expect(new Set(ids).size).toBe(17)
  }, 20_000)

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
    ).resolves.toEqual({
      status: 'ready',
      generation: 1,
      update,
      version: expect.any(Object),
    })
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

  it('projects bounded authorized note previews without opening content sessions', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const longText = '🧭'.repeat(RESOURCE_PREVIEW_EXCERPT_CODE_POINT_LIMIT + 50)
    const update = makeYjsUpdateWithBlocks([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: longText }],
      },
      ...Array.from({ length: RESOURCE_PREVIEW_OUTLINE_LIMIT + 6 }, (_, index) => ({
        type: 'heading' as const,
        props: { level: 2 as const },
        content: [
          {
            type: 'text' as const,
            text: `${index}:${'H'.repeat(RESOURCE_PREVIEW_OUTLINE_TEXT_CODE_POINT_LIMIT + 20)}`,
          },
        ],
      })),
    ])
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId,
        kind: 'note',
        parentId: null,
        title: 'Preview note',
        icon: null,
        color: null,
      },
      update,
    })

    const preview = await asDm(campaign).query(api.resources.queries.loadResourcePreview, {
      campaignId: campaignUuid,
      resourceId,
    })
    expect(preview.status).toBe('ready')
    if (preview.status !== 'ready') throw new TypeError('Expected a ready preview')
    expect(Array.from(preview.preview.excerpt)).toHaveLength(
      RESOURCE_PREVIEW_EXCERPT_CODE_POINT_LIMIT,
    )
    expect(preview.preview.outline).toHaveLength(RESOURCE_PREVIEW_OUTLINE_LIMIT)
    expect(Array.from(preview.preview.outline[0]!.text)).toHaveLength(
      RESOURCE_PREVIEW_OUTLINE_TEXT_CODE_POINT_LIMIT,
    )
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResourcePreview, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'unauthorized' })
  })

  it('projects note previews from actor-visible text without generated images', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const visibleBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const hiddenBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId,
        kind: 'note',
        parentId: null,
        title: 'Shared preview',
        icon: null,
        color: null,
      },
      update: makeYjsUpdateWithBlocks([
        {
          id: visibleBlockId,
          type: 'heading',
          props: { level: 1 },
          content: [{ type: 'text', text: 'Visible heading' }],
        },
        {
          id: hiddenBlockId,
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: 'Hidden heading' }],
        },
      ]),
    })
    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [resourceId],
      memberId: campaign.player.memberDomainId,
      permission: 'view',
    })
    await executeBlockAccess(campaign, campaignUuid, {
      type: 'setNoteBlockAudienceAccess',
      noteId: resourceId,
      blockIds: [visibleBlockId, hiddenBlockId],
      shared: true,
    })

    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResourcePreview, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      preview: {
        excerpt: expect.stringContaining('Hidden heading'),
        outline: [{ blockId: visibleBlockId }, { blockId: hiddenBlockId }],
      },
    })

    await executeBlockAccess(campaign, campaignUuid, {
      type: 'setNoteBlockAudienceAccess',
      noteId: resourceId,
      blockIds: [hiddenBlockId],
      shared: false,
    })
    const playerPreview = await asPlayer(campaign).query(
      api.resources.queries.loadResourcePreview,
      { campaignId: campaignUuid, resourceId },
    )
    expect(playerPreview).toMatchObject({
      status: 'ready',
      preview: {
        excerpt: expect.stringContaining('Visible heading'),
        outline: [{ blockId: visibleBlockId }],
      },
    })
    if (playerPreview.status !== 'ready') throw new TypeError('Expected player preview')
    expect(playerPreview.preview.excerpt).not.toContain('Hidden heading')
    await expect(
      asDm(campaign).query(api.resources.queries.loadResourcePreview, {
        campaignId: campaignUuid,
        viewAsParticipantId: campaign.player.memberDomainId,
        resourceId,
      }),
    ).resolves.toEqual(playerPreview)
    await expect(
      asDm(campaign).query(api.resources.queries.loadResourcePreview, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      preview: {
        excerpt: expect.stringContaining('Hidden heading'),
        outline: [{ blockId: visibleBlockId }, { blockId: hiddenBlockId }],
      },
    })

    await executeAccess(campaign, campaignUuid, {
      type: 'setMemberAccess',
      resourceIds: [resourceId],
      memberId: campaign.player.memberDomainId,
      permission: 'none',
    })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResourcePreview, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'unauthorized' })
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
    const canonical = await asDm(campaign).query(api.resources.queries.loadNoteContent, {
      campaignId: campaignUuid,
      resourceId: noteId,
    })
    if (canonical.status !== 'ready') throw new TypeError('Expected canonical note content')
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
    expect(filtered.version.revision).toBe(canonical.version.revision)
    expect(filtered.version.digest).not.toBe(canonical.version.digest)
    const blocks = decodeNoteYjsUpdatesToBlocks([{ update: filtered.update }], NOTE_YJS_FRAGMENT)
    expect(blocks.map((block) => block.id)).toEqual([parentId])
    expect((blocks[0]?.children ?? []).map((block) => block.id)).toEqual([childId])

    const blockAccess = await asDm(campaign).query(api.resources.queries.loadNoteBlockAccess, {
      campaignId: campaignUuid,
      noteId,
      blockIds: [parentId, childId, siblingId],
      cursor: null,
    })
    expect(blockAccess.cursor).toBeNull()
    expect(blockAccess.presentation).toMatchObject({
      noteId,
      participants: [{ id: campaign.player.memberDomainId, notePermission: 'view' }],
    })
    const policies = new Map(
      blockAccess.presentation?.blocks.map((policy) => [policy.blockId, policy]),
    )
    expect(policies.get(parentId)).toEqual({
      blockId: parentId,
      audienceVisibility: 'hidden',
      memberAccess: [{ memberId: campaign.player.memberDomainId, visibility: 'visible' }],
    })
    expect(policies.get(childId)).toEqual({
      blockId: childId,
      audienceVisibility: 'visible',
      memberAccess: [],
    })
    expect(policies.get(siblingId)).toEqual({
      blockId: siblingId,
      audienceVisibility: 'hidden',
      memberAccess: [],
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
    expect(editable.version).toEqual(canonical.version)
    expect(
      decodeNoteYjsUpdatesToBlocks([{ update: editable.update }], NOTE_YJS_FRAGMENT).map(
        (block) => block.id,
      ),
    ).toEqual([parentId, siblingId])
  })

  it('projects references only from actor-visible occurrences before deduplication', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const targetId = generateDomainId(DOMAIN_ID_KIND.resource)
    const targetBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const inaccessibleTargetId = await createResource(
      campaign,
      campaignUuid,
      'note',
      null,
      'DM vault',
    )
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId: targetId,
        kind: 'note',
        parentId: null,
        title: 'Shared target',
        icon: null,
        color: null,
      },
      update: makeYjsUpdateWithBlocks([
        {
          id: targetBlockId,
          type: 'heading',
          props: { level: 1 },
          content: [{ type: 'text', text: 'Initially hidden section' }],
        },
      ]),
    })
    const sourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const visibleBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const hiddenBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const nestedParentId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const nestedChildId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const targetSectionLinkId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const inaccessibleLinkId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const resourceLink = serializeAuthoredDestination({
      kind: 'internal',
      target: { kind: 'resource', resourceId: targetId },
    })
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId: sourceId,
        kind: 'note',
        parentId: null,
        title: 'Reference source',
        icon: null,
        color: null,
      },
      update: makeYjsUpdateWithBlocks([
        referenceBlock(visibleBlockId, resourceLink, 'Visible occurrence'),
        referenceBlock(hiddenBlockId, resourceLink, 'Hidden duplicate'),
        {
          id: nestedParentId,
          type: 'paragraph',
          children: [referenceBlock(nestedChildId, resourceLink, 'Hidden by parent')],
        },
        referenceBlock(
          targetSectionLinkId,
          serializeAuthoredDestination({
            kind: 'internal',
            target: {
              kind: 'noteBlock',
              resourceId: targetId,
              blockId: targetBlockId,
              presentation: 'heading',
            },
          }),
          'Hidden target section',
        ),
        referenceBlock(
          inaccessibleLinkId,
          serializeAuthoredDestination({
            kind: 'internal',
            target: { kind: 'resource', resourceId: inaccessibleTargetId },
          }),
          'Inaccessible target',
        ),
      ]),
    })
    for (const resourceId of [sourceId, targetId]) {
      await executeAccess(campaign, campaignUuid, {
        type: 'setMemberAccess',
        resourceIds: [resourceId],
        memberId: campaign.player.memberDomainId,
        permission: 'view',
      })
    }
    await executeBlockAccess(campaign, campaignUuid, {
      type: 'setNoteBlockAudienceAccess',
      noteId: sourceId,
      blockIds: [visibleBlockId, nestedChildId, targetSectionLinkId, inaccessibleLinkId],
      shared: true,
    })

    const projected = await asPlayer(campaign).query(api.resources.queries.loadResourceReferences, {
      campaignId: campaignUuid,
      resourceId: sourceId,
    })
    expect(projected).toMatchObject({
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
    if (projected.status !== 'ready') throw new TypeError('Expected projected references')
    expect(projected.snapshot.missingResourceIds).toEqual([])
    expect(
      projected.snapshot.resources.some((resource) => resource.id === inaccessibleTargetId),
    ).toBe(false)
    const viewAs = await asDm(campaign).query(api.resources.queries.loadResourceReferences, {
      campaignId: campaignUuid,
      viewAsParticipantId: campaign.player.memberDomainId,
      resourceId: sourceId,
    })
    expect(viewAs.status === 'ready' ? viewAs.outgoing : viewAs).toEqual(projected.outgoing)
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResourceReferences, {
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

    await executeBlockAccess(campaign, campaignUuid, {
      type: 'setNoteBlockAudienceAccess',
      noteId: sourceId,
      blockIds: [nestedParentId],
      shared: true,
    })
    await executeBlockAccess(campaign, campaignUuid, {
      type: 'setNoteBlockAudienceAccess',
      noteId: targetId,
      blockIds: [targetBlockId],
      shared: true,
    })
    await expect(
      asPlayer(campaign).query(api.resources.queries.loadResourceReferences, {
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
            target: {
              kind: 'noteBlock',
              resourceId: targetId,
              blockId: targetBlockId,
              presentation: 'heading',
            },
          },
          {
            sourceResourceId: sourceId,
            target: { kind: 'resource', resourceId: targetId },
          },
        ],
      },
    })
  })

  it('reports explicit capacity in both reference directions without truncation', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = await createResource(campaign, campaignUuid, 'note', null, 'Capacity')
    const sourceVersion = {
      scheme: VERSION_SCHEME,
      revision: 1,
      digest: '0'.repeat(64),
    }
    await t.run(async (ctx) => {
      for (let index = 0; index <= MAX_RESOURCE_REFERENCE_OCCURRENCES; index += 1) {
        const targetResourceUuid = generateDomainId(DOMAIN_ID_KIND.resource)
        await ctx.db.insert('resourceReferenceEdges', {
          campaignUuid,
          sourceResourceUuid: resourceId,
          sourceVersion,
          source: { kind: 'resource' },
          targetResourceUuid,
          target: { kind: 'resource', resourceId: targetResourceUuid },
        })
      }
    })
    await t.run(async (ctx) => {
      for (let index = 0; index <= MAX_RESOURCE_REFERENCE_OCCURRENCES; index += 1) {
        const sourceResourceUuid = generateDomainId(DOMAIN_ID_KIND.resource)
        await ctx.db.insert('resourceReferenceEdges', {
          campaignUuid,
          sourceResourceUuid,
          sourceVersion,
          source: { kind: 'resource' },
          targetResourceUuid: resourceId,
          target: { kind: 'resource', resourceId },
        })
      }
    })

    await expect(
      asDm(campaign).query(api.resources.queries.loadResourceReferences, {
        campaignId: campaignUuid,
        resourceId,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      outgoing: { status: 'capacity_exceeded' },
      backlinks: { status: 'capacity_exceeded' },
    })
  })

  it('pages players for only the requested note block selection without gaps or duplicates', async () => {
    const campaign = await setupMultiPlayerContext(t, 9)
    const noteId = generateDomainId(DOMAIN_ID_KIND.resource)
    const selectedBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const otherBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    await asDm(campaign).mutation(api.resources.mutations.createNoteResource, {
      campaignId: campaign.campaignDomainId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId: noteId,
        kind: 'note',
        parentId: null,
        title: 'Paged block access',
        icon: null,
        color: null,
      },
      update: makeYjsUpdateWithBlocks([
        { id: selectedBlockId, type: 'paragraph' },
        { id: otherBlockId, type: 'paragraph' },
      ]),
    })

    const first = await asDm(campaign).query(api.resources.queries.loadNoteBlockAccess, {
      campaignId: campaign.campaignDomainId,
      noteId,
      blockIds: [selectedBlockId, selectedBlockId],
      cursor: null,
    })
    expect(first.presentation?.blocks.map((block) => block.blockId)).toEqual([selectedBlockId])
    expect(first.presentation?.participants).toHaveLength(8)
    expect(first.cursor).not.toBeNull()
    const second = await asDm(campaign).query(api.resources.queries.loadNoteBlockAccess, {
      campaignId: campaign.campaignDomainId,
      noteId,
      blockIds: [selectedBlockId],
      cursor: first.cursor,
    })
    expect(second.presentation?.participants).toHaveLength(1)
    expect(second.cursor).toBeNull()
    const participantIds = [
      ...(first.presentation?.participants ?? []),
      ...(second.presentation?.participants ?? []),
    ].map((participant) => participant.id)
    expect(new Set(participantIds).size).toBe(9)
  }, 20_000)

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
      command: { type: 'restore', resourceIds: [noteId], destination: 'previousParent' },
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
          preview: { ...createResourcePreview('note', document.body, []), outline: [] },
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
        preview: { ...createResourcePreview('note', '', []), outline: [] },
      })
      for (let index = 0; index < 1_025; index += 1) {
        const title = `Overflow ${index.toString().padStart(4, '0')}`
        await ctx.db.insert('resourceSearchDocuments', {
          campaignUuid,
          resourceUuid: generateDomainId(DOMAIN_ID_KIND.resource),
          title,
          normalizedTitle: normalizeResourceSearchText(title),
          body: 'Common overflow body',
          preview: {
            ...createResourcePreview('note', 'Common overflow body', []),
            outline: [],
          },
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
    campaign: DmCampaignContext,
    campaignUuid: string,
    kind: ResourceKind,
    parentId: ResourceId | null,
    title: string,
  ): Promise<ResourceId> {
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

  function referenceBlock(blockId: NoteBlockId, destination: string, label: string) {
    return {
      id: blockId,
      type: 'paragraph' as const,
      content: [
        {
          type: 'resourceLink' as const,
          props: { destination, label },
        },
      ],
    }
  }

  async function createEmptyFile(
    campaign: DmCampaignContext,
    campaignUuid: string,
    _operationId: string,
    parentId: ResourceId | null,
  ) {
    const bytes = new TextEncoder().encode('x')
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([bytes]),
      'empty.txt',
    )
    const jobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    const reservation = await asDm(campaign).mutation(
      api.resources.mutations.reservePlainTransfer,
      {
        campaignId: campaignUuid,
        jobId,
        destinationParentId: parentId,
        textFileHandling: 'files',
        sources: [{ id: 'selected-file', kind: 'file', name: 'empty.txt' }],
        entries: [
          {
            sourceId: 'selected-file',
            path: 'empty.txt',
            type: 'file',
            byteSize: bytes.byteLength,
          },
        ],
      },
    )
    if (reservation.status !== 'reserved' || !reservation.uploadTargets[0]) {
      throw new TypeError('Expected reserved file transfer')
    }
    await t.run(async (ctx) => {
      const entry = await ctx.db
        .query('resourceTransferEntries')
        .withIndex('by_campaign_and_job', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('importJobUuid', jobId),
        )
        .filter((query) => query.eq(query.field('entryType'), 'file'))
        .unique()
      if (!entry) throw new TypeError('Expected reserved transfer entry')
      await ctx.db.delete('fileStorage', reservation.uploadTargets[0]!.sessionId)
      await ctx.db.patch('resourceTransferEntries', entry._id, {
        uploadSessionUuid: upload.sessionId,
      })
    })
    return await asDm(campaign).action(api.resources.actions.commitPlainTransfer, {
      campaignId: campaignUuid,
      jobId,
    })
  }
})
