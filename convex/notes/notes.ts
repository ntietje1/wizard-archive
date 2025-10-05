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
import { getTag, getTagCategory } from '../tags/tags'

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

export const getSidebarItems = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  categoryId?: Id<'tagCategories'>,
  parentId?: Id<'folders'>,
): Promise<AnySidebarItem[]> => {
  await requireCampaignMembership(
    ctx,
    { campaignId: campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const category = categoryId
    ? await getTagCategory(ctx, campaignId, categoryId)
    : undefined

  let tags: Tag[] = []
  if (categoryId) {
    tags = await ctx.db
      .query('tags')
      .withIndex('by_campaign_categoryId', (q) =>
        q.eq('campaignId', campaignId).eq('categoryId', categoryId),
      )
      .collect()
      .then((tags) => tags.map((tag) => ({ ...tag, category })))
  }

  const [folders, notes] = await Promise.all([
    ctx.db
      .query('folders')
      .withIndex('by_campaign_category_parent', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('categoryId', categoryId)
          .eq('parentFolderId', parentId),
      )
      .collect()
      .then((folders) =>
        folders.map((folder) => ({
          ...folder,
          type: SIDEBAR_ITEM_TYPES.folders,
          category,
        })),
      ),
    ctx.db
      .query('notes')
      .withIndex('by_campaign_category_parent', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('categoryId', categoryId)
          .eq('parentFolderId', parentId),
      )
      .collect()
      .then((notes) =>
        notes.map((note) => ({
          ...note,
          type: SIDEBAR_ITEM_TYPES.notes,
          category,
          tag: tags.find((t) => t._id === note.tagId),
        })),
      ),
  ])

  return [...folders, ...notes] as AnySidebarItem[]
}


export const findBlockByBlockNoteId = async (
  ctx: Ctx,
  noteId: Id<'notes'>,
  blockId: string
): Promise<Block | null> => {
  const note = await getNote(ctx, noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  const block = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', note.campaignId).eq('noteId', noteId).eq('blockId', blockId),
    )
    .unique()

  return block
}
