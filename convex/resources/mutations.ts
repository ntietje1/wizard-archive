import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import type {
  ResourceCompensationResult,
  ResourceCommandReceipt,
  ResourceAccessCommand,
  NoteBlockAccessCommand,
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
import { assertContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import type { SourcePathAlias } from '@wizard-archive/editor/resources/catalog-contract'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
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
  fileAssetCreationResultValidator,
  fileContentReplaceResultValidator,
  mapContentMutationResultValidator,
  mapContentCommandValidator,
  resourceCompensationResultValidator,
  resourceStructureCommandResultValidator,
  resourceStructureCommandValidator,
  resourceBookmarkMutationResultValidator,
  resourceAccessCommandResultValidator,
  resourceAccessCommandValidator,
  noteBlockAccessCommandResultValidator,
  noteBlockAccessCommandValidator,
  contentProviderSaveResultValidator,
  contentRecoveryActionResultValidator,
  itemHistoryRestoreResultValidator,
  resourcePresenceHeartbeatResultValidator,
  resourcePresenceReleaseResultValidator,
  resourcePresenceUpdateResultValidator,
  versionStampValidator,
  plainTransferManifestEntryValidator,
  plainTransferPlanSnapshotValidator,
  plainTransferReceiptValidator,
  plainTransferSourceDescriptorValidator,
} from './schema'
import { saveNoteContent as saveNoteContentFn } from './functions/saveNoteContent'
import { saveCanvasContent as saveCanvasContentFn } from './functions/saveCanvasContent'
import { reapplyYjsRecovery as reapplyYjsRecoveryFn } from './functions/reapplyYjsRecovery'
import {
  disconnectResourcePresence as disconnectResourcePresenceFn,
  heartbeatResourcePresence as heartbeatResourcePresenceFn,
  updateResourcePresence as updateResourcePresenceFn,
} from './functions/resourcePresence'
import {
  historyEntryIdValidator,
  importJobIdValidator,
  operationIdValidator,
  resourceIdValidator,
} from './validators'
import { setActorBookmarkState } from './functions/resourceBookmarks'
import { executeResourceAccessCommand as executeResourceAccessCommandFn } from './functions/executeResourceAccessCommand'
import { executeNoteBlockAccessCommand as executeNoteBlockAccessCommandFn } from './functions/executeNoteBlockAccessCommand'
import { createNoteContent, prepareNoteContentCreation } from './functions/noteContent'
import { createMapContent } from './functions/mapContent'
import { createCanvasContent } from './functions/canvasContent'
import { createFileContent } from './functions/fileContent'
import { syncNoteSearchProjection } from './functions/resourceSearchProjection'
import { authorizeResourceContent } from './functions/authorizeResourceContent'
import {
  commitResourceUploadClaim,
  loadResourceAssetOwnership,
  prepareResourceUploadClaim,
  queueAssetRetirements,
} from './functions/assetContent'
import type { ResourceUploadClaim } from './functions/assetContent'
import { executeMapContentCommand as executeMapContentCommandFn } from './functions/executeMapContentCommand'
import { replaceMapImage as replaceMapImageFn } from './functions/replaceMapImage'
import {
  appendResourceSourcePathAlias,
  findResourceSourcePathAlias,
} from './functions/resourceCatalogMetadata'
import {
  createCampaignAssetsFolder,
  requireCampaignAssetsFolder,
} from './functions/campaignAssetsFolder'
import {
  cancelPlainTransfer as cancelPlainTransferFn,
  finishPlainTransfer as finishPlainTransferFn,
  rejectPlainTransfer as rejectPlainTransferFn,
  reservePlainTransfer as reservePlainTransferFn,
  settlePlainTransferEntry,
  startPlainTransfer as startPlainTransferFn,
  validatePlainTransferEntryCommit,
} from './functions/plainTransfer'
import type { PlainTransferManifest } from '@wizard-archive/editor/resources/transfer-job-contract'
import { ITEM_HISTORY_ACTION } from '@wizard-archive/editor/resources/editor-runtime-contract'
import {
  recordItemHistoryEvent,
  restoreItemHistoryCheckpoint as restoreItemHistoryCheckpointFn,
} from './functions/itemHistory'
import { getUserUploadSession } from '../storage/functions/getUserUploadSession'
import { CAMPAIGN_MEMBER_ROLE } from '../../shared/campaigns/types'
import { findCanonicalResource } from './functions/findCanonicalResource'

type StoredResourceStructureCommandResult = Infer<typeof resourceStructureCommandResultValidator>
type StoredResourceCompensationResult = Infer<typeof resourceCompensationResultValidator>
type StoredResourceCommandReceipt = Extract<
  StoredResourceStructureCommandResult,
  { status: 'completed' }
>['receipt']
type StoredResourceStructureCommand = Infer<typeof resourceStructureCommandValidator>
type StoredResourceAccessCommand = Infer<typeof resourceAccessCommandValidator>
type StoredNoteBlockAccessCommand = Infer<typeof noteBlockAccessCommandValidator>
type StoredFileContentReplaceResult = Infer<typeof fileContentReplaceResultValidator>
type StoredFileAssetCreationResult = Infer<typeof fileAssetCreationResultValidator>
type StoredVersionStamp = Infer<typeof versionStampValidator>

type FileResourceCreationArgs = Readonly<{
  operationId: string
  uploadSessionId: Id<'fileStorage'>
  metadata: FileOwnedMetadata
  version: StoredVersionStamp
}>

type FileCreateCommand = Extract<ResourceStructureCommand, { type: 'create' }> &
  Readonly<{ kind: 'file' }>

type FileCreationIdentity = Readonly<{
  campaignId: CampaignId
  metadata: FileOwnedMetadata
  upload: Doc<'fileStorage'> | null
  userId: Id<'userProfiles'>
  version: VersionStamp
}>

const plainTransferReservationResultValidator = v.union(
  v.object({
    status: v.literal('reserved'),
    receipt: plainTransferReceiptValidator,
    uploadTargets: v.array(
      v.object({
        sourceId: v.string(),
        sourcePath: v.string(),
        sessionId: v.id('fileStorage'),
        uploadUrl: v.string(),
      }),
    ),
  }),
  v.object({ status: v.literal('rejected'), reason: v.string() }),
)

const plainTransferReceiptResultValidator = v.union(
  plainTransferReceiptValidator,
  v.object({ status: v.literal('unavailable') }),
)

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
  kind: 'canvas' | 'file' | 'map',
  createContent: (
    ctx: CampaignMutationCtx,
    campaignId: CampaignMutationCtx['resourceScope']['campaignId'],
    resourceId: Extract<ResourceStructureCommand, { type: 'create' }>['resourceId'],
    title: string,
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
  await createContent(ctx, ctx.resourceScope.campaignId, command.resourceId, command.title)
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
        changes: resourceMetadataChanges(command.changes),
      }
    case 'move':
      return {
        type: 'move',
        resourceIds: command.resourceIds.map(resourceId),
        destinationParentId:
          command.destinationParentId === null ? null : resourceId(command.destinationParentId),
      }
    case 'trash':
    case 'permanentlyDelete':
      return { type: command.type, resourceIds: command.resourceIds.map(resourceId) }
    case 'restore':
      return {
        type: 'restore',
        resourceIds: command.resourceIds.map(resourceId),
        destination:
          command.destination === null || command.destination === 'previousParent'
            ? command.destination
            : resourceId(command.destination),
      }
    case 'deepCopy':
      return {
        type: 'deepCopy',
        sourceRootIds: command.sourceRootIds.map(resourceId),
        destinationParentId:
          command.destinationParentId === null ? null : resourceId(command.destinationParentId),
      }
  }
}

