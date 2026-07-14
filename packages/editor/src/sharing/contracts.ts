import type { ResourceId, CampaignMemberId } from '../resources/domain-id'
import { SHARE_STATUS } from '../../../../shared/block-shares/share-status'
import type { ShareStatus } from '../../../../shared/block-shares/share-status'
import type { MaybePromise } from '../../../../shared/common/async'

import type { ReactNode } from 'react'
import { hasPermissionForRequirement } from '../../../../shared/permissions/requirements'
import type { AnyItem } from '../workspace/items'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { ResourceCommandResult } from '../filesystem/transaction-contract'
import type { AggregateShareStatus, ShareItem, ShareState } from './share-state'

export const EDITOR_PERMISSION_LEVEL = {
  NONE: 'none',
  VIEW: 'view',
  EDIT: 'edit',
  FULL_ACCESS: 'full_access',
} as const

export type EditorPermissionLevel =
  (typeof EDITOR_PERMISSION_LEVEL)[keyof typeof EDITOR_PERMISSION_LEVEL]

export interface EditorShareParticipant {
  id: CampaignMemberId
  displayName: string
  profileId?: string
  username?: string | null
  imageUrl?: string | null
}

export type UnsupportedSharingSource = {
  status: 'unsupported'
  reason: 'not_available' | 'insufficient_authority'
}

export type ResourceShareSource = UnsupportedSharingSource | ResourceItemsShareCapability

interface ResourceItemsShareCapability {
  renderItemsShareState: (
    items: Array<AnyItem>,
    render: (state: ResourceShareState) => ReactNode,
  ) => ReactNode
  setDefaultPermission: (
    items: Array<AnyItem>,
    level: EditorPermissionLevel | null,
  ) => Promise<ShareActionResult>
  setParticipantPermission: (
    items: Array<AnyItem>,
    participantId: CampaignMemberId,
    level: EditorPermissionLevel,
  ) => Promise<ShareActionResult>
  status: 'available'
}

export type ViewAsParticipantCapability =
  | UnsupportedSharingSource
  | {
      status: 'available'
      isPending: boolean
      participants: Array<EditorShareParticipant>
      selectedParticipantId: CampaignMemberId | undefined
      setSelectedParticipantId: (participantId: CampaignMemberId | undefined) => void
    }

export interface WizardEditorSharingSource {
  blocks: BlocksShareSource
  items: ResourceShareSource
  viewAsParticipant: ViewAsParticipantCapability
}

export type BlocksShareSource =
  | UnsupportedSharingSource
  | {
      status: 'available'
      useBlocksShare: (
        blocks: Array<BlockShareTargetBlock>,
        note: BlockShareTargetNote | undefined,
      ) => BlocksShareState
    }

type BlockVisibilitySelectValue = 'default' | 'hidden' | 'visible'
type AggregateBlockVisibilitySelectValue =
  | Extract<BlockVisibilitySelectValue, 'hidden' | 'visible'>
  | 'mixed'
type BlockShareItemPermissionValue = BlockVisibilitySelectValue | 'mixed'
type BlockShareItemKind = 'controllable' | 'locked_visible'
type BlockShareParticipantId = CampaignMemberId
type BlocksShareStatus = 'unavailable' | 'loading' | 'incomplete' | 'ready'
type ShareActionBlockedReason = 'incomplete' | 'not_folder' | 'not_mutable'

export type ShareActionResult =
  | { status: 'completed' }
  | { status: 'blocked'; reason: ShareActionBlockedReason }
  | { status: 'failed'; error?: unknown }

export interface BlockShareTargetBlock {
  id: string
}

export interface BlockShareTargetNote {
  id: ResourceId
}

interface BlockShareItem {
  key: string
  participant: EditorShareParticipant
  kind: BlockShareItemKind
  permissionLevel: BlockShareItemPermissionValue
  hasExplicitShare: boolean
}

interface BlocksShareStateBase {
  status: BlocksShareStatus
  isMutating: boolean
  aggregateShareStatus: AggregateShareStatus
  defaultPermissionLevel: AggregateBlockVisibilitySelectValue
  shareItems: Array<BlockShareItem>
}

interface PendingBlocksShareState extends BlocksShareStateBase {
  status: Exclude<BlocksShareStatus, 'ready'>
}

interface ReadyBlocksShareState extends BlocksShareStateBase {
  status: 'ready'
  toggleShareStatus: () => Promise<ShareActionResult>
  setDefaultPermission: (
    value: Extract<BlockVisibilitySelectValue, 'hidden' | 'visible'>,
  ) => Promise<ShareActionResult>
  setParticipantPermission: (
    participantId: BlockShareParticipantId,
    value: BlockVisibilitySelectValue,
  ) => Promise<ShareActionResult>
}

export type BlocksShareState = PendingBlocksShareState | ReadyBlocksShareState

export interface BlockShareProjectionData<
  ParticipantId extends CampaignMemberId = BlockShareParticipantId,
