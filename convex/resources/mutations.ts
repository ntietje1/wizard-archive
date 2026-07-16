import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import type {
  ResourceCompensationResult,
  ResourceCommandReceipt,
  ResourceStructureCommand,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import { resourceStructureInputRejection } from '@wizard-archive/editor/resources/command-protocol'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import {
  advanceVersion,
  assertSha256Digest,
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { FileOwnedMetadata } from '@wizard-archive/editor/resources/file-content-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { AssetId, CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { campaignInternalMutation, campaignMutation, dmMutation } from '../functions'
import type { CampaignInternalMutationCtx, CampaignMutationCtx } from '../functions'
import type { Doc, Id } from '../_generated/dataModel'
import {
  executeStructureCommand as executeStructureCommandFn,
  compensateResourceOperation as compensateResourceOperationFn,
} from './functions/executeStructureCommand'
import {
  fileOwnedMetadataValidators,
  fileContentReplaceResultValidator,
  resourceCompensationResultValidator,
  resourceStructureCommandResultValidator,
  resourceStructureCommandValidator,
  resourceBookmarkCommandResultValidator,
  resourceBookmarkCommandValidator,
  contentProviderSaveResultValidator,
  resourceAwarenessLeaseResultValidator,
  resourceAwarenessReleaseResultValidator,
  versionStampValidator,
} from './schema'
import { saveNoteContent as saveNoteContentFn } from './functions/saveNoteContent'
import { saveCanvasContent as saveCanvasContentFn } from './functions/saveCanvasContent'
import {
  publishResourceAwareness as publishResourceAwarenessFn,
  releaseResourceAwareness as releaseResourceAwarenessFn,
} from './functions/resourceAwareness'
import { operationIdValidator, resourceIdValidator } from './validators'
import { executeBookmarkCommand as executeBookmarkCommandFn } from './functions/executeBookmarkCommand'
import { createNoteContent, prepareNoteContentCreation } from './functions/noteContent'
import { createMapContent } from './functions/mapContent'
import { createCanvasContent } from './functions/canvasContent'
import { syncNoteSearchProjection } from './functions/resourceSearchProjection'
import { authorizeResourceContent } from './functions/authorizeResourceContent'
import {
  commitResourceUploadClaim,
  prepareResourceUploadClaim,
  queueAssetRetirements,
} from './functions/assetContent'
import type { ResourceUploadClaim } from './functions/assetContent'

type StoredResourceStructureCommandResult = Infer<typeof resourceStructureCommandResultValidator>
type StoredResourceCompensationResult = Infer<typeof resourceCompensationResultValidator>
type StoredResourceCommandReceipt = Extract<
  StoredResourceStructureCommandResult,
  { status: 'completed' }
>['receipt']
type StoredResourceStructureCommand = Infer<typeof resourceStructureCommandValidator>
type StoredFileContentReplaceResult = Infer<typeof fileContentReplaceResultValidator>
type StoredVersionStamp = Infer<typeof versionStampValidator>

type FileCreationIdentity = Readonly<{
  campaignId: CampaignId
  metadata: FileOwnedMetadata
  upload: Doc<'fileStorage'> | null
  userId: Id<'userProfiles'>
  version: VersionStamp
}>

function existingFileContentMatches(
  content: Doc<'resourceFileContents'>,
  identity: FileCreationIdentity,
): boolean {
  return (
    content.campaignUuid === identity.campaignId &&
    content.assetUuid !== null &&
    identity.upload !== null &&
    identity.upload.userId === identity.userId &&
    identity.upload.assetUuid === content.assetUuid &&
    content.byteSize === identity.metadata.byteSize &&
    content.classification === identity.metadata.classification &&
    content.detectedFormat === identity.metadata.detectedFormat &&
    content.extension === identity.metadata.extension &&
    content.mediaType === identity.metadata.mediaType &&
    content.version.digest === identity.version.digest &&
    content.version.revision === identity.version.revision &&
    content.viewerUnavailableReason === identity.metadata.viewerUnavailableReason
  )
}

function fileMetadataMatches(
  content: Doc<'resourceFileContents'>,
  metadata: FileOwnedMetadata,
): boolean {
  return (
    content.byteSize === metadata.byteSize &&
    content.classification === metadata.classification &&
    content.detectedFormat === metadata.detectedFormat &&
    content.extension === metadata.extension &&
    content.mediaType === metadata.mediaType &&
    content.viewerUnavailableReason === metadata.viewerUnavailableReason
  )
}

function readStructureCommand(
  value: StoredResourceStructureCommand,
): ResourceStructureCommand | StoredResourceStructureCommandResult {
  try {
    return resourceStructureCommand(value)
  } catch (error) {
    return { status: 'rejected', reason: resourceStructureInputRejection(error) }
  }
}

async function createFixedContentResource(
  ctx: CampaignMutationCtx,
  args: Readonly<{ operationId: string; command: StoredResourceStructureCommand }>,
  kind: 'canvas' | 'map',
  createContent: (
    ctx: CampaignMutationCtx,
    campaignId: CampaignMutationCtx['resourceScope']['campaignId'],
    resourceId: Extract<ResourceStructureCommand, { type: 'create' }>['resourceId'],
  ) => Promise<void>,
): Promise<StoredResourceStructureCommandResult> {
  const command = readStructureCommand(args.command)
  if ('status' in command) return command
  if (command.type !== 'create' || command.kind !== kind) {
    return { status: 'rejected', reason: 'invalid_command' }
  }
  const result = await executeStructureCommandFn(ctx, {
    operationId: args.operationId,
    command,
  })
  if (result.status !== 'completed') return storedResult(result)
  await createContent(ctx, ctx.resourceScope.campaignId, command.resourceId)
  return storedResult(result)
}

function storedReceipt(receipt: ResourceCommandReceipt): StoredResourceCommandReceipt {
  return {
    campaignId: receipt.campaignId,
    operationId: receipt.operationId,
    result:
      receipt.result.type === 'created' || receipt.result.type === 'metadataUpdated'
        ? { type: receipt.result.type, resourceId: receipt.result.resourceId }
        : receipt.result.type === 'deepCopied'
          ? { type: 'deepCopied', roots: receipt.result.roots.map((root) => ({ ...root })) }
          : { type: receipt.result.type, resourceIds: [...receipt.result.resourceIds] },
    postconditions: receipt.postconditions.map((condition) =>
      condition.state === 'missing'
        ? { state: 'missing', resourceId: condition.resourceId }
        : {
            state: 'present',
            resourceId: condition.resourceId,
            metadataVersion: { ...condition.metadataVersion },
          },
    ),
  }
}

function storedResult(
  result: ResourceStructureCommandResult,
): StoredResourceStructureCommandResult {
  if (result.status === 'completed') {
    return { status: 'completed', receipt: storedReceipt(result.receipt) }
  }
  if (result.status === 'rejected') return { status: 'rejected', reason: result.reason }
  return { status: 'unavailable', reason: result.reason }
}

function storedCompensationResult(
  result: ResourceCompensationResult,
): StoredResourceCompensationResult {
  if (result.status === 'completed') {
    return { status: 'completed', receipt: storedReceipt(result.receipt) }
  }
  if (result.status === 'rejected') return { status: 'rejected', reason: result.reason }
  return { status: 'unavailable', reason: result.reason }
}

function resourceStructureCommand(
  command: Infer<typeof resourceStructureCommandValidator>,
): ResourceStructureCommand {
  const resourceId = (value: string) => assertDomainId(DOMAIN_ID_KIND.resource, value)
  switch (command.type) {
    case 'create':
      return {
        ...command,
        resourceId: resourceId(command.resourceId),
        parentId: command.parentId === null ? null : resourceId(command.parentId),
        title: canonicalizeResourceTitle(command.title),
      }
    case 'updateMetadata':
      return {
        ...command,
        resourceId: resourceId(command.resourceId),
        changes: {
          ...(command.changes.title === undefined
            ? {}
            : { title: canonicalizeResourceTitle(command.changes.title) }),
          ...(command.changes.icon === undefined ? {} : { icon: command.changes.icon }),
          ...(command.changes.color === undefined ? {} : { color: command.changes.color }),
        },
      }
    case 'move':
      return {
        type: 'move',
        resourceIds: command.resourceIds.map(resourceId),
        destinationParentId:
          command.destinationParentId === null ? null : resourceId(command.destinationParentId),
      }
    case 'trash':
    case 'restore':
    case 'permanentlyDelete':
      return { type: command.type, resourceIds: command.resourceIds.map(resourceId) }
    case 'deepCopy':
      return {
        type: 'deepCopy',
        sourceRootIds: command.sourceRootIds.map(resourceId),
        destinationParentId:
          command.destinationParentId === null ? null : resourceId(command.destinationParentId),
      }
  }
}

export const executeStructureCommand = campaignMutation({
  args: {
    operationId: operationIdValidator,
    command: resourceStructureCommandValidator,
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const command = readStructureCommand(args.command)
    if ('status' in command) return command
    if (command.type === 'create' && command.kind !== 'folder') {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    const result = await executeStructureCommandFn(ctx, {
      operationId: args.operationId,
      command,
    })
    return storedResult(result)
  },
})

export const compensateResourceOperation = campaignMutation({
  args: {
    operationId: operationIdValidator,
    originalOperationId: operationIdValidator,
  },
  returns: resourceCompensationResultValidator,
  handler: async (ctx, args): Promise<StoredResourceCompensationResult> => {
    return storedCompensationResult(await compensateResourceOperationFn(ctx, args))
  },
})

export const executeBookmarkCommand = dmMutation({
  args: {
    operationId: operationIdValidator,
    command: resourceBookmarkCommandValidator,
  },
  returns: resourceBookmarkCommandResultValidator,
  handler: async (ctx, args) => {
    const result = await executeBookmarkCommandFn(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.operation, args.operationId),
      {
        type: args.command.type,
        resourceIds: args.command.resourceIds.map((resourceId) =>
          assertDomainId(DOMAIN_ID_KIND.resource, resourceId),
        ),
        bookmarked: args.command.bookmarked,
      },
    )
    return result.status === 'completed'
      ? {
          status: 'completed' as const,
          receipt: { ...result.receipt, resourceIds: [...result.receipt.resourceIds] },
        }
      : result
  },
})

export const createNoteResource = campaignMutation({
  args: {
    operationId: operationIdValidator,
    command: resourceStructureCommandValidator,
    update: v.bytes(),
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const command = readStructureCommand(args.command)
    if ('status' in command) return command
    if (command.type !== 'create' || command.kind !== 'note') {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    const version = await prepareNoteContentCreation(args.update)
    if (!version) return { status: 'rejected', reason: 'content_integrity_failure' }
    const result = await executeStructureCommandFn(ctx, {
      operationId: args.operationId,
      command,
    })
    if (result.status !== 'completed') return storedResult(result)
    const contentResult = await createNoteContent(
      ctx,
      ctx.resourceScope.campaignId,
      command.resourceId,
      assertDomainId(DOMAIN_ID_KIND.operation, args.operationId),
      args.update,
      version,
    )
    if (contentResult === 'operation_id_reused') {
      return { status: 'rejected', reason: 'operation_id_reused' }
    }
    await syncNoteSearchProjection(ctx, command.resourceId, args.update)
    return storedResult(result)
  },
})

export const createMapResource = campaignMutation({
  args: { operationId: operationIdValidator, command: resourceStructureCommandValidator },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> =>
    await createFixedContentResource(ctx, args, 'map', createMapContent),
})

export const createCanvasResource = campaignMutation({
  args: { operationId: operationIdValidator, command: resourceStructureCommandValidator },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> =>
    await createFixedContentResource(ctx, args, 'canvas', createCanvasContent),
})

export const saveNoteContent = campaignMutation({
  args: {
    resourceId: resourceIdValidator,
    update: v.bytes(),
  },
  returns: contentProviderSaveResultValidator,
  handler: async (ctx, args) =>
    await saveNoteContentFn(ctx, {
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      update: args.update,
    }),
})

export const saveCanvasContent = campaignMutation({
  args: {
    resourceId: resourceIdValidator,
    update: v.bytes(),
  },
  returns: contentProviderSaveResultValidator,
  handler: async (ctx, args) =>
    await saveCanvasContentFn(ctx, {
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      update: args.update,
    }),
})

export const publishResourceAwareness = campaignMutation({
  args: {
    resourceId: resourceIdValidator,
    clientId: v.number(),
    leaseId: v.string(),
    state: v.bytes(),
  },
  returns: resourceAwarenessLeaseResultValidator,
  handler: async (ctx, args) =>
    await publishResourceAwarenessFn(ctx, {
      ...args,
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
    }),
})

export const releaseResourceAwareness = campaignMutation({
  args: {
    resourceId: resourceIdValidator,
    clientId: v.number(),
    leaseId: v.string(),
  },
  returns: resourceAwarenessReleaseResultValidator,
  handler: async (ctx, args) =>
    await releaseResourceAwarenessFn(ctx, {
      ...args,
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
    }),
})

export const commitFileResourceCreation = campaignInternalMutation({
  args: {
    operationId: operationIdValidator,
    command: resourceStructureCommandValidator,
    uploadSessionId: v.id('fileStorage'),
    metadata: v.object(fileOwnedMetadataValidators),
    version: versionStampValidator,
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const command = readStructureCommand(args.command)
    if ('status' in command) return command
    if (command.type !== 'create' || command.kind !== 'file') {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    const claim = await prepareResourceUploadClaim(ctx, {
      campaignId: ctx.resourceScope.campaignId,
      resourceId: command.resourceId,
      sessionId: args.uploadSessionId,
    })
    if (claim.status === 'unavailable') {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    const existingContent = await ctx.db
      .query('resourceFileContents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', command.resourceId))
      .unique()
    if (claim.status === 'claimed' && existingContent === null) {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    const result = await executeStructureCommandFn(ctx, {
      operationId: args.operationId,
      command,
    })
    if (result.status !== 'completed') return storedResult(result)

    const content =
      existingContent ??
      (await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', command.resourceId))
        .unique())
    if (content) {
      const version = assertVersionStamp(args.version)
      if (
        claim.status !== 'claimed' ||
        !existingFileContentMatches(content, {
          campaignId: ctx.resourceScope.campaignId,
          metadata: args.metadata,
          upload: claim.upload,
          userId: ctx.membership.userId,
          version,
        })
      ) {
        return { status: 'rejected', reason: 'operation_id_reused' }
      }
      return storedResult(result)
    }

    if (claim.status !== 'available') {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    const version = assertVersionStamp(args.version)
    if (version.revision !== 1) throw new TypeError('Initial file version must be revision 1')
    const upload = await commitResourceUploadClaim(ctx, claim, {
      campaignId: ctx.resourceScope.campaignId,
      resourceId: command.resourceId,
      expectedByteSize: args.metadata.byteSize,
    })
    await ctx.db.insert('resourceFileContents', {
      campaignUuid: ctx.resourceScope.campaignId,
      resourceUuid: command.resourceId,
      state: 'ready',
      assetUuid: upload.assetId,
      ...args.metadata,
      version,
    })
    return storedResult(result)
  },
})

export const commitFileContentReplacement = campaignInternalMutation({
  args: {
    resourceId: resourceIdValidator,
    expectedVersion: versionStampValidator,
    uploadSessionId: v.id('fileStorage'),
    metadata: v.object(fileOwnedMetadataValidators),
    digest: v.string(),
  },
  returns: fileContentReplaceResultValidator,
  handler: async (ctx, args): Promise<StoredFileContentReplaceResult> =>
    await replaceFileContent(ctx, args),
})

type FileContentReplacementArgs = Readonly<{
  resourceId: string
  expectedVersion: StoredVersionStamp
  uploadSessionId: Id<'fileStorage'>
  metadata: FileOwnedMetadata
  digest: string
}>

type PreparedFileContentReplacement = Readonly<{
  status: 'prepared'
  resourceId: ResourceId
  content: Doc<'resourceFileContents'>
  previousAssetId: AssetId | null
  previousOwner: Doc<'resourceAssetOwners'> | null
  claim: Extract<ResourceUploadClaim, { status: 'available' }>
  version: VersionStamp
}>

async function replaceFileContent(
  ctx: CampaignInternalMutationCtx,
  args: FileContentReplacementArgs,
): Promise<StoredFileContentReplaceResult> {
  const prepared = await prepareFileContentReplacement(ctx, args)
  if (prepared.status !== 'prepared') return prepared
  return await commitPreparedFileContentReplacement(ctx, args, prepared)
}

async function prepareFileContentReplacement(
  ctx: CampaignInternalMutationCtx,
  args: FileContentReplacementArgs,
): Promise<PreparedFileContentReplacement | StoredFileContentReplaceResult> {
  const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
  const authorization = await authorizeResourceContent(ctx, resourceId, 'file')
  if (authorization.status !== 'authorized') return rejectedFileReplacement('unauthorized')
  const content = await ctx.db
    .query('resourceFileContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  if (!content) return rejectedFileReplacement('content_missing')
  if (content.campaignUuid !== ctx.resourceScope.campaignId || content.state === 'failed') {
    return rejectedFileReplacement('content_corrupt')
  }
  if (content.state === 'initializing') {
    return { status: 'retryable', reason: 'content_initializing' }
  }
  const claim = await prepareResourceUploadClaim(ctx, {
    campaignId: ctx.resourceScope.campaignId,
    resourceId,
    sessionId: args.uploadSessionId,
  })
  if (claim.status === 'unavailable') return rejectedFileReplacement('invalid_file')
  const digest = assertSha256Digest(args.digest)
  const replay = fileReplacementReplay(content, claim, args.metadata, digest)
  if (replay) return replay
  if (claim.status === 'claimed') return rejectedFileReplacement('invalid_file')
  const version = fileReplacementVersion(content.version, args.expectedVersion, digest)
  if ('status' in version) return version
  const ownership = await loadFileReplacementOwnership(ctx, resourceId, content.assetUuid)
  if (ownership === 'corrupt') return rejectedFileReplacement('content_corrupt')
  return { status: 'prepared', resourceId, content, claim, version, ...ownership }
}

function fileReplacementReplay(
  content: Doc<'resourceFileContents'>,
  claim: ResourceUploadClaim,
  metadata: FileOwnedMetadata,
  digest: string,
): StoredFileContentReplaceResult | null {
  const matches =
    claim.status === 'claimed' &&
    content.version.revision > 1 &&
    claim.assetId === content.assetUuid &&
    content.version.digest === digest &&
    fileMetadataMatches(content, metadata)
  return matches
    ? {
        status: 'completed',
        content: { attachment: 'attached', ...metadata },
        version: content.version,
      }
    : null
}

function fileReplacementVersion(
  currentValue: unknown,
  expectedValue: unknown,
  digest: ReturnType<typeof assertSha256Digest>,
): VersionStamp | StoredFileContentReplaceResult {
  const current = assertVersionStamp(currentValue)
  const expected = assertVersionStamp(expectedValue)
  if (!versionStampEquals(current, expected)) return rejectedFileReplacement('version_conflict')
  if (current.revision === Number.MAX_SAFE_INTEGER && current.digest !== digest) {
    return rejectedFileReplacement('version_exhausted')
  }
  return advanceVersion(current, digest)
}

async function loadFileReplacementOwnership(
  ctx: CampaignInternalMutationCtx,
  resourceId: ResourceId,
  assetUuid: string | null,
): Promise<
  | 'corrupt'
  | Readonly<{
      previousAssetId: AssetId | null
      previousOwner: Doc<'resourceAssetOwners'> | null
    }>
> {
  if (assetUuid === null) return { previousAssetId: null, previousOwner: null }
  const previousAssetId = assertDomainId(DOMAIN_ID_KIND.asset, assetUuid)
  const previousOwner = await ctx.db
    .query('resourceAssetOwners')
    .withIndex('by_assetUuid', (query) => query.eq('assetUuid', previousAssetId))
    .unique()
  return previousOwner?.campaignUuid === ctx.resourceScope.campaignId &&
    previousOwner.resourceUuid === resourceId
    ? { previousAssetId, previousOwner }
    : 'corrupt'
}

async function commitPreparedFileContentReplacement(
  ctx: CampaignInternalMutationCtx,
  args: FileContentReplacementArgs,
  prepared: PreparedFileContentReplacement,
): Promise<StoredFileContentReplaceResult> {
  const committed = await commitResourceUploadClaim(ctx, prepared.claim, {
    campaignId: ctx.resourceScope.campaignId,
    resourceId: prepared.resourceId,
    expectedByteSize: args.metadata.byteSize,
  })
  await ctx.db.patch('resourceFileContents', prepared.content._id, {
    assetUuid: committed.assetId,
    state: 'ready',
    ...args.metadata,
    version: prepared.version,
  })
  if (prepared.previousOwner) await ctx.db.delete(prepared.previousOwner._id)
  if (prepared.previousAssetId) {
    await queueAssetRetirements(ctx, new Set([prepared.previousAssetId]))
  }
  return {
    status: 'completed',
    content: { attachment: 'attached', ...args.metadata },
    version: prepared.version,
  }
}

function rejectedFileReplacement(
  reason: Extract<StoredFileContentReplaceResult, { status: 'rejected' }>['reason'],
): StoredFileContentReplaceResult {
  return { status: 'rejected', reason }
}
