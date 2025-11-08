import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { Ctx } from '../common/types'
import { Id } from '../_generated/dataModel'
import {
  AnySidebarItem,
  Block,
  Folder,
  Note,
  NoteWithContent,
  SIDEBAR_ITEM_TYPES,
} from './types'
import { Tag } from '../tags/types'
import { getTopLevelBlocksByNote } from './helpers'
import { getTag, getTagCategory, getTagsByCategory } from '../tags/tags'

export const getNote = async (
  ctx: Ctx,
  noteId: Id<'notes'>,
): Promise<Note | null> => {
  const note = await ctx.db.get(noteId)
  if (!note) {
    return null
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const tag = note.tagId ? await getTag(ctx, note.tagId) : undefined
  const category = tag?.category

  return {
    ...note,
    type: SIDEBAR_ITEM_TYPES.notes,
    tag,
    category,
  }
}

export const getNoteWithContent = async (
  ctx: Ctx,
  noteId: Id<'notes'>,
): Promise<NoteWithContent | null> => {
  const note: Note | null = await getNote(ctx, noteId)
  if (!note) {
    return null
  }

  const [topLevelBlocks] = await Promise.all([
    getTopLevelBlocksByNote(ctx, note._id, note.campaignId),
  ])

  const content = topLevelBlocks.map((block) => block.content)

  return {
    ...note,
    content,
  }
}

export const getNoteBySlug = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  slug: string,
): Promise<NoteWithContent | null> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const note = await ctx.db
    .query('notes')
    .withIndex('by_campaign_slug', (q) =>
      q.eq('campaignId', campaignId).eq('slug', slug),
    )
    .unique()

  if (!note) {
    return null
  }

  return getNoteWithContent(ctx, note._id)
}

export const getFolder = async (
  ctx: Ctx,
  folderId: Id<'folders'>,
): Promise<Folder> => {
  const folder = await ctx.db.get(folderId)
  if (!folder) {
    throw new Error('Folder not found')
  }
  await requireCampaignMembership(
    ctx,
    { campaignId: folder.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const category = folder.categoryId
    ? await getTagCategory(ctx, folder.campaignId, folder.categoryId)
    : undefined

  return {
    ...folder,
    category,
    type: SIDEBAR_ITEM_TYPES.folders,
  }
}

export const getSidebarItemsByCategory = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  categoryId: Id<'tagCategories'>,
): Promise<AnySidebarItem[]> => {
  await requireCampaignMembership(
    ctx,
    { campaignId: campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )
  const category = await getTagCategory(ctx, campaignId, categoryId)
  const tags = await getTagsByCategory(ctx, categoryId)

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_category_parent', (q) =>
      q.eq('campaignId', campaignId).eq('categoryId', categoryId),
    )
    .collect()
    .then((folders) =>
      folders.map((folder) => ({
        ...folder,
        category,
        type: SIDEBAR_ITEM_TYPES.folders,
      })),
    )

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_category_parent', (q) =>
      q.eq('campaignId', campaignId).eq('categoryId', categoryId),
    )
    .collect()
    .then((notes) =>
      notes.map((note) => ({
        ...note,
        category,
        tag: tags.find((t) => t._id === note.tagId),
        type: SIDEBAR_ITEM_TYPES.notes,
      })),
    )

  return [...folders, ...notes] as AnySidebarItem[]
}

export const getSidebarItemsByParent = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  categoryId: Id<'tagCategories'> | undefined, // undefined category = has no category
  parentId: Id<'folders'> | undefined, // undefined parent = at root level
): Promise<AnySidebarItem[]> => {
  await requireCampaignMembership(
    ctx,
    { campaignId: campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )
  const category = categoryId
    ? await getTagCategory(ctx, campaignId, categoryId)
    : undefined
  const tags = categoryId ? await getTagsByCategory(ctx, categoryId) : []

  const folders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_category_parent', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('categoryId', categoryId ?? undefined)
        .eq('parentFolderId', parentId),
    )
    .collect()
    .then((folders) =>
      folders.map((folder) => ({
        ...folder,
        category,
        type: SIDEBAR_ITEM_TYPES.folders,
      })),
    )

  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_category_parent', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('categoryId', categoryId ?? undefined)
        .eq('parentFolderId', parentId),
    )
    .collect()
    .then((notes) =>
      notes.map((note) => ({
        ...note,
        category,
        tag: tags.find((t) => t._id === note.tagId),
        type: SIDEBAR_ITEM_TYPES.notes,
      })),
    )

  return [...folders, ...notes] as AnySidebarItem[]
}

// export const getAllSidebarItems = async (
//   ctx: Ctx,
//   campaignId: Id<'campaigns'>,
//   categoryId: Id<'tagCategories'> | null,
//   parentId: Id<'folders'> | null | undefined,
// ): Promise<AnySidebarItem[]> => {
//   await requireCampaignMembership(
//     ctx,
//     { campaignId: campaignId },
//     { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
//   )

//   const category = await getTagCategory(ctx, campaignId, categoryId)
//   const tags = await getTagsByCategory(ctx, categoryId)

//   let folders: Folder[] = []
//   let notes: Note[] = []

//   if (parentId === null) {
//     // getting all content in this category
//     folders = await ctx.db
//       .query('folders')
//       .withIndex('by_campaign_category_parent', (q) => {
//         const query = q.eq('campaignId', campaignId)
//         return query.eq('categoryId', categoryId)
//       })
//       .collect()
//       .then((folders) =>
//         folders.map((folder) => ({
//           ...folder,
//           category,
//           type: SIDEBAR_ITEM_TYPES.folders,
//         })),
//       )

//     notes = await ctx.db
//       .query('notes')
//       .withIndex('by_campaign_category_parent', (q) =>
//         q.eq('campaignId', campaignId).eq('categoryId', categoryId),
//       )
//       .collect()
//       .then((notes) =>
//         notes.map((note) => ({
//           ...note,
//           category,
//           tag: tags.find((t) => t._id === note.tagId),
//           type: SIDEBAR_ITEM_TYPES.notes,
//         })),
//       )
//   } else {
//     folders = await ctx.db
//       .query('folders')
//       .withIndex('by_campaign_category_parent', (q) =>
//         q
//           .eq('campaignId', campaignId)
//           .eq('categoryId', categoryId)
//           .eq('parentFolderId', parentId),
//       )
//       .collect()
//       .then((folders) =>
//         folders.map((folder) => ({
//           ...folder,
//           category,
//           type: SIDEBAR_ITEM_TYPES.folders,
//         })),
//       )

//     notes = await ctx.db
//       .query('notes')
//       .withIndex('by_campaign_category_parent', (q) =>
//         q
//           .eq('campaignId', campaignId)
//           .eq('categoryId', categoryId)
//           .eq('parentFolderId', parentId),
//       )
//       .collect()
//       .then((notes) =>
//         notes.map((note) => ({
//           ...note,
//           category,
//           tag: tags.find((t) => t._id === note.tagId),
//           type: SIDEBAR_ITEM_TYPES.notes,
//         })),
//       )
//   }

//   return [...folders, ...notes] as AnySidebarItem[]
// }

export const findBlockByBlockNoteId = async (
  ctx: Ctx,
  noteId: Id<'notes'>,
  blockId: string,
): Promise<Block | null> => {
  const note: Note | null = await getNote(ctx, noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  const block = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q
        .eq('campaignId', note.campaignId)
        .eq('noteId', noteId)
        .eq('blockId', blockId),
    )
    .unique()

  return block
}