> {
  blocks?: Array<{
    noteBlockId: string
    shareStatus: ShareStatus | null
    memberPermissions: Partial<
      Record<
        ParticipantId,
        Extract<
          EditorPermissionLevel,
          typeof EDITOR_PERMISSION_LEVEL.NONE | typeof EDITOR_PERMISSION_LEVEL.VIEW
        >
      >
    >
  }>
  notePermissionsByParticipantId?: Partial<Record<ParticipantId, EditorPermissionLevel>>
  participants?: Array<EditorShareParticipant & { id: ParticipantId }>
}

export interface BlocksShareProjection<
  ParticipantId extends CampaignMemberId = BlockShareParticipantId,
> {
  status: Exclude<BlocksShareStatus, 'unavailable'>
  aggregateShareStatus: AggregateShareStatus
  defaultPermissionLevel: AggregateBlockVisibilitySelectValue
  shareItems: Array<BlockShareItem & { participant: { id: ParticipantId } }>
}

export interface BlocksShareOperations {
  setBlocksShareStatus: (input: {
    noteId: BlockShareTargetNote['id']
    noteBlockIds: Array<string>
    status: ShareStatus
  }) => MaybePromise<ResourceCommandResult>
  setBlockParticipantPermission: (input: {
    noteId: BlockShareTargetNote['id']
    noteBlockIds: Array<string>
    participantId: BlockShareParticipantId
    permissionLevel: Extract<
      EditorPermissionLevel,
      typeof EDITOR_PERMISSION_LEVEL.NONE | typeof EDITOR_PERMISSION_LEVEL.VIEW
    > | null
  }) => MaybePromise<ResourceCommandResult>
}

type MixedPermissionLevel = 'mixed'
type AggregatePermissionLevel = EditorPermissionLevel | MixedPermissionLevel
type NullableAggregatePermissionLevel = EditorPermissionLevel | MixedPermissionLevel | null

interface ShareItemWithPermission extends ShareItem {
  permissionLevel: AggregatePermissionLevel
  hasExplicitShare: boolean
  inheritedPermissionLevel: AggregatePermissionLevel
  inheritedFromFolderName?: string
}

type ResourceShareStatus = 'unavailable' | 'loading' | 'incomplete' | 'failed' | 'ready'

interface ResourceShareStateBase {
  isMutating: boolean
  status: ResourceShareStatus
  aggregateShareStatus: AggregateShareStatus | null
  defaultPermissionLevel: NullableAggregatePermissionLevel
  inheritedAllPermissionLevel: NullableAggregatePermissionLevel
  inheritedFromFolderName: string | null
  isFolderItem: boolean
  inheritShares: boolean
  shareableItems: Array<AnyItem>
  participants: Array<EditorShareParticipant>
  shareItems: Array<ShareItemWithPermission>
}

interface PendingResourceShareState extends ResourceShareStateBase {
  status: Exclude<ResourceShareStatus, 'ready'>
}

interface ReadyResourceShareState extends ResourceShareStateBase {
  status: 'ready'
  toggleShareStatus: () => Promise<ShareActionResult>
  toggleShareWithParticipant: (participantId: CampaignMemberId) => Promise<ShareActionResult>
  setParticipantPermission: (
    participantId: CampaignMemberId,
    level: EditorPermissionLevel,
  ) => Promise<ShareActionResult>
  clearParticipantPermission: (participantId: CampaignMemberId) => Promise<ShareActionResult>
  setDefaultPermission: (level: EditorPermissionLevel | null) => Promise<ShareActionResult>
  setInheritShares: (enabled: boolean) => Promise<ShareActionResult>
}

export type ResourceShareState = PendingResourceShareState | ReadyResourceShareState

export interface ResourceShareProjectionData<
  ParticipantId extends CampaignMemberId = BlockShareParticipantId,
> {
  sidebarItemId: AnyItem['id']
  allPermissionLevel: EditorPermissionLevel | null
  inheritShares: boolean
  inheritedAllPermissionLevel: EditorPermissionLevel | null
  inheritedFromFolderName: string | null
  shares: Array<{
    participantId: ParticipantId
    permissionLevel: EditorPermissionLevel | null
  }>
  memberInheritedPermissions: Partial<Record<ParticipantId, EditorPermissionLevel>>
  memberInheritedFromFolderNames: Partial<Record<ParticipantId, string>>
}

export interface ResourceShareProjection<
  ParticipantId extends CampaignMemberId = BlockShareParticipantId,
> {
  aggregateShareStatus: AggregateShareStatus | null
  defaultPermissionLevel: NullableAggregatePermissionLevel
  getParticipantAccessSource: (participantId: ParticipantId) => 'explicit' | 'default' | 'none'
  getShareState: (participantId: ParticipantId) => ShareState
  hasCompleteData: boolean
  status: Exclude<ResourceShareStatus, 'unavailable'>
  inheritShares: boolean
  inheritedAllPermissionLevel: NullableAggregatePermissionLevel
  inheritedFromFolderName: string | null
  isFolderItem: boolean
  shareItems: Array<
    ShareItemWithPermission & { participant: EditorShareParticipant & { id: ParticipantId } }
  >
}