function resourceMetadataChanges(
  changes: Extract<StoredResourceStructureCommand, { type: 'updateMetadata' }>['changes'],
) {
  return {
    ...(changes.title === undefined ? {} : { title: canonicalizeResourceTitle(changes.title) }),
    ...(changes.icon === undefined ? {} : { icon: changes.icon }),
    ...(changes.color === undefined ? {} : { color: changes.color }),
  }
}

function resourceAccessCommand(command: StoredResourceAccessCommand): ResourceAccessCommand {
  const resourceId = (value: string) => assertDomainId(DOMAIN_ID_KIND.resource, value)
  switch (command.type) {
    case 'setAudienceAccess':
      return {
        type: command.type,
        resourceIds: command.resourceIds.map(resourceId),
        permission: command.permission,
      }
    case 'clearAudienceAccess':
      return {
        type: command.type,
        resourceIds: command.resourceIds.map(resourceId),
      }
    case 'setMemberAccess':
      return {
        type: command.type,
        resourceIds: command.resourceIds.map(resourceId),
        memberId: assertDomainId(DOMAIN_ID_KIND.campaignMember, command.memberId),
        permission: command.permission,
      }
    case 'clearMemberAccess':
      return {
        type: command.type,
        resourceIds: command.resourceIds.map(resourceId),
        memberId: assertDomainId(DOMAIN_ID_KIND.campaignMember, command.memberId),
      }
    case 'setFolderAccessInheritance':
      return {
        type: command.type,
        folderId: resourceId(command.folderId),
        inheritance: command.inheritance,
      }
  }
}

