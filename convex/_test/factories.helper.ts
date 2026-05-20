import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../campaigns/types'
import type { SidebarItemColor } from '../sidebarItems/validation/color'
import type { SidebarItemIconName } from '../sidebarItems/validation/icon'
import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_STATUS,
  SIDEBAR_ITEM_TYPES,
} from '../sidebarItems/types/baseTypes'
import { SHARE_STATUS } from '../blockShares/types'
import { slugify } from '../common/slug'
import { assertCampaignSlug } from '../campaigns/validation'
import { assertSidebarItemName } from '../sidebarItems/validation/name'
import { assertSidebarItemSlug } from '../sidebarItems/validation/slug'
import { assertUsername } from '../users/validation'
import { makeYjsUpdateWithBlocks } from '../yjsSync/__tests__/makeYjsUpdate.helper'
import type { TestBlock } from '../yjsSync/__tests__/makeYjsUpdate.helper'
import type { TestConvex, TestConvexForDataModel } from 'convex-test'
import { api } from '../_generated/api'
import type { DataModel, Id } from '../_generated/dataModel'
import type schema from '../schema'
import type {
  SidebarItemLocation,
  SidebarItemStatus,
  SidebarItemType,
} from '../sidebarItems/types/baseTypes'
import type { PermissionLevel } from '../permissions/types'
import type { ShareStatus } from '../blockShares/types'
import type { BlockNoteId, BlockProps, BlockType, InlineContent } from '../blocks/types'
import type { CustomBlock } from '../notes/editorSpecs'
import type { SidebarItemName } from '../sidebarItems/validation/name'
import type { FileSystemOperationDecision } from '../sidebarItems/filesystem/commands'
import type {
  FileSystemEvent,
  FileSystemEventType,
  FileSystemTransactionReceipt,
} from '../sidebarItems/filesystem/receipts'

type T = TestConvex<typeof schema>
type AuthedContext = TestConvexForDataModel<DataModel>

export async function executeMoveCommand(
  client: AuthedContext,
  args: {
    campaignId: Id<'campaigns'>
    sourceItemIds: Array<Id<'sidebarItems'>>
    targetParentId: Id<'sidebarItems'> | null
    action?: 'move' | 'restore' | 'trash'
    decisions?: Array<FileSystemOperationDecision>
  },
): Promise<FileSystemTransactionReceipt> {
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
  return await client.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
    campaignId: args.campaignId,
    command,
    decisions: args.decisions,
  })
}

export async function executeCopyCommand(
  client: AuthedContext,
  args: {
    campaignId: Id<'campaigns'>
    sourceItemIds: Array<Id<'sidebarItems'>>
    targetParentId: Id<'sidebarItems'> | null
    decisions?: Array<FileSystemOperationDecision>
  },
): Promise<FileSystemTransactionReceipt> {
  return await client.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
    campaignId: args.campaignId,
    command: {
      type: 'copy',
      itemIds: args.sourceItemIds,
      targetParentId: args.targetParentId,
    },
    decisions: args.decisions,
  })
}

export async function executeDeleteForeverCommand(
  client: AuthedContext,
  args: {
    campaignId: Id<'campaigns'>
    sourceItemIds: Array<Id<'sidebarItems'>>
  },
): Promise<FileSystemTransactionReceipt> {
  return await client.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
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
    campaignId: Id<'campaigns'>
  },
): Promise<FileSystemTransactionReceipt> {
  return await client.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
    campaignId: args.campaignId,
    command: { type: 'emptyTrash' },
  })
}

export function filesystemEventItemIds(
  receipt: Pick<FileSystemTransactionReceipt, 'events'>,
  type: FileSystemEventType,
) {
  return receipt.events.filter((event) => event.type === type).map((event) => event.itemId)
}

export function copiedRootItemIds(receipt: Pick<FileSystemTransactionReceipt, 'events'>) {
  return receipt.events
    .filter(
      (event): event is Extract<FileSystemEvent, { type: 'copied' }> => event.type === 'copied',
    )
    .map((event) => event.itemId)
}

/** Create a test block content object typed as CustomBlock */
export function testBlock(
  id: string,
  overrides?: Partial<{ type: string; props: Record<string, unknown>; content: Array<unknown> }>,
): CustomBlock {
  return {
    id: testBlockNoteId(id),
    type: 'paragraph',
    props: {},
    content: [],
    ...overrides,
  } as CustomBlock
}