export interface ResourceShareOperations {
  setParticipantPermission: (input: {
    itemIds: Array<ResourceId>
    participantId: CampaignMemberId
    permissionLevel: EditorPermissionLevel
  }) => MaybePromise<ResourceCommandResult>
  clearParticipantPermission: (input: {
    itemIds: Array<ResourceId>
    participantId: CampaignMemberId
  }) => MaybePromise<ResourceCommandResult>
  setDefaultPermission: (input: {
    itemIds: Array<ResourceId>
    permissionLevel: EditorPermissionLevel | null
  }) => MaybePromise<ResourceCommandResult>
  setFolderInheritShares: (input: {
    folderId: ResourceId
    inheritShares: boolean
  }) => MaybePromise<ResourceCommandResult>
}

type RunBlocksShareCommand = (
  command: () => MaybePromise<ResourceCommandResult>,
  errorMessage: string,
) => Promise<ShareActionResult>

interface BlocksShareRuntimeStateInput {
  noteBlockIds: Array<string>
  canLoadShares: boolean
  canRunShareMutations: boolean
  data: BlockShareProjectionData | undefined
  isMutating: boolean
  noteId: BlockShareTargetNote['id'] | undefined
  operations: BlocksShareOperations
  runShareCommand: RunBlocksShareCommand
}

type RunSidebarItemsShareCommand = (
  command: () => MaybePromise<ResourceCommandResult>,
  errorMessage: string,
) => Promise<ShareActionResult>

interface SidebarItemsShareRuntimeStateInput {
  canLoadShares: boolean
  canRunShareMutations: boolean
  isMutating: boolean
  itemShareData: Array<ResourceShareProjectionData>
  operations: ResourceShareOperations
  participants: Array<EditorShareParticipant>
  participantsLoaded: boolean
  runShareCommand: RunSidebarItemsShareCommand
  shareDataError?: unknown
  shareableItems: Array<AnyItem>
  shareDataLoaded: boolean
}

export function createBlocksShareRuntimeState(
  input: BlocksShareRuntimeStateInput,
): BlocksShareState {
  const projection = createBlocksShareProjection({
    noteBlockIds: input.noteBlockIds,
    data: input.data,
  })
  const status = input.canLoadShares ? projection.status : 'unavailable'

  return createBlocksShareState({
    noteBlockIds: input.noteBlockIds,
    canMutateShares: status === 'ready' && input.canRunShareMutations,
    isMutating: input.isMutating,
    noteId: input.noteId,
    operations: input.operations,
    projection,
    runShareCommand: input.runShareCommand,
    status,
  })
}

export function createResourceShareRuntimeState(
  input: SidebarItemsShareRuntimeStateInput,
): ResourceShareState {
  const projection = createResourceShareProjection({
    itemShareData: input.itemShareData,
    items: input.shareableItems,
    participants: input.participants,
    participantsLoaded: input.participantsLoaded,
    shareDataLoaded: input.shareDataLoaded,
  })
  const status = input.canLoadShares
    ? input.shareDataError
      ? 'failed'
      : projection.status
    : 'unavailable'

  return createResourceShareState({
    canMutateShares: status === 'ready' && input.canRunShareMutations,
    isMutating: input.isMutating,
    operations: input.operations,
    participants: input.participants,
    projection,
    runShareCommand: input.runShareCommand,
    shareableItems: input.shareableItems,
    status,
  })
}

type BlockShareProjectionBlock<MemberId extends CampaignMemberId> = NonNullable<
  BlockShareProjectionData<MemberId>['blocks']
>[number]

function createBlocksShareProjection<MemberId extends CampaignMemberId>({
  noteBlockIds,
  data,
}: {
  noteBlockIds: Array<string>
  data: BlockShareProjectionData<MemberId> | undefined
}): BlocksShareProjection<MemberId> {
  const blockInfoMap = createBlockInfoMap(data?.blocks)
  const selectedBlockInfos = noteBlockIds.flatMap((noteBlockId) => {
    const blockInfo = blockInfoMap.get(noteBlockId)
    return blockInfo ? [blockInfo] : []
  })
  const hasCompleteData =
    noteBlockIds.length > 0 && Boolean(data) && selectedBlockInfos.length === noteBlockIds.length

  return {
    status: getBlocksShareProjectionStatus({ data, hasCompleteData }),
    aggregateShareStatus: hasCompleteData
      ? getBlockAggregateShareStatus(selectedBlockInfos)
      : 'not_shared',
    defaultPermissionLevel: hasCompleteData
      ? aggregateBlockShareValues(
          selectedBlockInfos.map((info) => getBlockDefaultVisibility(info)),
          'hidden',
        )
      : 'hidden',
    shareItems: createBlockShareItems({
      blockInfos: selectedBlockInfos,
      notePermissionsByParticipantId: data?.notePermissionsByParticipantId ?? {},
      participants: data?.participants ?? [],
    }),
  }
}

function getBlocksShareProjectionStatus({
  data,
  hasCompleteData,
}: {
  data: BlockShareProjectionData<CampaignMemberId> | undefined
  hasCompleteData: boolean
}): BlocksShareProjection<CampaignMemberId>['status'] {
  if (!data) return 'loading'
  return hasCompleteData ? 'ready' : 'incomplete'
}

function getBlockDefaultVisibility(
  blockInfo: BlockShareProjectionBlock<CampaignMemberId> | undefined,
): Extract<BlockVisibilitySelectValue, 'hidden' | 'visible'> {
  return blockInfo?.shareStatus === SHARE_STATUS.ALL_SHARED ? 'visible' : 'hidden'
}