function noteBlockAccessCommand(command: StoredNoteBlockAccessCommand): NoteBlockAccessCommand {
  const noteId = assertDomainId(DOMAIN_ID_KIND.resource, command.noteId)
  const blockIds = command.blockIds.map((blockId) =>
    assertDomainId(DOMAIN_ID_KIND.noteBlock, blockId),
  )
  switch (command.type) {
    case 'setNoteBlockAudienceAccess':
      return { type: command.type, noteId, blockIds, shared: command.shared }
    case 'setNoteBlockMemberAccess':
      return {
        type: command.type,
        noteId,
        blockIds,
        memberId: assertDomainId(DOMAIN_ID_KIND.campaignMember, command.memberId),
        permission: command.permission,
      }
    case 'clearNoteBlockMemberAccess':
      return {
        type: command.type,
        noteId,
        blockIds,
        memberId: assertDomainId(DOMAIN_ID_KIND.campaignMember, command.memberId),
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

export const setBookmarkState = dmMutation({
  args: {
    resourceIds: v.array(resourceIdValidator),
    bookmarked: v.boolean(),
  },
  returns: resourceBookmarkMutationResultValidator,
  handler: async (ctx, args) => await setActorBookmarkState(ctx, args.resourceIds, args.bookmarked),
})

export const executeResourceAccessCommand = dmMutation({
  args: {
    operationId: operationIdValidator,
    command: resourceAccessCommandValidator,
  },
  returns: resourceAccessCommandResultValidator,
  handler: async (ctx, args) => {
    const result = await executeResourceAccessCommandFn(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.operation, args.operationId),
      resourceAccessCommand(args.command),
    )
    return result.status === 'completed'
      ? {
          status: 'completed' as const,
          receipt: { ...result.receipt, resourceIds: [...result.receipt.resourceIds] },
        }
      : result
  },
})

export const executeNoteBlockAccessCommand = campaignMutation({
  args: {
    operationId: operationIdValidator,
    command: noteBlockAccessCommandValidator,
  },
  returns: noteBlockAccessCommandResultValidator,
  handler: async (ctx, args) => {
    const result = await executeNoteBlockAccessCommandFn(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.operation, args.operationId),
      noteBlockAccessCommand(args.command),
    )
    return result.status === 'completed'
      ? {
          status: 'completed' as const,
          receipt: { ...result.receipt, blockIds: [...result.receipt.blockIds] },
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
    const prepared = await prepareNoteContentCreation(args.update, command.resourceId)
    if (!prepared) return { status: 'rejected', reason: 'content_integrity_failure' }
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
      prepared.version,
      prepared.occurrences,
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

export const createFileResource = campaignMutation({
  args: { operationId: operationIdValidator, command: resourceStructureCommandValidator },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> =>
    await createFixedContentResource(ctx, args, 'file', createFileContent),
})

export const createCanvasResource = campaignMutation({
  args: { operationId: operationIdValidator, command: resourceStructureCommandValidator },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> =>
    await createFixedContentResource(ctx, args, 'canvas', createCanvasContent),
})

export const saveNoteContent = campaignMutation({
  args: {
    generation: v.number(),
    resourceId: resourceIdValidator,
    update: v.bytes(),
  },
  returns: contentProviderSaveResultValidator,
  handler: async (ctx, args) =>
    await saveNoteContentFn(ctx, {
      generation: assertContentGeneration(args.generation),
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      update: args.update,
    }),
})

export const saveCanvasContent = campaignMutation({
  args: {
    generation: v.number(),
    resourceId: resourceIdValidator,
    update: v.bytes(),
  },
  returns: contentProviderSaveResultValidator,
  handler: async (ctx, args) =>
    await saveCanvasContentFn(ctx, {
      generation: assertContentGeneration(args.generation),
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      update: args.update,
    }),
})

export const reapplyYjsRecovery = campaignMutation({
  args: {
    expectedGeneration: v.number(),
    expectedVersion: versionStampValidator,
    operationId: operationIdValidator,
    resourceId: resourceIdValidator,
    snapshotUpdate: v.bytes(),
    snapshotVersion: versionStampValidator,
  },
  returns: contentRecoveryActionResultValidator,
  handler: async (ctx, args) =>
    await reapplyYjsRecoveryFn(ctx, {
      expectedGeneration: assertContentGeneration(args.expectedGeneration),
      expectedVersion: assertVersionStamp(args.expectedVersion),
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, args.operationId),
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      snapshotUpdate: args.snapshotUpdate,
      snapshotVersion: assertVersionStamp(args.snapshotVersion),
    }),
})

export const restoreItemHistoryCheckpoint = campaignMutation({
  args: {
    operationId: operationIdValidator,
    resourceId: resourceIdValidator,
    entryId: historyEntryIdValidator,
    expectedVersion: versionStampValidator,
  },
  returns: itemHistoryRestoreResultValidator,
  handler: async (ctx, args) =>
    await restoreItemHistoryCheckpointFn(ctx, {
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, args.operationId),
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      entryId: assertDomainId(DOMAIN_ID_KIND.historyEntry, args.entryId),
      expectedVersion: assertVersionStamp(args.expectedVersion),
    }),
})

export const heartbeatResourcePresence = campaignMutation({
  args: {
    resourceId: resourceIdValidator,
    clientId: v.number(),
    sessionId: v.string(),
  },
  returns: resourcePresenceHeartbeatResultValidator,
  handler: async (ctx, args) =>
    await heartbeatResourcePresenceFn(ctx, {
      ...args,
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
    }),
})

export const updateResourcePresence = campaignMutation({
  args: {
    resourceId: resourceIdValidator,
    clientId: v.number(),
    state: v.bytes(),
  },
  returns: resourcePresenceUpdateResultValidator,
  handler: async (ctx, args) =>
    await updateResourcePresenceFn(ctx, {
      ...args,
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
    }),
})

export const disconnectResourcePresence = campaignMutation({
  args: { resourceId: resourceIdValidator, sessionToken: v.string() },
  returns: resourcePresenceReleaseResultValidator,
  handler: async (ctx, args) =>
    await disconnectResourcePresenceFn(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      args.sessionToken,
    ),
})

export const reservePlainTransfer = dmMutation({
  args: {
    jobId: importJobIdValidator,
    destinationParentId: v.nullable(resourceIdValidator),
    textFileHandling: v.union(v.literal('files'), v.literal('notes')),
    sources: v.array(plainTransferSourceDescriptorValidator),
    entries: v.array(plainTransferManifestEntryValidator),
  },
  returns: plainTransferReservationResultValidator,
  handler: async (ctx, args) =>
    await reservePlainTransferFn(ctx, {
      version: 'plain-transfer-manifest-v1',
      jobId: assertDomainId(DOMAIN_ID_KIND.importJob, args.jobId),
      destinationCampaignId: ctx.resourceScope.campaignId,
      destinationParentId:
        args.destinationParentId === null
          ? null
          : assertDomainId(DOMAIN_ID_KIND.resource, args.destinationParentId),
      textFileHandling: args.textFileHandling,
      sources: args.sources,
      entries: args.entries,
    } satisfies PlainTransferManifest),
})

export const cancelPlainTransfer = dmMutation({
  args: { jobId: importJobIdValidator },
  returns: plainTransferReceiptResultValidator,
  handler: async (ctx, args) =>
    await cancelPlainTransferFn(ctx, assertDomainId(DOMAIN_ID_KIND.importJob, args.jobId)),
})

export const startPlainTransfer = campaignInternalMutation({
  args: { jobId: importJobIdValidator },
  returns: plainTransferPlanSnapshotValidator,
  handler: async (ctx, args) =>
    await startPlainTransferFn(ctx, assertDomainId(DOMAIN_ID_KIND.importJob, args.jobId)),
})

export const finishPlainTransfer = campaignInternalMutation({
  args: { jobId: importJobIdValidator },
  returns: plainTransferReceiptResultValidator,
  handler: async (ctx, args) =>
    await finishPlainTransferFn(ctx, assertDomainId(DOMAIN_ID_KIND.importJob, args.jobId)),
})

export const rejectPlainTransfer = campaignInternalMutation({
  args: { jobId: importJobIdValidator, reason: v.string() },
  returns: plainTransferReceiptResultValidator,
  handler: async (ctx, args) =>
    await rejectPlainTransferFn(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.importJob, args.jobId),
      args.reason,
    ),
})

export const commitPlainTransferFolder = campaignInternalMutation({
  args: {
    jobId: importJobIdValidator,
    sourceId: v.string(),
    sourcePath: v.string(),
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> =>
    await commitPlainTransferCatalogResource(ctx, args, 'folder'),
})

export const commitPlainTransferNote = campaignInternalMutation({
  args: {
    jobId: importJobIdValidator,
    sourceId: v.string(),
    sourcePath: v.string(),
    update: v.bytes(),
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const plan = await preparePlainTransferCatalogResource(ctx, args, 'note')
    if (plan.state === 'rejected') return plan.result
    const prepared = await prepareNoteContentCreation(args.update, plan.command.resourceId)
    if (!prepared)
      return await rejectPlainTransferEntry(ctx, plan.entry, 'content_integrity_failure')
    const result = await executeStructureCommandFn(ctx, {
      operationId: plan.operationId,
      command: plan.command,
    })
    if (result.status !== 'completed') {
      return await rejectPlainTransferEntry(ctx, plan.entry, result.reason)
    }
    const contentResult = await createNoteContent(
      ctx,
      ctx.resourceScope.campaignId,
      plan.command.resourceId,
      plan.operationId,
      args.update,
      prepared.version,
      prepared.occurrences,
    )
    if (contentResult === 'operation_id_reused') {
      return await rejectPlainTransferEntry(ctx, plan.entry, 'operation_id_reused')
    }
    await appendResourceSourcePathAlias(ctx, plan.alias)
    await syncNoteSearchProjection(ctx, plan.command.resourceId, args.update)
    await settlePlainTransferEntry(ctx, plan.entry, {
      status: 'completed',
      resourceId: plan.command.resourceId,
      kind: 'note',
    })
    return storedResult(result)
  },
})

export const commitPlainTransferFile = campaignInternalMutation({
  args: {
    jobId: importJobIdValidator,
    sourceId: v.string(),
    sourcePath: v.string(),
    metadata: v.object(fileOwnedMetadataValidators),
    version: versionStampValidator,
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const plan = await preparePlainTransferCatalogResource(ctx, args, 'file')
    if (plan.state === 'rejected') return plan.result
    if (!plan.entry.uploadSessionUuid) {
      return await rejectPlainTransferEntry(ctx, plan.entry, 'invalid_source')
    }
    const result = await commitFileResourceCreationFn(
      ctx,
      {
        uploadSessionId: plan.entry.uploadSessionUuid,
        operationId: plan.operationId,
        metadata: args.metadata,
        version: args.version,
      },
      plan.command,
      plan.alias,
    )
    await settlePlainTransferEntry(
      ctx,
      plan.entry,
      result.status === 'completed' && result.receipt.result.type === 'created'
        ? {
            status: 'completed',
            resourceId: assertDomainId(DOMAIN_ID_KIND.resource, result.receipt.result.resourceId),
            kind: 'file',
          }
        : {
            status: 'rejected',
            reason: result.status === 'completed' ? 'invalid_response' : result.reason,
          },
    )
    return result
  },
})

type PlainTransferCatalogResourceArgs = Readonly<{
  jobId: string
  sourceId: string
  sourcePath: string
}>

type PlainTransferCatalogResourcePlan<TKind extends 'file' | 'folder' | 'note'> =
  | Readonly<{
      state: 'ready'
      command: Extract<ResourceStructureCommand, { type: 'create' }> & Readonly<{ kind: TKind }>
      alias: SourcePathAlias
      entry: Doc<'resourceTransferEntries'>
      operationId: ReturnType<typeof assertOperationId>
    }>
  | Readonly<{ state: 'rejected'; result: StoredResourceStructureCommandResult }>

function assertOperationId(value: string) {
  return assertDomainId(DOMAIN_ID_KIND.operation, value)
}

async function preparePlainTransferCatalogResource<TKind extends 'file' | 'folder' | 'note'>(
  ctx: CampaignInternalMutationCtx,
  args: PlainTransferCatalogResourceArgs,
  kind: TKind,
): Promise<PlainTransferCatalogResourcePlan<TKind>> {
  const jobId = assertDomainId(DOMAIN_ID_KIND.importJob, args.jobId)
  const validated = await validatePlainTransferEntryCommit(ctx, {
    jobId,
    sourceId: args.sourceId,
    sourcePath: args.sourcePath,
    kind,
  })
  if (!validated) {
    return {
      state: 'rejected',
      result: { status: 'rejected', reason: 'invalid_command' },
    }
  }
  const entry = validated.entry
  const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, entry.plannedResourceUuid)
  return {
    state: 'ready',
    command: {
      type: 'create',
      resourceId,
      kind,
      parentId:
        entry.parentResourceUuid === null
          ? null
          : assertDomainId(DOMAIN_ID_KIND.resource, entry.parentResourceUuid),
      title: canonicalizeResourceTitle(entry.title),
      icon: null,
      color: null,
    },
    alias: {
      campaignId: ctx.resourceScope.campaignId,
      resourceId,
      importJobId: jobId,
      sourceRootId: entry.sourceRootId,
      rawPath: entry.rawPath,
      normalizedPath: entry.normalizedPath,
    },
    entry,
    operationId: assertOperationId(entry.plannedOperationUuid),
  }
}

async function commitPlainTransferCatalogResource(
  ctx: CampaignInternalMutationCtx,
  args: PlainTransferCatalogResourceArgs,
  kind: 'folder',
): Promise<StoredResourceStructureCommandResult> {
  const plan = await preparePlainTransferCatalogResource(ctx, args, kind)
  if (plan.state === 'rejected') return plan.result
  const result = await executeStructureCommandFn(ctx, {
    operationId: plan.operationId,
    command: plan.command,
  })
  if (result.status !== 'completed') {
    return await rejectPlainTransferEntry(ctx, plan.entry, result.reason)
  }
  await appendResourceSourcePathAlias(ctx, plan.alias)
  await settlePlainTransferEntry(ctx, plan.entry, {
    status: 'completed',
    resourceId: plan.command.resourceId,
    kind: 'folder',
  })
  return storedResult(result)
}

async function rejectPlainTransferEntry(
  ctx: CampaignInternalMutationCtx,
  entry: Doc<'resourceTransferEntries'>,
  reason: string,
): Promise<StoredResourceStructureCommandResult> {
  await settlePlainTransferEntry(ctx, entry, { status: 'rejected', reason })
  return { status: 'rejected', reason: 'invalid_command' }
}

async function commitFileResourceCreationFn(
  ctx: CampaignInternalMutationCtx,
  args: FileResourceCreationArgs,
  command: FileCreateCommand,
  alias: SourcePathAlias,
): Promise<StoredResourceStructureCommandResult> {
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
    return (await existingFileCreationMatches(ctx, args, claim, content, alias))
      ? storedResult(result)
      : { status: 'rejected', reason: 'operation_id_reused' }
  }
  return await commitFreshFileCreation(ctx, args, claim, command, alias, result)
}

async function existingFileCreationMatches(
  ctx: CampaignInternalMutationCtx,
  args: FileResourceCreationArgs,
  claim: ResourceUploadClaim,
  content: Doc<'resourceFileContents'>,
  alias: SourcePathAlias,
): Promise<boolean> {
  if (claim.status !== 'claimed') return false
  if (
    !existingFileContentMatches(content, {
      campaignId: ctx.resourceScope.campaignId,
      metadata: args.metadata,
      upload: claim.upload,
      userId: ctx.membership.userId,
      version: assertVersionStamp(args.version),
    })
  ) {
    return false
  }
  const existingAlias = await findResourceSourcePathAlias(ctx, alias)
  return existingAlias?.rawPath === alias.rawPath
}

async function commitFreshFileCreation(
  ctx: CampaignInternalMutationCtx,
  args: FileResourceCreationArgs,
  claim: ResourceUploadClaim,
  command: FileCreateCommand,
  alias: SourcePathAlias,
  result: Extract<ResourceStructureCommandResult, { status: 'completed' }>,
): Promise<StoredResourceStructureCommandResult> {
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
  await appendResourceSourcePathAlias(ctx, alias)
  return storedResult(result)
}

export const commitAssetFileCreation = campaignInternalMutation({
  args: {
    uploadSessionId: v.id('fileStorage'),
    metadata: v.object(fileOwnedMetadataValidators),
    version: versionStampValidator,
  },
  returns: fileAssetCreationResultValidator,
  handler: async (ctx, args): Promise<StoredFileAssetCreationResult> => {
    if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
      return { status: 'rejected', reason: 'unauthorized' }
    }
    const upload = await getUserUploadSession(ctx, args.uploadSessionId, ctx.membership.userId)
    if (!upload || upload.assetUuid === null || upload.storageId === null) {
      return { status: 'rejected', reason: 'invalid_file' }
    }
    const version = assertVersionStamp(args.version)
    if (version.revision !== 1) return { status: 'rejected', reason: 'invalid_file' }
    if (upload.status === 'committed') {
      return await replayAssetFileCreation(ctx, upload, args.metadata, version)
    }

    let parentId
    try {
      parentId = await resolveCampaignAssetsFolder(ctx)
    } catch {
      return { status: 'rejected', reason: 'content_integrity_failure' }
    }
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const claim = await prepareResourceUploadClaim(ctx, {
      campaignId: ctx.resourceScope.campaignId,
      resourceId,
      sessionId: args.uploadSessionId,
    })
    if (claim.status !== 'available') return { status: 'rejected', reason: 'invalid_file' }
    let title
    try {
      title = canonicalizeResourceTitle(upload.originalFileName ?? 'Untitled file')
    } catch {
      return { status: 'rejected', reason: 'invalid_file' }
    }
    const result = await executeStructureCommandFn(ctx, {
      operationId,
      command: {
        type: 'create',
        resourceId,
        kind: 'file',
        parentId,
        title,
        icon: null,
        color: null,
      },
    })
    if (result.status !== 'completed') {
      return { status: 'rejected', reason: result.reason }
    }
    const committed = await commitResourceUploadClaim(ctx, claim, {
      campaignId: ctx.resourceScope.campaignId,
      resourceId,
      expectedByteSize: args.metadata.byteSize,
    })
    await ctx.db.insert('resourceFileContents', {
      campaignUuid: ctx.resourceScope.campaignId,
      resourceUuid: resourceId,
      state: 'ready',
      assetUuid: committed.assetId,
      ...args.metadata,
      version,
    })
    return { status: 'completed', resourceId }
  },
})

