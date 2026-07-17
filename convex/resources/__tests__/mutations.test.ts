// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
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
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { collaborationColor } from '../../../shared/resources/collaboration-user'
import presenceTest from '@convex-dev/presence/test'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { advanceMapContentVersion } from '@wizard-archive/editor/resources/map-session-policy'
import { projectMapContent } from '../functions/mapContent'

type StoredResourceStructureCommand = FunctionArgs<
  typeof api.resources.mutations.executeStructureCommand
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

  it('atomically creates a signature-classified file without inspecting its payload', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const metadata = {
      classification: 'viewable_image' as const,
      byteSize: bytes.byteLength,
      detectedFormat: 'png',
      extension: 'png',
      mediaType: 'image/png',
      viewerUnavailableReason: null,
    }
    const upload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([bytes], { type: 'image/png' }),
      'evidence.png',
    )

    const result = await asDm(campaign).action(api.resources.actions.createFileResource, {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'create',
        resourceId,
        kind: 'file',
        parentId: null,
        title: 'evidence.png',
        icon: null,
        color: null,
      },
      uploadSessionId: upload.sessionId,
    })

    expect(result).toMatchObject({
      status: 'completed',
      receipt: { result: { type: 'created', resourceId } },
    })
    await expect(
      asDm(campaign).action(api.resources.actions.createFileResource, {
        campaignId: campaignUuid,
        operationId,
        command: {
          type: 'create',
          resourceId,
          kind: 'file',
          parentId: null,
          title: 'evidence.png',
          icon: null,
          color: null,
        },
        uploadSessionId: upload.sessionId,
      }),
    ).resolves.toMatchObject({ status: 'completed' })
    const conflictingUpload = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob([bytes], { type: 'image/png' }),
      'evidence.png',
    )
    await expect(
      asDm(campaign).action(api.resources.actions.createFileResource, {
        campaignId: campaignUuid,
        operationId,
        command: {
          type: 'create',
          resourceId,
          kind: 'file',
          parentId: null,
          title: 'evidence.png',
          icon: null,
          color: null,
        },
        uploadSessionId: conflictingUpload.sessionId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'operation_id_reused' })
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

  it('replaces file content once, advances its version, and retires the previous asset', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const original = await storeUncommittedTestUploadSession(
      t,
      campaign.dm.profile._id,
      new Blob(['original'], { type: 'text/plain' }),
      'evidence.txt',
    )
    await asDm(campaign).action(api.resources.actions.createFileResource, {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'create',
        resourceId,
        kind: 'file',
        parentId: null,
        title: 'Evidence',
        icon: null,
        color: null,
      },
      uploadSessionId: original.sessionId,
    })
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
    const ownerResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const ownerOperationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const ownerCommand = fileCreateCommand(ownerResourceId, 'Owner')
    const created = await asDm(campaign).action(api.resources.actions.createFileResource, {
      campaignId: campaignUuid,
      operationId: ownerOperationId,
      command: ownerCommand,
      uploadSessionId: upload.sessionId,
    })
    expect(created).toMatchObject({ status: 'completed' })
    await expect(
      asDm(campaign).action(api.resources.actions.createFileResource, {
        campaignId: campaignUuid,
        operationId: ownerOperationId,
        command: ownerCommand,
        uploadSessionId: upload.sessionId,
      }),
    ).resolves.toEqual(created)

    const secondResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    await expect(
      asDm(campaign).action(api.resources.actions.createFileResource, {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: fileCreateCommand(secondResourceId, 'Second'),
        uploadSessionId: upload.sessionId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_command' })

    const crossCampaignResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    await expect(
      campaign.dm.authed.action(api.resources.actions.createFileResource, {
        campaignId: otherCampaign.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: fileCreateCommand(crossCampaignResourceId, 'Cross campaign'),
        uploadSessionId: upload.sessionId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_command' })

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
    const crossCampaignTargetId = generateDomainId(DOMAIN_ID_KIND.resource)
    await campaign.dm.authed.action(api.resources.actions.createFileResource, {
      campaignId: otherCampaign.campaignDomainId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: fileCreateCommand(crossCampaignTargetId, 'Other file'),
      uploadSessionId: crossCampaignUpload.sessionId,
    })
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
      for (const resourceId of [secondResourceId, crossCampaignResourceId]) {
        await expect(
          ctx.db
            .query('resources')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .unique(),
        ).resolves.toBeNull()
      }
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
    const resourceIds = [
      generateDomainId(DOMAIN_ID_KIND.resource),
      generateDomainId(DOMAIN_ID_KIND.resource),
    ] as const
    const results = await Promise.all(
      resourceIds.map((resourceId, index) =>
        asDm(campaign).action(api.resources.actions.createFileResource, {
          campaignId: campaignUuid,
          operationId: generateDomainId(DOMAIN_ID_KIND.operation),
          command: fileCreateCommand(resourceId, `Concurrent ${index}`),
          uploadSessionId: upload.sessionId,
        }),
      ),
    )
    expect(results.map(({ status }) => status).sort()).toEqual(['completed', 'rejected'])
    expect(results).toContainEqual({ status: 'rejected', reason: 'invalid_command' })

    await t.run(async (ctx) => {
      const owners = await ctx.db
        .query('resourceAssetOwners')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', upload.assetId))
        .take(2)
      expect(owners).toHaveLength(1)
      const contents = await Promise.all(
        resourceIds.map((resourceId) =>
          ctx.db
            .query('resourceFileContents')
            .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
            .unique(),
        ),
      )
      expect(contents.filter((content) => content?.assetUuid === upload.assetId)).toHaveLength(1)
      expect(contents.filter(Boolean)).toHaveLength(1)
    })
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
      new Blob([Uint8Array.from(originalBytes).buffer], { type: 'image/png' }),
      'map.png',
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
  })

  it('retains a shared map asset until concurrent replacement removes its final reference', async () => {
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
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeMapContentCommand, createArgs),
    ).resolves.toEqual(created)
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeMapContentCommand, {
        ...createArgs,
        command: { type: 'removePin', pinId },
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'operation_id_reused' })
    if (created.status !== 'completed') throw new TypeError('Expected pin creation')

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
      await expect(
        ctx.db
          .query('resourceMapPins')
          .withIndex('by_mapResourceUuid', (query) => query.eq('mapResourceUuid', mapId))
          .unique(),
      ).resolves.toBeNull()
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
        resourceId,
        update: firstUpdate,
      }),
      asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
        campaignId: campaignUuid,
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
      resourceId,
      update: updateIdentity(0),
    })
    const second = await asDm(campaign).mutation(api.resources.mutations.saveNoteContent, {
      campaignId: campaignUuid,
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
        resourceId: noteId,
        update: noteUpdate,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
    await expect(
      asPlayer(campaign).mutation(api.resources.mutations.saveCanvasContent, {
        campaignId: campaignUuid,
        resourceId: canvasId,
        update: canvasUpdate,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
    await expect(
      asPlayer(campaign).mutation(api.resources.mutations.saveCanvasContent, {
        campaignId: campaignUuid,
        resourceId: guessedId,
        update: canvasUpdate,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
    expect(await storedContentState(noteId, canvasId)).toEqual(before)

    await expect(
      asDm(campaign).mutation(api.resources.mutations.saveCanvasContent, {
        campaignId: campaignUuid,
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
    const firstNodeId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    const secondNodeId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    const firstDocument = createCanvasDocumentDoc({
      nodes: [
        {
          id: firstNodeId,
          type: 'text',
          position: { x: 10, y: 20 },
          data: {},
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
      resourceId,
      update: Uint8Array.from(Y.encodeStateAsUpdate(firstDocument)).buffer,
    })
    const second = await asDm(campaign).mutation(api.resources.mutations.saveCanvasContent, {
      campaignId: campaignUuid,
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
        resourceId,
        update: Uint8Array.from(Y.encodeStateAsUpdate(invalid)).buffer,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'content_corrupt' })
    invalid.destroy()

    await expect(
      asDm(campaign).mutation(api.resources.mutations.saveCanvasContent, {
        campaignId: campaignUuid,
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

  function fileCreateCommand(resourceId: ResourceId, title: string) {
    return {
      type: 'create' as const,
      resourceId,
      kind: 'file' as const,
      parentId: null,
      title,
      icon: null,
      color: null,
    }
  }

  async function createResource(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    campaignUuid: string,
    kind: 'canvas' | 'file' | 'folder' | 'map' | 'note',
    parentId: ResourceId | null,
    title: string,
  ) {
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
      command,
      uploadSessionId: upload.sessionId,
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