function getMemberBlockVisibility(
  blockInfo: BlockShareProjectionBlock<CampaignMemberId> | undefined,
  memberId: CampaignMemberId,
): BlockVisibilitySelectValue {
  const permissionLevel = getMemberPermissions(blockInfo)[memberId]
  if (permissionLevel === EDITOR_PERMISSION_LEVEL.NONE) return 'hidden'
  if (permissionLevel === EDITOR_PERMISSION_LEVEL.VIEW) return 'visible'
  return 'default'
}

function getBlockAggregateShareStatus(
  blockInfos: Array<BlockShareProjectionBlock<CampaignMemberId>>,
): BlocksShareState['aggregateShareStatus'] {
  const values = blockInfos.map((info) => getBlockDefaultVisibility(info))
  const aggregateValue = aggregateBlockShareValues(values, 'hidden')
  if (aggregateValue === 'visible') return 'all_shared'
  if (aggregateValue === 'hidden') {
    const hasMemberOverrides = blockInfos.some((info) =>
      Object.values(getMemberPermissions(info)).some((level) =>
        hasPermissionForRequirement(level, EDITOR_PERMISSION_LEVEL.VIEW),
      ),
    )
    return hasMemberOverrides ? 'individually_shared' : 'not_shared'
  }
  return 'mixed_shared'
}

function getMemberPermissions(
  blockInfo: BlockShareProjectionBlock<CampaignMemberId> | undefined,
): Partial<Record<string, Extract<EditorPermissionLevel, 'none' | 'view'>>> {
  return blockInfo?.memberPermissions ?? {}
}

function createBlockInfoMap<MemberId extends CampaignMemberId>(
  blockInfos: Array<BlockShareProjectionBlock<MemberId>> | undefined,
) {
  const map = new Map<string, BlockShareProjectionBlock<MemberId>>()
  for (const blockInfo of blockInfos ?? []) {
    map.set(blockInfo.noteBlockId, blockInfo)
  }
  return map
}

function createBlockShareItems<MemberId extends CampaignMemberId>({
  blockInfos,
  notePermissionsByParticipantId,
  participants,
}: {
  blockInfos: Array<BlockShareProjectionBlock<MemberId>>
  notePermissionsByParticipantId: Partial<Record<MemberId, EditorPermissionLevel>>
  participants: Array<EditorShareParticipant & { id: MemberId }>
}): BlocksShareProjection<MemberId>['shareItems'] {
  return participants.map((participant) => {
    const notePermissionLevel =
      notePermissionsByParticipantId[participant.id] ?? EDITOR_PERMISSION_LEVEL.NONE
    const isLockedVisible = hasPermissionForRequirement(
      notePermissionLevel,
      EDITOR_PERMISSION_LEVEL.EDIT,
    )

    if (isLockedVisible) {
      return {
        key: `block-share-${participant.id}`,
        participant,
        kind: 'locked_visible',
        permissionLevel: 'visible',
        hasExplicitShare: false,
      }
    }

    const memberValues = blockInfos.map((info) => getMemberBlockVisibility(info, participant.id))
    const hasExplicitShare = memberValues.some((value) => value !== 'default')
    return {
      key: `block-share-${participant.id}`,
      participant,
      kind: 'controllable',
      permissionLevel: aggregateBlockShareValues(memberValues, 'default'),
      hasExplicitShare,
    }
  })
}

function aggregateBlockShareValues<T extends string>(values: Array<T>, fallback: T) {
  if (values.length === 0) return fallback
  const [first] = values as [T, ...Array<T>]
  return values.every((value) => value === first) ? first : 'mixed'
}

function createBlocksShareState({
  noteBlockIds,
  canMutateShares,
  isMutating,
  noteId,
  operations,
  projection,
  runShareCommand,
  status,
}: {
  noteBlockIds: Array<string>
  canMutateShares: boolean
  isMutating: boolean
  noteId: BlockShareTargetNote['id'] | undefined
  operations: BlocksShareOperations
  projection: BlocksShareProjection
  runShareCommand: RunBlocksShareCommand
  status: BlocksShareState['status']
}): BlocksShareState {
  const baseState = {
    isMutating,
    aggregateShareStatus: projection.aggregateShareStatus,
    defaultPermissionLevel: projection.defaultPermissionLevel,
    shareItems: projection.shareItems,
  }

  if (status !== 'ready') {
    return { ...baseState, status }
  }

  if (!noteId) {
    throw new Error('Ready block sharing requires a note')
  }

  const runReadyShareCommand = async (
    command: () => ReturnType<BlocksShareOperations[keyof BlocksShareOperations]>,
    errorMessage: string,
  ) => {
    if (!canMutateShares) {
      return { status: 'blocked', reason: 'not_mutable' } satisfies ShareActionResult
    }
    return runShareCommand(command, errorMessage)
  }

  const setAllPlayersBlockPermission = (
    value: Parameters<Extract<BlocksShareState, { status: 'ready' }>['setDefaultPermission']>[0],
  ) =>
    runReadyShareCommand(
      () =>
        operations.setBlocksShareStatus({
          noteId,
          noteBlockIds,
          status: value === 'visible' ? SHARE_STATUS.ALL_SHARED : SHARE_STATUS.NOT_SHARED,
        }),
      'Failed to update share',
    )

  return {
    ...baseState,
    status,
    toggleShareStatus: () =>
      setAllPlayersBlockPermission(
        projection.aggregateShareStatus === 'not_shared' ? 'visible' : 'hidden',
      ),
    setDefaultPermission: setAllPlayersBlockPermission,
    setParticipantPermission: (participantId, value) =>
      runReadyShareCommand(
        () =>
          operations.setBlockParticipantPermission({
            noteId,
            noteBlockIds,
            participantId,
            permissionLevel: getBlockPermissionLevel(value),
          }),
        'Failed to update participant share',
      ),
  }
}