async function resolveCampaignAssetsFolder(ctx: CampaignInternalMutationCtx): Promise<ResourceId> {
  const { campaignId, actorId } = ctx.resourceScope
  if (ctx.campaign.assetsFolderUuid !== undefined) {
    return await requireCampaignAssetsFolder(
      ctx,
      campaignId,
      assertDomainId(DOMAIN_ID_KIND.resource, ctx.campaign.assetsFolderUuid),
    )
  }
  const resourceId = await createCampaignAssetsFolder(
    ctx,
    campaignId,
    actorId,
    ctx.campaign.resourceAccessDefaults.folderInheritance,
  )
  await ctx.db.patch('campaigns', ctx.campaign._id, { assetsFolderUuid: resourceId })
  return resourceId
}

async function replayAssetFileCreation(
  ctx: CampaignInternalMutationCtx,
  upload: Doc<'fileStorage'>,
  metadata: FileOwnedMetadata,
  version: VersionStamp,
): Promise<StoredFileAssetCreationResult> {
  const owner = await ctx.db
    .query('resourceAssetOwners')
    .withIndex('by_assetUuid', (query) => query.eq('assetUuid', upload.assetUuid!))
    .unique()
  if (!owner || owner.campaignUuid !== ctx.resourceScope.campaignId) {
    return { status: 'rejected', reason: 'invalid_file' }
  }
  const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, owner.resourceUuid)
  const [resource, content] = await Promise.all([
    findCanonicalResource(ctx.db, resourceId),
    ctx.db
      .query('resourceFileContents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
      .unique(),
  ])
  if (
    !resource ||
    resource.campaignUuid !== ctx.resourceScope.campaignId ||
    resource.kind !== 'file' ||
    !content ||
    !existingFileContentMatches(content, {
      campaignId: ctx.resourceScope.campaignId,
      metadata,
      upload,
      userId: ctx.membership.userId,
      version,
    })
  ) {
    return { status: 'rejected', reason: 'invalid_file' }
  }
  return { status: 'completed', resourceId }
}

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
  const authorization = await authorizeResourceContent(ctx, resourceId, 'file', 'edit')
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
  const ownership = await loadResourceAssetOwnership(
    ctx,
    ctx.resourceScope.campaignId,
    resourceId,
    content.assetUuid,
  )
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

export const commitMapImageReplacement = campaignInternalMutation({
  args: {
    resourceId: resourceIdValidator,
    expectedVersion: versionStampValidator,
    layerId: v.nullable(v.string()),
    uploadSessionId: v.id('fileStorage'),
    image: v.object({
      byteSize: v.number(),
      digest: v.string(),
      mediaType: v.string(),
    }),
  },
  returns: mapContentMutationResultValidator,
  handler: async (ctx, args) => await replaceMapImageFn(ctx, args),
})

export const executeMapContentCommand = campaignMutation({
  args: {
    resourceId: resourceIdValidator,
    operationId: operationIdValidator,
    expectedVersion: versionStampValidator,
    command: mapContentCommandValidator,
  },
  returns: mapContentMutationResultValidator,
  handler: async (ctx, args) => await executeMapContentCommandFn(ctx, args),
})

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
  await recordItemHistoryEvent(ctx, prepared.resourceId, {
    action: ITEM_HISTORY_ACTION.fileReplaced,
    metadata: null,
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
