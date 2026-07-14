import { executeTestFileSystemCommand } from './filesystemCommand.helper'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../shared/campaigns/types'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  NoteBlockId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { deterministicUuidV7 } from '../../shared/test/deterministic-uuid-v7'
import { testCampaignMemberId } from '../../shared/test/campaign-member-id'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import type {
  ResourceColor,
  ResourceIconName,
  ResourceLocation,
  ResourceStatus,
  ResourceKind,
} from '@wizard-archive/editor/resources/resource-contract'
import type { ResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { normalizeLegacyResourcePathSegment } from '../sidebarItems/resourcePathSegment'
import { requireSidebarItemRow } from '../sidebarItems/functions/sidebarItemIdentity'

import { SHARE_STATUS } from '../../shared/block-shares/share-status'
import { assertCampaignSlug } from '../campaigns/validation'
import { assertConvexResourceTitle } from '../sidebarItems/validation/name'
import { assertSidebarItemLifecycleConsistency } from '../sidebarItems/types/status'
import { assertUsername } from '../users/validation'
import { makeYjsUpdateWithBlocks } from './yjs.helper'
import type { TestConvex, TestConvexForDataModel } from 'convex-test'
import type { DataModel, Id } from '../_generated/dataModel'
import type schema from '../schema'
import type { PermissionLevel } from '../../shared/permissions/types'
import type { ShareStatus } from '../../shared/block-shares/share-status'
import type {
  NoteBlockType,
  NoteBlock,
  PartialNoteBlock,
  InlineContent,
  TableContent,
} from '@wizard-archive/editor/notes/document-contract'
import type { BlockInsert } from '../blocks/types'
import type {
  ResourceEvent,
  ResourceTransactionReceipt,
} from '@wizard-archive/editor/resources/transaction-contract'
type T = TestConvex<typeof schema>

export async function getCampaignRowId(t: T, campaignId: CampaignId) {
  const campaign = await t.run(async (ctx) => {
    return await ctx.db
      .query('campaigns')
      .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
      .unique()
  })
  if (!campaign) throw new Error('Campaign not found')
  return campaign._id
}

export async function getSidebarItemRowId(t: T, resourceId: ResourceId) {
  return await t.run(async (ctx) => (await requireSidebarItemRow(ctx, resourceId))._id)
}
type AuthedContext = TestConvexForDataModel<DataModel>
type BlockProps = NoteBlock['props']
type FileSystemEventType = ResourceEvent['type']

export async function executeMoveCommand(
  client: AuthedContext,
  args: {
    campaignId: CampaignId
    sourceItemIds: Array<ResourceId>
    targetParentId: ResourceId | null
    action?: 'move' | 'restore' | 'trash'
  },
): Promise<ResourceTransactionReceipt> {
  const action = args.action ?? 'move'
  const command =
    action === 'trash'
      ? ({
          type: 'trash',
          itemIds: args.sourceItemIds,
        } as const)
      : ({
          type: action,
          itemIds: args.sourceItemIds,
          targetParentId: args.targetParentId,
        } as const)
  return await executeTestFileSystemCommand(client, {
    campaignId: args.campaignId,
    command,
  })
}

export async function executeCopyCommand(
  client: AuthedContext,
  args: {
    campaignId: CampaignId
    sourceItemIds: Array<ResourceId>
    targetParentId: ResourceId | null
  },
): Promise<ResourceTransactionReceipt> {
  return await executeTestFileSystemCommand(client, {
    campaignId: args.campaignId,
    command: {
      type: 'copy',
      itemIds: args.sourceItemIds,
      targetParentId: args.targetParentId,
    },
  })
}

export async function executeDeleteForeverCommand(
  client: AuthedContext,
  args: {
    campaignId: CampaignId
    sourceItemIds: Array<ResourceId>
  },
): Promise<ResourceTransactionReceipt> {
  return await executeTestFileSystemCommand(client, {
    campaignId: args.campaignId,
    command: {
      type: 'deleteForever',
      itemIds: args.sourceItemIds,
    },
  })
}

export async function executeEmptyTrashCommand(
  client: AuthedContext,
  args: {
    campaignId: CampaignId
  },
): Promise<ResourceTransactionReceipt> {
  return await executeTestFileSystemCommand(client, {
    campaignId: args.campaignId,
    command: { type: 'emptyTrash' },
  })
}

export function filesystemEventItemIds(
  receipt: Pick<ResourceTransactionReceipt, 'events'>,
  type: FileSystemEventType,
) {
  return receipt.events.filter((event) => event.type === type).map((event) => event.itemId)
}

export function copiedRootItemIds(receipt: Pick<ResourceTransactionReceipt, 'events'>) {
  return receipt.events
    .filter((event): event is Extract<ResourceEvent, { type: 'copied' }> => event.type === 'copied')
    .map((event) => event.itemId)
}

export function testBlock(
  id: string,
  overrides?: Partial<Omit<NoteBlock, 'id' | 'children'>> & {
    children?: Array<NoteBlock>
  },
): NoteBlock {
  return {
    id: testBlockNoteId(id),
    type: 'paragraph',
    props: {},
    content: [],
    ...overrides,
  } as NoteBlock
}

let counter = 0

function nextId() {
  return ++counter
}

export function testBlockNoteId(label: string): NoteBlockId {
  return deterministicUuidV7(label) as NoteBlockId
}

const commonFields = (creatorId: Id<'userProfiles'>) => ({
  updatedTime: null,
  updatedBy: null,
  createdBy: testCampaignMemberId(String(creatorId)),
  deletionTime: null,
  deletedBy: null,
})

export async function createUserProfile(
  t: T,
  overrides?: Partial<{
    authUserId: string
    username: string
    email: string | null
    emailVerified: boolean | null
    name: string | null
    profileImage:
      | { type: 'external'; url: string }
      | { type: 'storage'; storageId: Id<'_storage'> }
      | null
    twoFactorEnabled: boolean | null
  }>,
) {
  const n = nextId()
  const { username, ...rest } = overrides ?? {}
  const defaults = {
    userProfileUuid: generateDomainId(DOMAIN_ID_KIND.userProfile),
    authUserId: `auth-user-${n}`,
    username: assertUsername(`user-${n}`),
    email: `user-${n}@test.com`,
    emailVerified: null,
    name: `Test User ${n}`,
    profileImage: null,
    twoFactorEnabled: null,
  }
  const data = {
    ...defaults,
    ...rest,
    ...(username !== undefined ? { username: assertUsername(username) } : {}),
  }
  const rowId = await t.run(async (ctx) => {
    return await ctx.db.insert('userProfiles', data)
  })
  return { _id: rowId, ...data }
}

export async function createCampaignWithDm(
  t: T,
  dmProfile: { _id: Id<'userProfiles'> },
  overrides?: Partial<{
    name: string
    description: string
    slug: string
    status: 'Active' | 'Inactive'
    currentSessionId: Id<'sessions'> | null
    defaultFolderInheritShares: boolean
  }>,
) {
  const n = nextId()
  const { slug, ...rest } = overrides ?? {}
  const defaults = {
    campaignUuid: generateDomainId(DOMAIN_ID_KIND.campaign),
    name: `Campaign ${n}`,
    description: '',
    dmUserId: dmProfile._id,
    slug: assertCampaignSlug(`campaign-${n}`),
    status: 'Active' as const,
    currentSessionId: null,
    defaultFolderInheritShares: false,
  }
  const campaignData = {
    ...defaults,
    ...rest,
    dmUserId: dmProfile._id,
    ...(slug !== undefined ? { slug: assertCampaignSlug(slug) } : {}),
  }
  const campaignId = await t.run(async (ctx) => {
    return await ctx.db.insert('campaigns', campaignData)
  })

  const dmMemberDomainId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
  const memberId = await t.run(async (ctx) => {
    return await ctx.db.insert('campaignMembers', {
      campaignMemberUuid: dmMemberDomainId,
      userId: dmProfile._id,
      campaignId,
      role: CAMPAIGN_MEMBER_ROLE.DM,
      status: CAMPAIGN_MEMBER_STATUS.Accepted,
    })
  })

  return {
    campaignId,
    campaignDomainId: campaignData.campaignUuid,
    dmMemberId: memberId,
    dmMemberDomainId,
  }
}

export async function addPlayerToCampaign(
  t: T,
  campaignId: Id<'campaigns'>,
  playerProfile: { _id: Id<'userProfiles'> },
  overrides?: Partial<{
    status: 'Pending' | 'Accepted' | 'Rejected' | 'Removed'
  }>,
) {
  const defaults = {
    campaignMemberUuid: generateDomainId(DOMAIN_ID_KIND.campaignMember),
    userId: playerProfile._id,
    campaignId,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
  }
  const data = { ...defaults, ...overrides }
  const memberId = await t.run(async (ctx) => {
    return await ctx.db.insert('campaignMembers', data)
  })
  return { memberId, memberDomainId: data.campaignMemberUuid, ...data }
}

const sidebarItemBase = (
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  name: ResourceTitle,
): {
  resourceUuid: ResourceId
  name: ResourceTitle
  normalizedName: string
  campaignId: Id<'campaigns'>
  iconName: null
  color: null
  parentId: null
  allPermissionLevel: PermissionLevel | null
  location: ResourceLocation
  status: ResourceStatus
  previewStorageId: null
  previewUpdatedAt: null
} & ReturnType<typeof commonFields> => ({
  resourceUuid: generateDomainId(DOMAIN_ID_KIND.resource),
  name,
  normalizedName: normalizeLegacyResourcePathSegment(name),
  campaignId,
  iconName: null,
  color: null,
  parentId: null,
  allPermissionLevel: null,
  location: RESOURCE_LOCATION.sidebar,
  status: RESOURCE_STATUS.active,
  previewStorageId: null,
  previewUpdatedAt: null,
  ...commonFields(creatorProfileId),
})

type CommonSidebarItemOverrides = Partial<{
  resourceUuid: ResourceId
  name: string
  parentId: ResourceId | null
  allPermissionLevel: PermissionLevel | null
  location: ResourceLocation
  status: ResourceStatus
  iconName: ResourceIconName | null
  color: ResourceColor | null
  deletionTime: number | null
  deletedBy: CampaignMemberId | null
  previewStorageId: Id<'_storage'> | null
  previewUpdatedAt: number | null
}>

type ExtensionTable = 'notes' | 'folders' | 'gameMaps' | 'files' | 'canvases'

async function insertResource(
  t: T,
  extensionTable: ExtensionTable,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  label: string,
  type: ResourceKind,
  extraDefaults: Record<string, unknown>,
  overrides?: CommonSidebarItemOverrides & Record<string, unknown>,
) {
  const n = nextId()
  const name = assertConvexResourceTitle(overrides?.name ?? `${label} ${n}`)

  const {
    inheritShares,
    imageStorageId,
    storageId,
    name: _name,
    parentId: parentResourceId,
    ...sidebarOverrides
  } = overrides ?? {}
  const requestedStatus =
    sidebarOverrides.status ??
    (sidebarOverrides.deletionTime !== undefined && sidebarOverrides.deletionTime !== null
      ? RESOURCE_STATUS.trashed
      : RESOURCE_STATUS.active)

  const extensionFields: Record<string, unknown> = {}
  if (inheritShares !== undefined) extensionFields.inheritShares = inheritShares
  if (imageStorageId !== undefined) extensionFields.imageStorageId = imageStorageId
  if (storageId !== undefined) extensionFields.storageId = storageId

  const extensionDefaults: Record<string, unknown> = { ...extraDefaults }

  return await t.run(async (ctx) => {
    const parent =
      parentResourceId === undefined || parentResourceId === null
        ? null
        : await requireSidebarItemRow(ctx, parentResourceId)
    const sharedData = {
      ...sidebarItemBase(campaignId, creatorProfileId, name),
      type,
      ...sidebarOverrides,
      parentId: parent?._id ?? null,
      location: sidebarOverrides.location ?? RESOURCE_LOCATION.sidebar,
      status: requestedStatus,
    }
    assertSidebarItemLifecycleConsistency(sharedData)
    const itemId = await ctx.db.insert('sidebarItems', sharedData)
    await ctx.db.insert(extensionTable, {
      sidebarItemId: itemId,
      ...extensionDefaults,
      ...extensionFields,
    })
    return {
      rowId: itemId,
      ...sharedData,
      parentId: parentResourceId ?? null,
      ...extensionDefaults,
      ...extensionFields,
    }
  })
}

export async function createNote(
  t: T,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  overrides?: CommonSidebarItemOverrides,
) {
  const { rowId: noteRowId, ...data } = await insertResource(
    t,
    'notes',
    campaignId,
    creatorProfileId,
    'Note',
    RESOURCE_TYPES.notes,
    {},
    overrides,
  )
  return { noteId: data.resourceUuid, noteRowId, ...data }
}

export async function createFolder(
  t: T,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  overrides?: CommonSidebarItemOverrides & Partial<{ inheritShares: boolean }>,
) {
  const { rowId: folderRowId, ...data } = await insertResource(
    t,
    'folders',
    campaignId,
    creatorProfileId,
    'Folder',
    RESOURCE_TYPES.folders,
    { inheritShares: false },
    overrides,
  )
  return { folderId: data.resourceUuid, folderRowId, ...data }
}

export async function createFile(
  t: T,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  overrides?: CommonSidebarItemOverrides & Partial<{ storageId: Id<'_storage'> | null }>,
) {
  const { rowId: fileRowId, ...data } = await insertResource(
    t,
    'files',
    campaignId,
    creatorProfileId,
    'File',
    RESOURCE_TYPES.files,
    { storageId: null },
    overrides,
  )
  return { fileId: data.resourceUuid, fileRowId, ...data }
}

export async function createGameMap(
  t: T,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  overrides?: CommonSidebarItemOverrides & Partial<{ imageStorageId: Id<'_storage'> | null }>,
) {
  const { rowId: mapRowId, ...data } = await insertResource(
    t,
    'gameMaps',
    campaignId,
    creatorProfileId,
    'Map',
    RESOURCE_TYPES.gameMaps,
    { imageStorageId: null },
    overrides,
  )
  return { mapId: data.resourceUuid, mapRowId, ...data }
}

export async function createCanvas(
  t: T,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  overrides?: CommonSidebarItemOverrides,
) {
  const { rowId: canvasRowId, ...data } = await insertResource(
    t,
    'canvases',
    campaignId,
    creatorProfileId,
    'Canvas',
    RESOURCE_TYPES.canvases,
    {},
    overrides,
  )
  return { canvasId: data.resourceUuid, canvasRowId, ...data }
}

export async function createSession(
  t: T,
  campaignId: Id<'campaigns'>,
  overrides?: Partial<{
    name: string | null
    startedAt: number
    endedAt: number | null
  }>,
) {
  const defaults = {
    sessionUuid: generateDomainId(DOMAIN_ID_KIND.session),
    campaignId,
    name: null,
    startedAt: Date.now(),
    endedAt: null,
  }
  const data = { ...defaults, ...overrides }
  const sessionId = await t.run(async (ctx) => {
    return await ctx.db.insert('sessions', data)
  })
  return { sessionId, ...data }
}

export async function createBlock(
  t: T,
  noteId: ResourceId,
  campaignId: Id<'campaigns'>,
  overrides?: Partial<{
    blockNoteId: NoteBlockId
    position: number | null
    parentBlockId: NoteBlockId | null
    depth: number
    type: NoteBlockType
    props: BlockProps
    content: InlineContent | TableContent | null
    plainText: string
    shareStatus: ShareStatus | null
  }>,
) {
  const n = nextId()
  const shareStatus: ShareStatus | null = SHARE_STATUS.NOT_SHARED
  const type = overrides?.type ?? 'paragraph'
  const defaults = {
    blockNoteId: testBlockNoteId(`block-${n}`),
    position: null,
    parentBlockId: null,
    depth: 0,
    type,
    props: type === 'heading' ? { level: 1 } : {},
    content: null,
    plainText: '',
    campaignId,
    shareStatus,
  }
  if (
    overrides?.parentBlockId !== undefined &&
    overrides.parentBlockId !== null &&
    overrides.depth === undefined
  ) {
    throw new Error('createBlock: depth must be explicitly provided when parentBlockId is set')
  }
  return await t.run(async (ctx) => {
    const note = await requireSidebarItemRow(ctx, noteId)
    const data = { ...defaults, noteId: note._id, ...overrides } as BlockInsert
    const blockDbId = await ctx.db.insert('blocks', data)
    return { blockDbId, ...data, noteId, noteRowId: note._id }
  })
}

export async function createSidebarShare(
  t: T,
  overrides: {
    campaignId: Id<'campaigns'>
    sidebarItemId: ResourceId
    sidebarItemType: ResourceKind
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel?: PermissionLevel | null
    sessionId?: Id<'sessions'> | null
  },
) {
  const permissionLevel: PermissionLevel | null = 'view'
  const sessionId: Id<'sessions'> | null = null
  const defaults = {
    permissionLevel,
    sessionId,
  }
  const resourceShareUuid = generateDomainId(DOMAIN_ID_KIND.resourceShare)
  return await t.run(async (ctx) => {
    const item = await requireSidebarItemRow(ctx, overrides.sidebarItemId)
    const data = { ...defaults, ...overrides, sidebarItemId: item._id }
    const shareId = await ctx.db.insert('sidebarItemShares', { ...data, resourceShareUuid })
    return {
      shareId,
      resourceShareUuid,
      ...data,
      sidebarItemId: overrides.sidebarItemId,
      sidebarItemRowId: item._id,
    }
  })
}

export async function createBlockShare(
  t: T,
  overrides: {
    campaignId: Id<'campaigns'>
    noteId: ResourceId
    blockId: Id<'blocks'>
    campaignMemberId: Id<'campaignMembers'>
    sessionId?: Id<'sessions'> | null
    permissionLevel?: 'none' | 'view'
  },
) {
  const sessionId: Id<'sessions'> | null = null
  const defaults = {
    permissionLevel: 'view' as const,
    sessionId,
  }
  return await t.run(async (ctx) => {
    const note = await requireSidebarItemRow(ctx, overrides.noteId)
    const data = { ...defaults, ...overrides, noteId: note._id }
    const blockShareId = await ctx.db.insert('blockShares', data)
    return {
      blockShareId,
      ...data,
      noteId: overrides.noteId,
      noteRowId: note._id,
    }
  })
}

export async function createBookmark(
  t: T,
  overrides: {
    campaignId: Id<'campaigns'>
    sidebarItemId: ResourceId
    campaignMemberId: Id<'campaignMembers'>
  },
) {
  return await t.run(async (ctx) => {
    const item = await requireSidebarItemRow(ctx, overrides.sidebarItemId)
    const bookmarkId = await ctx.db.insert('bookmarks', {
      ...overrides,
      sidebarItemId: item._id,
    })
    return { bookmarkId, ...overrides, sidebarItemRowId: item._id }
  })
}

export async function createMapPin(
  t: T,
  mapId: ResourceId,
  overrides: {
    itemId: ResourceId
    x?: number
    y?: number
    visible?: boolean
  },
) {
  const defaults = {
    x: 0,
    y: 0,
    visible: true,
  }
  const mapPinId = generateDomainId(DOMAIN_ID_KIND.mapPin)
  return await t.run(async (ctx) => {
    const [map, item] = await Promise.all([
      requireSidebarItemRow(ctx, mapId),
      requireSidebarItemRow(ctx, overrides.itemId),
    ])
    const data = { ...defaults, mapId: map._id, ...overrides, itemId: item._id }
    const pinId = await ctx.db.insert('mapPins', { ...data, mapPinUuid: mapPinId })
    return {
      pinId,
      mapPinId,
      ...data,
      mapId,
      mapRowId: map._id,
      itemId: overrides.itemId,
      itemRowId: item._id,
    }
  })
}

export async function setupFolderTree(
  t: T,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  opts: {
    depth: number
    inheritShares?: Array<boolean>
    leafType?: 'note' | 'file' | 'gameMap'
  },
) {
  const { depth, inheritShares = [], leafType = 'note' } = opts
  const folders: Array<ResourceId> = []
  const folderRowIds: Array<Id<'sidebarItems'>> = []

  for (let i = 0; i < depth; i++) {
    const parentId = i === 0 ? null : folders[i - 1]!
    const inherit = inheritShares[i] ?? false
    const { folderId, folderRowId } = await createFolder(t, campaignId, creatorProfileId, {
      name: `Folder-L${i}`,
      parentId,
      inheritShares: inherit,
    })
    folders.push(folderId)
    folderRowIds.push(folderRowId)
  }

  const leafParent = folders[folders.length - 1] ?? null

  switch (leafType) {
    case 'note': {
      const { noteId, noteRowId } = await createNote(t, campaignId, creatorProfileId, {
        parentId: leafParent,
      })
      return { folders, folderRowIds, leaf: noteId, leafRowId: noteRowId }
    }
    case 'file': {
      const { fileId, fileRowId } = await createFile(t, campaignId, creatorProfileId, {
        parentId: leafParent,
      })
      return { folders, folderRowIds, leaf: fileId, leafRowId: fileRowId }
    }
    case 'gameMap': {
      const { mapId, mapRowId } = await createGameMap(t, campaignId, creatorProfileId, {
        parentId: leafParent,
      })
      return { folders, folderRowIds, leaf: mapId, leafRowId: mapRowId }
    }
    default: {
      const _exhaustive: never = leafType
      throw new Error(`Unknown leaf type: ${String(_exhaustive)}`)
    }
  }
}

export async function syncBlocksToYjs(
  t: T,
  noteId: ResourceId,
  blocks: Array<PartialNoteBlock>,
): Promise<void> {
  const update = makeYjsUpdateWithBlocks(blocks)
  await t.run(async (ctx) => {
    const note = await requireSidebarItemRow(ctx, noteId)
    const latest = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', note._id))
      .order('desc')
      .first()
    const seq = (latest?.seq ?? -1) + 1
    await ctx.db.insert('yjsUpdates', {
      documentId: note._id,
      update,
      seq,
      isSnapshot: false,
    })
  })
}