function getBlockPermissionLevel(
  value: Parameters<Extract<BlocksShareState, { status: 'ready' }>['setParticipantPermission']>[1],
): Extract<EditorPermissionLevel, 'none' | 'view'> | null {
  if (value === 'default') return null
  return value === 'visible' ? EDITOR_PERMISSION_LEVEL.VIEW : EDITOR_PERMISSION_LEVEL.NONE
}

interface SidebarItemShareInfo<ParticipantId extends CampaignMemberId> {
  itemId: AnyItem['id']
  allPermissionLevel: EditorPermissionLevel | null
  sharedParticipantIds: Set<ParticipantId>
  participantPermissions: Map<ParticipantId, EditorPermissionLevel>
  inheritedAllPermissionLevel: EditorPermissionLevel | null
  inheritedFromFolderName: string | null
  participantInheritedPermissions: Map<ParticipantId, EditorPermissionLevel>
  participantInheritedFromFolderNames: Map<ParticipantId, string>
}

function createResourceShareProjection<ParticipantId extends CampaignMemberId>({
  itemShareData,
  items,
  participants,
  participantsLoaded,
  shareDataLoaded,
}: {
  itemShareData: Array<ResourceShareProjectionData<ParticipantId>>
  items: Array<AnyItem>
  participants: Array<EditorShareParticipant & { id: ParticipantId }>
  participantsLoaded: boolean
  shareDataLoaded: boolean
}): ResourceShareProjection<ParticipantId> {
  const itemShareInfos = getItemShareInfos(items, itemShareData)
  const hasCompleteData =
    items.length > 0 &&
    participantsLoaded &&
    shareDataLoaded &&
    itemShareInfos.length === items.length
  const status = getResourceShareProjectionStatus({
    participantsLoaded,
    shareDataLoaded,
    hasCompleteData,
  })
  const aggregateShareStatus = getSidebarItemsAggregateShareStatus(itemShareInfos, hasCompleteData)
  const getShareState = createGetShareState(itemShareInfos, hasCompleteData)
  const singleItem = items.length === 1 ? items[0] : undefined
  const isFolderItem = singleItem?.type === RESOURCE_TYPES.folders && items.length === 1

  return {
    aggregateShareStatus,
    defaultPermissionLevel: hasCompleteData
      ? aggregateNullablePermissionValues(itemShareInfos.map((info) => info.allPermissionLevel))
      : null,
    getParticipantAccessSource: createGetParticipantAccessSource(itemShareInfos, hasCompleteData),
    getShareState,
    hasCompleteData,
    status,
    inheritShares:
      hasCompleteData && isFolderItem
        ? (itemShareData.find((shareData) => shareData.sidebarItemId === singleItem?.id)
            ?.inheritShares ?? false)
        : false,
    inheritedAllPermissionLevel: hasCompleteData
      ? aggregateNullablePermissionValues(
          itemShareInfos.map((info) => info.inheritedAllPermissionLevel),
        )
      : null,
    inheritedFromFolderName: hasCompleteData
      ? aggregateOptionalStrings(itemShareInfos.map((info) => info.inheritedFromFolderName))
      : null,
    isFolderItem,
    shareItems: hasCompleteData
      ? createSidebarItemShareItems(participants, itemShareInfos, getShareState)
      : [],
  }
}

function getResourceShareProjectionStatus({
  participantsLoaded,
  shareDataLoaded,
  hasCompleteData,
}: {
  participantsLoaded: boolean
  shareDataLoaded: boolean
  hasCompleteData: boolean
}): ResourceShareProjection<CampaignMemberId>['status'] {
  if (!participantsLoaded || !shareDataLoaded) return 'loading'
  return hasCompleteData ? 'ready' : 'incomplete'
}

function getItemShareInfos<ParticipantId extends CampaignMemberId>(
  items: Array<AnyItem>,
  itemShareData: Array<ResourceShareProjectionData<ParticipantId>>,
) {
  const itemShareInfoMap = new Map(
    itemShareData.map((shareData) => [shareData.sidebarItemId, toSidebarItemShareInfo(shareData)]),
  )
  return items
    .map((item) => itemShareInfoMap.get(item.id))
    .filter((info): info is SidebarItemShareInfo<ParticipantId> => Boolean(info))
}