let counter = 0

function nextId() {
  return ++counter
}

export function testBlockNoteId(label: string): string {
  const hex = deterministicHex(label)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function deterministicHex(input: string): string {
  let stateA = 0x811c9dc5
  let stateB = 0x9e3779b9
  let stateC = 0x85ebca6b
  let stateD = 0xc2b2ae35

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    stateA = Math.imul(stateA ^ code, 0x01000193) >>> 0
    stateB = Math.imul(stateB ^ (code + index), 0x27d4eb2d) >>> 0
    stateC = Math.imul(stateC ^ (code * 17 + index), 0x165667b1) >>> 0
    stateD = Math.imul(stateD ^ (code * 31 + index), 0x85ebca77) >>> 0
  }

  return [stateA, stateB, stateC, stateD]
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('')
}

const commonFields = (creatorId: Id<'userProfiles'>) => ({
  updatedTime: null,
  updatedBy: null,
  createdBy: creatorId,
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
  const id = await t.run(async (ctx) => {
    return await ctx.db.insert('userProfiles', data)
  })
  return { _id: id, ...data }
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
  }>,
) {
  const n = nextId()
  const { slug, ...rest } = overrides ?? {}
  const defaults = {
    name: `Campaign ${n}`,
    description: '',
    dmUserId: dmProfile._id,
    slug: assertCampaignSlug(`campaign-${n}`),
    status: 'Active' as const,
    currentSessionId: null,
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

  const memberId = await t.run(async (ctx) => {
    return await ctx.db.insert('campaignMembers', {
      userId: dmProfile._id,
      campaignId,
      role: CAMPAIGN_MEMBER_ROLE.DM,
      status: CAMPAIGN_MEMBER_STATUS.Accepted,
    })
  })

  return { campaignId, dmMemberId: memberId }
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
    userId: playerProfile._id,
    campaignId,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
  }
  const data = { ...defaults, ...overrides }
  const memberId = await t.run(async (ctx) => {
    return await ctx.db.insert('campaignMembers', data)
  })
  return { memberId, ...data }
}

const sidebarItemBase = (
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  name: SidebarItemName,
): {
  name: SidebarItemName
  slug: string
  campaignId: Id<'campaigns'>
  iconName: null
  color: null
  parentId: null
  allPermissionLevel: PermissionLevel | null
  location: SidebarItemLocation
  status: SidebarItemStatus
  previewStorageId: null
  previewLockedUntil: null
  previewClaimToken: null
  previewUpdatedAt: null
} & ReturnType<typeof commonFields> => ({
  name,
  slug: assertSidebarItemSlug(slugify(name)),
  campaignId,
  iconName: null,
  color: null,
  parentId: null,
  allPermissionLevel: null,
  location: SIDEBAR_ITEM_LOCATION.sidebar,
  status: SIDEBAR_ITEM_STATUS.active,
  previewStorageId: null,
  previewLockedUntil: null,
  previewClaimToken: null,
  previewUpdatedAt: null,
  ...commonFields(creatorProfileId),
})

type CommonSidebarItemOverrides = Partial<{
  name: string
  slug: string
  parentId: Id<'sidebarItems'> | null
  allPermissionLevel: PermissionLevel | null
  location: SidebarItemLocation
  status: SidebarItemStatus
  iconName: SidebarItemIconName | null
  color: SidebarItemColor | null
  deletionTime: number | null
  deletedBy: Id<'userProfiles'> | null
  previewStorageId: Id<'_storage'> | null
  previewLockedUntil: number | null
  previewClaimToken: string | null
  previewUpdatedAt: number | null
}>

type ExtensionTable = 'notes' | 'folders' | 'gameMaps' | 'files' | 'canvases'

