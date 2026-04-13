import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../campaigns/types'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { SHARE_STATUS } from '../blockShares/types'
import { slugify } from '../common/slug'
import type { TestConvex } from 'convex-test'
import type { Id } from '../_generated/dataModel'
import type schema from '../schema'
import type { SidebarItemLocation, SidebarItemType } from '../sidebarItems/types/baseTypes'
import type { PermissionLevel } from '../permissions/types'
import type { ShareStatus } from '../blockShares/types'
import type { BlockNoteId, BlockProps, BlockType, InlineContent } from '../blocks/types'
import type { CustomBlock } from '../notes/editorSpecs'

type T = TestConvex<typeof schema>

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
  const hex = Buffer.from(label.padEnd(12, '\0')).toString('hex').slice(0, 24)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32).padEnd(12, '0')}`
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
  const defaults = {
    authUserId: `auth-user-${n}`,
    username: `user-${n}`,
    email: `user-${n}@test.com`,
    emailVerified: null,
    name: `Test User ${n}`,
    profileImage: null,
    twoFactorEnabled: null,
  }
  const data = { ...defaults, ...overrides }
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
  const defaults = {
    name: `Campaign ${n}`,
    description: '',
    dmUserId: dmProfile._id,
    slug: `campaign-${n}`,
    status: 'Active' as const,
    currentSessionId: null,
    ...commonFields(dmProfile._id),
  }
  const campaignData = { ...defaults, ...overrides, dmUserId: dmProfile._id }
  const campaignId = await t.run(async (ctx) => {
    return await ctx.db.insert('campaigns', campaignData)
  })

  const memberId = await t.run(async (ctx) => {
    return await ctx.db.insert('campaignMembers', {
      userId: dmProfile._id,
      campaignId,
      role: CAMPAIGN_MEMBER_ROLE.DM,
      status: CAMPAIGN_MEMBER_STATUS.Accepted,
      ...commonFields(dmProfile._id),
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
  const creatorId = playerProfile._id
  const defaults = {
    userId: playerProfile._id,
    campaignId,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    ...commonFields(creatorId),
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
  name: string,
): {
  name: string
  slug: string
  campaignId: Id<'campaigns'>
  iconName: null
  color: null
  parentId: null
  allPermissionLevel: PermissionLevel | null
  location: SidebarItemLocation
  previewStorageId: null
  previewLockedUntil: null
  previewClaimToken: null
  previewUpdatedAt: null
} & ReturnType<typeof commonFields> => ({
  name,
  slug: slugify(name),
  campaignId,
  iconName: null,
  color: null,
  parentId: null,
  allPermissionLevel: null,
  location: SIDEBAR_ITEM_LOCATION.sidebar,
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
  iconName: string | null
  color: string | null
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
  const name = overrides?.name ?? `${label} ${n}`

  const { inheritShares, imageStorageId, storageId, ...sidebarOverrides } = overrides ?? {}

  const sharedData = {
    ...sidebarItemBase(campaignId, creatorProfileId, name),
    type,
    ...sidebarOverrides,
    slug: overrides?.slug ?? slugify(name),
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
      ...commonFields(creatorProfileId),
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
  creatorProfileId: Id<'userProfiles'>,
  overrides?: Partial<{
    name: string | null
    startedAt: number
    endedAt: number | null
    deletionTime: number | null
    deletedBy: Id<'userProfiles'> | null
  }>,
) {
  const defaults = {
    campaignId,
    name: null,
    startedAt: Date.now(),
    endedAt: null,
    ...commonFields(creatorProfileId),
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
  creatorProfileId: Id<'userProfiles'>,
  overrides?: Partial<{
    blockNoteId: BlockNoteId
    position: number | null
    parentBlockId: BlockNoteId | null
    depth: number
    type: BlockType
    props: BlockProps
    inlineContent: InlineContent | null
    plainText: string | null
    shareStatus: ShareStatus | null
    deletionTime: number | null
    deletedBy: Id<'userProfiles'> | null
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
    plainText: null,
    campaignId,
    shareStatus,
    ...commonFields(creatorProfileId),
  }
  const data = { ...defaults, ...overrides }
  const blockDbId = await t.run(async (ctx) => {
    return await ctx.db.insert('blocks', data)
  })
  return { blockDbId, ...data }
}

export async function createSidebarShare(
  t: T,
  creatorProfileId: Id<'userProfiles'>,
  overrides: {
    campaignId: Id<'campaigns'>
    sidebarItemId: Id<'sidebarItems'>
    sidebarItemType: SidebarItemType
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel?: PermissionLevel | null
    sessionId?: Id<'sessions'> | null
    deletionTime?: number | null
    deletedBy?: Id<'userProfiles'> | null
  },
) {
  const permissionLevel: PermissionLevel | null = 'view'
  const sessionId: Id<'sessions'> | null = null
  const defaults = {
    permissionLevel,
    sessionId,
    ...commonFields(creatorProfileId),
  }
  const data = { ...defaults, ...overrides }
  const shareId = await t.run(async (ctx) => {
    return await ctx.db.insert('sidebarItemShares', data)
  })
  return { shareId, ...data }
}

export async function createBlockShare(
  t: T,
  creatorProfileId: Id<'userProfiles'>,
  overrides: {
    campaignId: Id<'campaigns'>
    noteId: Id<'sidebarItems'>
    blockId: Id<'blocks'>
    campaignMemberId: Id<'campaignMembers'>
    sessionId?: Id<'sessions'> | null
    deletionTime?: number | null
    deletedBy?: Id<'userProfiles'> | null
  },
) {
  const sessionId: Id<'sessions'> | null = null
  const defaults = {
    sessionId,
    ...commonFields(creatorProfileId),
  }
  const data = { ...defaults, ...overrides }
  const blockShareId = await t.run(async (ctx) => {
    return await ctx.db.insert('blockShares', data)
  })
  return { blockShareId, ...data }
}

export async function createBookmark(
  t: T,
  creatorProfileId: Id<'userProfiles'>,
  overrides: {
    campaignId: Id<'campaigns'>
    sidebarItemId: Id<'sidebarItems'>
    campaignMemberId: Id<'campaignMembers'>
    deletionTime?: number | null
    deletedBy?: Id<'userProfiles'> | null
  },
) {
  const defaults = {
    ...commonFields(creatorProfileId),
  }
  const data = { ...defaults, ...overrides }
  const bookmarkId = await t.run(async (ctx) => {
    return await ctx.db.insert('bookmarks', data)
  })
  return { bookmarkId, ...data }
}

export async function createMapPin(
  t: T,
  mapId: Id<'sidebarItems'>,
  creatorProfileId: Id<'userProfiles'>,
  overrides: {
    itemId: Id<'sidebarItems'>
    x?: number
    y?: number
    visible?: boolean
    deletionTime?: number | null
    deletedBy?: Id<'userProfiles'> | null
  },
) {
  const defaults = {
    mapId: mapId,
    x: 0,
    y: 0,
    visible: true,
    ...commonFields(creatorProfileId),
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