function toSidebarItemShareInfo<ParticipantId extends CampaignMemberId>(
  itemShareData: ResourceShareProjectionData<ParticipantId>,
): SidebarItemShareInfo<ParticipantId> {
  const sharedParticipantIds = new Set<ParticipantId>()
  const participantPermissions = new Map<ParticipantId, EditorPermissionLevel>()
  for (const share of itemShareData.shares) {
    sharedParticipantIds.add(share.participantId)
    participantPermissions.set(
      share.participantId,
      share.permissionLevel ?? EDITOR_PERMISSION_LEVEL.VIEW,
    )
  }

  return {
    itemId: itemShareData.sidebarItemId,
    allPermissionLevel: itemShareData.allPermissionLevel,
    sharedParticipantIds,
    participantPermissions,
    inheritedAllPermissionLevel: itemShareData.inheritedAllPermissionLevel,
    inheritedFromFolderName: itemShareData.inheritedFromFolderName,
    participantInheritedPermissions: new Map(
      Object.entries(itemShareData.memberInheritedPermissions),
    ) as Map<ParticipantId, EditorPermissionLevel>,
    participantInheritedFromFolderNames: new Map(
      Object.entries(itemShareData.memberInheritedFromFolderNames),
    ) as Map<ParticipantId, string>,
  }
}

function getSidebarItemsAggregateShareStatus<ParticipantId extends CampaignMemberId>(
  itemShareInfos: Array<SidebarItemShareInfo<ParticipantId>>,
  hasCompleteData: boolean,
): AggregateShareStatus | null {
  if (!hasCompleteData) return null
  const shareAccessByItem = itemShareInfos.map(hasAnyShareAccess)
  if (shareAccessByItem.every((hasAccess) => !hasAccess)) return 'not_shared'
  if (
    itemShareInfos.every((info) =>
      hasPermissionAccess(info.allPermissionLevel ?? info.inheritedAllPermissionLevel),
    )
  ) {
    return 'all_shared'
  }
  return shareAccessByItem.every(Boolean) ? 'individually_shared' : 'mixed_shared'
}

function hasPermissionAccess(level: EditorPermissionLevel | null | undefined): boolean {
  return level !== null && level !== undefined && level !== EDITOR_PERMISSION_LEVEL.NONE
}

function hasAnyShareAccess<ParticipantId extends CampaignMemberId>(
  info: SidebarItemShareInfo<ParticipantId>,
) {
  const hasExplicitMemberShares = Array.from(info.participantPermissions.values()).some(
    hasPermissionAccess,
  )
  const hasInheritedMemberShares = Array.from(info.participantInheritedPermissions.values()).some(
    hasPermissionAccess,
  )
  return (
    hasExplicitMemberShares ||
    hasInheritedMemberShares ||
    hasPermissionAccess(info.allPermissionLevel ?? info.inheritedAllPermissionLevel)
  )
}

function createGetShareState<ParticipantId extends CampaignMemberId>(
  itemShareInfos: Array<SidebarItemShareInfo<ParticipantId>>,
  hasCompleteData: boolean,
) {
  return (participantId: ParticipantId): ShareState => {
    if (!hasCompleteData) return 'none'
    const sharedCount = itemShareInfos.filter((info) =>
      hasMemberShareAccess(info, participantId),
    ).length
    if (sharedCount === 0) return 'none'
    return sharedCount === itemShareInfos.length ? 'all' : 'some'
  }
}

function createGetParticipantAccessSource<ParticipantId extends CampaignMemberId>(
  itemShareInfos: Array<SidebarItemShareInfo<ParticipantId>>,
  hasCompleteData: boolean,
) {
  return (participantId: ParticipantId): 'explicit' | 'default' | 'none' => {
    if (!hasCompleteData) return 'none'
    let hasExplicitAccess = false
    let hasDefaultAccess = false
    for (const info of itemShareInfos) {
      const explicitPermission = getExplicitMemberPermission(info, participantId)
      if (hasPermissionAccess(explicitPermission)) {
        hasExplicitAccess = true
      }
      if (hasPermissionAccess(getDefaultMemberPermission(info, participantId))) {
        hasDefaultAccess = true
      }
    }
    if (hasDefaultAccess) return 'default'
    if (hasExplicitAccess) return 'explicit'
    return 'none'
  }
}

function hasMemberShareAccess<ParticipantId extends CampaignMemberId>(
  info: SidebarItemShareInfo<ParticipantId>,
  participantId: ParticipantId,
) {
  const explicitPermission = getExplicitMemberPermission(info, participantId)
  if (explicitPermission !== null) return hasPermissionAccess(explicitPermission)
  return hasPermissionAccess(getDefaultMemberPermission(info, participantId))
}

function getExplicitMemberPermission<ParticipantId extends CampaignMemberId>(
  info: SidebarItemShareInfo<ParticipantId>,
  participantId: ParticipantId,
): EditorPermissionLevel | null {
  if (!info.sharedParticipantIds.has(participantId)) return null
  return info.participantPermissions.get(participantId) ?? EDITOR_PERMISSION_LEVEL.VIEW
}

function createSidebarItemShareItems<ParticipantId extends CampaignMemberId>(
  participants: Array<EditorShareParticipant & { id: ParticipantId }>,
  itemShareInfos: Array<SidebarItemShareInfo<ParticipantId>>,
  getShareState: (participantId: ParticipantId) => ShareState,
): Array<
  ShareItemWithPermission & { participant: EditorShareParticipant & { id: ParticipantId } }