async function insertSidebarItem(
  t: T,
  extensionTable: ExtensionTable,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  label: string,
  type: SidebarItemType,
  extraDefaults: Record<string, unknown>,
  overrides?: CommonSidebarItemOverrides & Record<string, unknown>,
) {
  const n = nextId()
  const name = assertSidebarItemName(overrides?.name ?? `${label} ${n}`)

  const {
    inheritShares,
    imageStorageId,
    storageId,
    slug,
    name: _name,
    ...sidebarOverrides
  } = overrides ?? {}
  const validatedSlug =
    slug !== undefined ? assertSidebarItemSlug(slug) : assertSidebarItemSlug(slugify(name))
  const requestedStatus =
    sidebarOverrides.status ??
    (sidebarOverrides.deletionTime !== undefined && sidebarOverrides.deletionTime !== null
      ? SIDEBAR_ITEM_STATUS.trashed
      : SIDEBAR_ITEM_STATUS.active)

  const sharedData = {
    ...sidebarItemBase(campaignId, creatorProfileId, name),
    type,
    ...sidebarOverrides,
    location: sidebarOverrides.location ?? SIDEBAR_ITEM_LOCATION.sidebar,
    status: requestedStatus,
    slug: validatedSlug,
  }

  const extensionFields: Record<string, unknown> = {}
  if (inheritShares !== undefined) extensionFields.inheritShares = inheritShares
  if (imageStorageId !== undefined) extensionFields.imageStorageId = imageStorageId
  if (storageId !== undefined) extensionFields.storageId = storageId

  const extensionDefaults: Record<string, unknown> = { ...extraDefaults }

  const id = await t.run(async (ctx) => {
    const itemId = await ctx.db.insert('sidebarItems', sharedData)
    await ctx.db.insert(extensionTable, {
      sidebarItemId: itemId,
      ...extensionDefaults,
      ...extensionFields,
    })
    return itemId
  })
  return { id, ...sharedData, ...extensionDefaults, ...extensionFields }
}

export async function createNote(
  t: T,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  overrides?: CommonSidebarItemOverrides,
) {
  const { id: noteId, ...data } = await insertSidebarItem(
    t,
    'notes',
    campaignId,
    creatorProfileId,
    'Note',
    SIDEBAR_ITEM_TYPES.notes,
    {},
    overrides,
  )
  return { noteId, ...data }
}

export async function createFolder(
  t: T,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  overrides?: CommonSidebarItemOverrides & Partial<{ inheritShares: boolean }>,
) {
  const { id: folderId, ...data } = await insertSidebarItem(
    t,
    'folders',
    campaignId,
    creatorProfileId,
    'Folder',
    SIDEBAR_ITEM_TYPES.folders,
    { inheritShares: false },
    overrides,
  )
  return { folderId, ...data }
}

export async function createFile(
  t: T,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  overrides?: CommonSidebarItemOverrides & Partial<{ storageId: Id<'_storage'> | null }>,
) {
  const { id: fileId, ...data } = await insertSidebarItem(
    t,
    'files',
    campaignId,
    creatorProfileId,
    'File',
    SIDEBAR_ITEM_TYPES.files,
    { storageId: null },
    overrides,
  )
  return { fileId, ...data }
}

export async function createGameMap(
  t: T,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  overrides?: CommonSidebarItemOverrides & Partial<{ imageStorageId: Id<'_storage'> | null }>,
) {
  const { id: mapId, ...data } = await insertSidebarItem(
    t,
    'gameMaps',
    campaignId,
    creatorProfileId,
    'Map',
    SIDEBAR_ITEM_TYPES.gameMaps,
    { imageStorageId: null },
    overrides,
  )
  return { mapId, ...data }
}

export async function createCanvas(
  t: T,
  campaignId: Id<'campaigns'>,
  creatorProfileId: Id<'userProfiles'>,
  overrides?: CommonSidebarItemOverrides,
) {
  const { id: canvasId, ...data } = await insertSidebarItem(
    t,
    'canvases',
    campaignId,
    creatorProfileId,
    'Canvas',
    SIDEBAR_ITEM_TYPES.canvases,
    {},
    overrides,
  )
  return { canvasId, ...data }
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
  noteId: Id<'sidebarItems'>,
  campaignId: Id<'campaigns'>,
  overrides?: Partial<{
    blockNoteId: BlockNoteId
    position: number | null
    parentBlockId: BlockNoteId | null
    depth: number
    type: BlockType
    props: BlockProps
    inlineContent: InlineContent | null
    plainText: string
    shareStatus: ShareStatus | null
  }>,
) {
  const n = nextId()
  const shareStatus: ShareStatus | null = SHARE_STATUS.NOT_SHARED
  const defaults = {
    noteId: noteId,
    blockNoteId: testBlockNoteId(`block-${n}`),
    position: null,
    parentBlockId: null,
    depth: 0,
    type: 'paragraph' as const,
    props: {},
    inlineContent: null,
    plainText: '',
    campaignId,
    shareStatus,
  }
  const data = { ...defaults, ...overrides }
  if (data.parentBlockId !== null && overrides?.depth === undefined) {
    throw new Error('createBlock: depth must be explicitly provided when parentBlockId is set')
  }
  const blockDbId = await t.run(async (ctx) => {
    return await ctx.db.insert('blocks', data)
  })
  return { blockDbId, ...data }
}