> {
  return participants.map((participant) =>
    createShareItem(participant, itemShareInfos, getShareState),
  )
}

function createShareItem<ParticipantId extends CampaignMemberId>(
  participant: EditorShareParticipant & { id: ParticipantId },
  itemShareInfos: Array<SidebarItemShareInfo<ParticipantId>>,
  getShareState: (participantId: ParticipantId) => ShareState,
): ShareItemWithPermission & { participant: EditorShareParticipant & { id: ParticipantId } } {
  const explicitPermissions = itemShareInfos.map((info) =>
    getExplicitMemberPermission(info, participant.id),
  )
  const hasExplicitShare = explicitPermissions.some((level) => level !== null)
  const inheritedPermissionLevel = aggregatePermissionValues(
    itemShareInfos.map((info) => getDefaultMemberPermission(info, participant.id)),
  )
  const permissionLevel = hasExplicitShare
    ? aggregateNullablePermissionValues(explicitPermissions)
    : inheritedPermissionLevel

  return {
    key: `share-${participant.id}`,
    participant,
    shareState: getShareState(participant.id),
    permissionLevel: permissionLevel ?? EDITOR_PERMISSION_LEVEL.NONE,
    hasExplicitShare,
    inheritedPermissionLevel,
    inheritedFromFolderName:
      aggregateOptionalStrings(
        itemShareInfos.map((info) => info.participantInheritedFromFolderNames.get(participant.id)),
      ) ?? undefined,
  }
}

function getDefaultMemberPermission<ParticipantId extends CampaignMemberId>(
  info: SidebarItemShareInfo<ParticipantId>,
  participantId: ParticipantId,
): EditorPermissionLevel {
  if (info.allPermissionLevel !== null) return info.allPermissionLevel
  return (
    info.participantInheritedPermissions.get(participantId) ??
    info.inheritedAllPermissionLevel ??
    EDITOR_PERMISSION_LEVEL.NONE
  )
}

function aggregatePermissionValues(
  values: Array<EditorPermissionLevel>,
  fallback: EditorPermissionLevel = EDITOR_PERMISSION_LEVEL.NONE,
): AggregatePermissionLevel {
  if (values.length === 0) return fallback
  const first = values[0]
  return values.every((value) => value === first) ? first : 'mixed'
}

function aggregateNullablePermissionValues(
  values: Array<EditorPermissionLevel | null>,
): NullableAggregatePermissionLevel {
  if (values.length === 0) return null
  const first = values[0]
  return values.every((value) => value === first) ? first : 'mixed'
}

function aggregateOptionalStrings(values: Array<string | null | undefined>): string | null {
  if (values.length === 0) return null
  const first = values[0]
  return first && values.every((value) => value === first) ? first : null
}

function createResourceShareState({
  canMutateShares,
  isMutating,
  operations,
  participants,
  projection,
  runShareCommand,
  shareableItems,
  status,
}: {
  canMutateShares: boolean
  isMutating: boolean
  operations: ResourceShareOperations
  participants: Array<EditorShareParticipant>
  projection: ResourceShareProjection<EditorShareParticipant['id']>
  runShareCommand: RunSidebarItemsShareCommand
  shareableItems: Array<AnyItem>
  status: ResourceShareState['status']
}): ResourceShareState {
  const itemIds = shareableItems.map((item) => item.id)
  const singleItem = shareableItems.length === 1 ? shareableItems[0] : undefined

  const baseState = {
    isMutating,
    aggregateShareStatus: projection.aggregateShareStatus,
    defaultPermissionLevel: projection.defaultPermissionLevel,
    inheritedAllPermissionLevel: projection.inheritedAllPermissionLevel,
    inheritedFromFolderName: projection.inheritedFromFolderName,
    isFolderItem: projection.isFolderItem,
    inheritShares: projection.inheritShares,
    shareableItems,
    participants,
    shareItems: projection.shareItems,
  }

  if (status !== 'ready') return { ...baseState, status }

  return {
    ...baseState,
    status,
    toggleShareStatus: () =>
      toggleSidebarItemsShareStatus({
        aggregateShareStatus: projection.aggregateShareStatus,
        canMutateShares,
        itemIds,
        operations,
        runShareCommand,
      }),
    toggleShareWithParticipant: (participantId) =>
      toggleSidebarItemsShareWithParticipant({
        canMutateShares,
        getParticipantAccessSource: projection.getParticipantAccessSource,
        getShareState: projection.getShareState,
        itemIds,
        participantId,
        operations,
        runShareCommand,
      }),
    setParticipantPermission: (participantId, level) =>
      setSidebarItemsParticipantPermission({
        canMutateShares,
        itemIds,
        level,
        participantId,
        operations,
        runShareCommand,
      }),
    clearParticipantPermission: (participantId) =>
      clearSidebarItemsParticipantPermission({
        canMutateShares,
        itemIds,
        participantId,
        operations,
        runShareCommand,
      }),
    setDefaultPermission: (level) =>
      setSidebarItemsDefaultPermission({
        canMutateShares,
        itemIds,
        level,
        operations,
        runShareCommand,
      }),
    setInheritShares: (enabled) =>
      setSidebarItemsInheritShares({
        canMutateShares,
        enabled,
        isFolderItem: projection.isFolderItem,
        operations,
        runShareCommand,
        singleItem,
      }),
  }
}