export async function createSidebarShare(
  t: T,
  overrides: {
    campaignId: Id<'campaigns'>
    sidebarItemId: Id<'sidebarItems'>
    sidebarItemType: SidebarItemType
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
  const data = { ...defaults, ...overrides }
  const shareId = await t.run(async (ctx) => {
    return await ctx.db.insert('sidebarItemShares', data)
  })
  return { shareId, ...data }
}

export async function createBlockShare(
  t: T,
  overrides: {
    campaignId: Id<'campaigns'>
    noteId: Id<'sidebarItems'>
    blockId: Id<'blocks'>
    campaignMemberId: Id<'campaignMembers'>
    sessionId?: Id<'sessions'> | null
  },
) {
  const sessionId: Id<'sessions'> | null = null
  const defaults = {
    sessionId,
  }
  const data = { ...defaults, ...overrides }
  const blockShareId = await t.run(async (ctx) => {
    return await ctx.db.insert('blockShares', data)
  })
  return { blockShareId, ...data }
}

export async function createBookmark(
  t: T,
  overrides: {
    campaignId: Id<'campaigns'>
    sidebarItemId: Id<'sidebarItems'>
    campaignMemberId: Id<'campaignMembers'>
  },
) {
  const bookmarkId = await t.run(async (ctx) => {
    return await ctx.db.insert('bookmarks', overrides)
  })
  return { bookmarkId, ...overrides }
}

export async function createMapPin(
  t: T,
  mapId: Id<'sidebarItems'>,
  overrides: {
    itemId: Id<'sidebarItems'>
    x?: number
    y?: number
    visible?: boolean
  },
) {
  const defaults = {
    mapId,
    x: 0,
    y: 0,
    visible: true,
  }
  const data = { ...defaults, ...overrides }
  const pinId = await t.run(async (ctx) => {
    return await ctx.db.insert('mapPins', data)
  })
  return { pinId, ...data }
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
  const folders: Array<Id<'sidebarItems'>> = []

  for (let i = 0; i < depth; i++) {
    const parentId = i === 0 ? null : folders[i - 1]!
    const inherit = inheritShares[i] ?? false
    const { folderId } = await createFolder(t, campaignId, creatorProfileId, {
      name: `Folder-L${i}`,
      parentId,
      inheritShares: inherit,
    })
    folders.push(folderId)
  }

  const leafParent = folders[folders.length - 1] ?? null

  switch (leafType) {
    case 'note': {
      const { noteId } = await createNote(t, campaignId, creatorProfileId, {
        parentId: leafParent,
      })
      return { folders, leaf: noteId }
    }
    case 'file': {
      const { fileId } = await createFile(t, campaignId, creatorProfileId, {
        parentId: leafParent,
      })
      return { folders, leaf: fileId }
    }
    case 'gameMap': {
      const { mapId } = await createGameMap(t, campaignId, creatorProfileId, {
        parentId: leafParent,
      })
      return { folders, leaf: mapId }
    }
    default: {
      const _exhaustive: never = leafType
      throw new Error(`Unknown leaf type: ${String(_exhaustive)}`)
    }
  }
}

export async function syncBlocksToYjs(
  t: T,
  noteId: Id<'sidebarItems'>,
  blocks: Array<TestBlock>,
): Promise<void> {
  const update = makeYjsUpdateWithBlocks(blocks)
  await t.run(async (ctx) => {
    const latest = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
      .order('desc')
      .first()
    const seq = (latest?.seq ?? -1) + 1
    await ctx.db.insert('yjsUpdates', {
      documentId: noteId,
      update,
      seq,
      isSnapshot: false,
    })
  })
}