async function toggleSidebarItemsShareStatus({
  aggregateShareStatus,
  canMutateShares,
  itemIds,
  operations,
  runShareCommand,
}: {
  aggregateShareStatus: ResourceShareState['aggregateShareStatus']
  canMutateShares: boolean
  itemIds: Array<AnyItem['id']>
  operations: ResourceShareOperations
  runShareCommand: RunSidebarItemsShareCommand
}) {
  if (aggregateShareStatus === null) return blockedShareAction('incomplete')
  if (!canMutateShares) return blockedShareAction('not_mutable')
  const permissionLevel =
    aggregateShareStatus === 'not_shared'
      ? EDITOR_PERMISSION_LEVEL.VIEW
      : EDITOR_PERMISSION_LEVEL.NONE
  return runShareCommand(
    () => operations.setDefaultPermission({ itemIds, permissionLevel }),
    'Failed to update share',
  )
}

async function toggleSidebarItemsShareWithParticipant<ParticipantId extends CampaignMemberId>({
  canMutateShares,
  getParticipantAccessSource,
  getShareState,
  itemIds,
  participantId,
  operations,
  runShareCommand,
}: {
  canMutateShares: boolean
  getParticipantAccessSource: (participantId: ParticipantId) => 'explicit' | 'default' | 'none'
  getShareState: (participantId: ParticipantId) => ShareState
  itemIds: Array<AnyItem['id']>
  participantId: ParticipantId
  operations: ResourceShareOperations
  runShareCommand: RunSidebarItemsShareCommand
}) {
  if (!canMutateShares) return blockedShareAction('not_mutable')
  if (getShareState(participantId) === 'all') {
    if (getParticipantAccessSource(participantId) === 'default') {
      return setSidebarItemsParticipantPermission({
        canMutateShares,
        itemIds,
        level: EDITOR_PERMISSION_LEVEL.NONE,
        participantId,
        operations,
        runShareCommand,
      })
    }
    return clearSidebarItemsParticipantPermission({
      canMutateShares,
      itemIds,
      participantId,
      operations,
      runShareCommand,
    })
  }
  return setSidebarItemsParticipantPermission({
    canMutateShares,
    itemIds,
    level: EDITOR_PERMISSION_LEVEL.VIEW,
    participantId,
    operations,
    runShareCommand,
  })
}

async function setSidebarItemsInheritShares({
  canMutateShares,
  enabled,
  isFolderItem,
  operations,
  runShareCommand,
  singleItem,
}: {
  canMutateShares: boolean
  enabled: boolean
  isFolderItem: boolean
  operations: ResourceShareOperations
  runShareCommand: RunSidebarItemsShareCommand
  singleItem: AnyItem | undefined
}) {
  if (!singleItem || !isFolderItem) return blockedShareAction('not_folder')
  if (!canMutateShares) return blockedShareAction('not_mutable')
  return runShareCommand(
    () => operations.setFolderInheritShares({ folderId: singleItem.id, inheritShares: enabled }),
    'Failed to update share',
  )
}

async function setSidebarItemsParticipantPermission({
  canMutateShares,
  itemIds,
  level,
  participantId,
  operations,
  runShareCommand,
}: {
  canMutateShares: boolean
  itemIds: Array<AnyItem['id']>
  level: EditorPermissionLevel
  participantId: EditorShareParticipant['id']
  operations: ResourceShareOperations
  runShareCommand: RunSidebarItemsShareCommand
}) {
  if (!canMutateShares) return blockedShareAction('not_mutable')
  return runShareCommand(
    () =>
      operations.setParticipantPermission({
        itemIds,
        participantId,
        permissionLevel: level,
      }),
    'Failed to update share',
  )
}

async function setSidebarItemsDefaultPermission({
  canMutateShares,
  itemIds,
  level,
  operations,
  runShareCommand,
}: {
  canMutateShares: boolean
  itemIds: Array<AnyItem['id']>
  level: EditorPermissionLevel | null
  operations: ResourceShareOperations
  runShareCommand: RunSidebarItemsShareCommand
}) {
  if (!canMutateShares) return blockedShareAction('not_mutable')
  return runShareCommand(
    () => operations.setDefaultPermission({ itemIds, permissionLevel: level }),
    'Failed to update share',
  )
}

async function clearSidebarItemsParticipantPermission({
  canMutateShares,
  itemIds,
  participantId,
  operations,
  runShareCommand,
}: {
  canMutateShares: boolean
  itemIds: Array<AnyItem['id']>
  participantId: EditorShareParticipant['id']
  operations: ResourceShareOperations
  runShareCommand: RunSidebarItemsShareCommand
}) {
  if (!canMutateShares) return blockedShareAction('not_mutable')
  return runShareCommand(
    () => operations.clearParticipantPermission({ itemIds, participantId }),
    'Failed to update share',
  )
}

function blockedShareAction(reason: ShareActionBlockedReason): ShareActionResult {
  return { status: 'blocked', reason }
}
