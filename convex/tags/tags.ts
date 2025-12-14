import { CustomBlock } from '../notes/editorSpecs'
import { Id, TableNames } from '../_generated/dataModel'
import { MutationCtx } from '../_generated/server'
import {
  Tag,
  CATEGORY_KIND,
  TagCategory,
  SYSTEM_DEFAULT_CATEGORIES,
} from './types'
import { SIDEBAR_ITEM_TYPES, SidebarItemId } from '../sidebarItems/types'
import type { Block } from '../blocks/types'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { findUniqueSlug } from '../common/slug'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { Ctx } from '../common/types'
import { deleteNote, getNote } from '../notes/notes'
import { findBlockByBlockNoteId } from '../blocks/blocks'
import pluralize from 'pluralize'
import {
  getSidebarItemById,
  isValidSidebarParent,
} from '../sidebarItems/sidebarItems'
import { deleteMap } from '../gameMaps/gameMaps'

function capitalizeFirstLetter(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function combineTagEntity<TCombined>(
  idKey: string,
  entity: { _id: Id<TableNames> },
  tag: { _id: Id<'tags'>; category?: { _id: Id<'tagCategories'> } },
  category?: { _id: Id<'tagCategories'> },
): TCombined {
  const combined = {
    ...entity,
    ...tag,
    _id: tag._id,
    category: category ?? tag.category,
    tagId: tag._id,
  }
  return {
    ...combined,
    [idKey]: entity._id,
  } as TCombined
}

export const getTag = async (ctx: Ctx, tagId: Id<'tags'>): Promise<Tag> => {
  const tag = await ctx.db.get(tagId)
  if (!tag) {
    throw new Error('Tag not found')
  }

  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: tag.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  if (tag.campaignId !== campaignWithMembership.campaign._id) {
    throw new Error('Tag not found')
  }

  const category = await getTagCategory(ctx, tag.campaignId, tag.categoryId)

  return {
    ...tag,
    category,
  }
}

export async function getTagCategory(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  categoryId: Id<'tagCategories'>,
): Promise<TagCategory> {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const category = await ctx.db.get(categoryId)

  if (!category || category.campaignId !== campaignId) {
    throw new Error('Category not found')
  }

  return category
}

export async function getTagCategoryBySlug(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  slug: string,
): Promise<TagCategory | null> {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const category = await ctx.db
    .query('tagCategories')
    .withIndex('by_campaign_slug', (q) =>
      q.eq('campaignId', campaignId).eq('slug', slug),
    )
    .unique()

  return category
}

export const insertTagAndNote = async (
  ctx: MutationCtx,
  newTag: Omit<
    Tag,
    | '_id'
    | '_creationTime'
    | 'updatedAt'
    | 'category'
    | 'createdBy'
    | 'type'
    | 'slug'
  >,
  parentId?: SidebarItemId,
  allowManagedTags: boolean = false,
): Promise<{ tagId: Id<'tags'> }> => {
  await requireCampaignMembership(
    ctx,
    { campaignId: newTag.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  // Generate unique slug for tag
  const slugBasis = newTag.name || 'untitled-tag' //TODO: make this consistent with the slug basis for notes and folders
  const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
    const conflict = await ctx.db
      .query('tags')
      .withIndex('by_campaign_slug', (q) =>
        q.eq('campaignId', newTag.campaignId).eq('slug', slug),
      )
      .unique()
    return conflict !== null
  })

  if (parentId) {
    const parentItem = await getSidebarItemById(
      ctx,
      newTag.campaignId,
      parentId,
    )
    if (!parentItem) {
      throw new Error('Invalid parentId')
    }
    if (!isValidSidebarParent(SIDEBAR_ITEM_TYPES.tags, parentItem.type)) {
      throw new Error(`Invalid parent item for tag: ${parentId}`)
    }
  }

  const tagId = await insertTag(
    ctx,
    {
      ...newTag,
      slug: uniqueSlug,
      parentId,
    },
    allowManagedTags,
  )

  // Create two child notes for tag: "Your Notes" and "Shared Notes"
  const yourNotesSlug = await findUniqueSlug('your-notes', async (slug) => {
    const conflict = await ctx.db
      .query('notes')
      .withIndex('by_campaign_slug', (q) =>
        q.eq('campaignId', newTag.campaignId).eq('slug', slug),
      )
      .unique()
    return conflict !== null
  })

  const sharedNotesSlug = await findUniqueSlug('shared-notes', async (slug) => {
    const conflict = await ctx.db
      .query('notes')
      .withIndex('by_campaign_slug', (q) =>
        q.eq('campaignId', newTag.campaignId).eq('slug', slug),
      )
      .unique()
    return conflict !== null
  })

  // Get the tag to access its categoryId
  const tag = await ctx.db.get(tagId)
  if (!tag) {
    throw new Error('Tag not found after creation')
  }

  await ctx.db.insert('notes', {
    name: 'Your Notes',
    slug: yourNotesSlug,
    campaignId: newTag.campaignId,
    categoryId: tag.categoryId,
    updatedAt: Date.now(),
    parentId: tagId,
    type: 'notes',
  })
  await ctx.db.insert('notes', {
    name: 'Shared Notes',
    slug: sharedNotesSlug,
    campaignId: newTag.campaignId,
    categoryId: tag.categoryId,
    updatedAt: Date.now(),
    parentId: tagId,
    type: 'notes',
  })

  return { tagId }
}

export const insertTag = async (
  ctx: MutationCtx,
  newTag: Omit<
    Tag,
    '_id' | '_creationTime' | 'updatedAt' | 'category' | 'createdBy' | 'type'
  >,
  allowManaged: boolean = false,
): Promise<Id<'tags'>> => {
  const category = await ctx.db.get(newTag.categoryId)
  if (!category) {
    throw new Error('Category not found')
  }
  if (!allowManaged && category.kind === CATEGORY_KIND.SystemManaged) {
    throw new Error('Managed-category tags cannot be created by users')
  }
  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: newTag.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  if (newTag.name) {
    //TODO: come up with a better way to check for duplicates
    const allTags = await ctx.db
      .query('tags')
      .withIndex('by_campaign_name', (q) =>
        q.eq('campaignId', newTag.campaignId),
      )
      .collect()
    const nameLower = newTag.name.toLowerCase()
    const existing = allTags.find((t) => t.name?.toLowerCase() === nameLower)
    if (existing) {
      throw new Error('Tag already exists')
    }
  }

  if (newTag.parentId) {
    const parentItem = await getSidebarItemById(
      ctx,
      newTag.campaignId,
      newTag.parentId,
    )
    if (!parentItem) {
      throw new Error('Invalid parentId')
    }
    if (!isValidSidebarParent(SIDEBAR_ITEM_TYPES.tags, parentItem.type)) {
      throw new Error(`Invalid parent item for tag: ${newTag.parentId}`)
    }
  }

  const tagId = await ctx.db.insert('tags', {
    name: newTag.name,
    iconName: newTag.iconName,
    slug: newTag.slug,
    categoryId: newTag.categoryId,
    parentId: newTag.parentId,
    color: newTag.color,
    description: newTag.description,
    imageStorageId: newTag.imageStorageId,
    campaignId: newTag.campaignId,
    updatedAt: Date.now(),
    createdBy: campaignWithMembership.member._id,
    type: 'tags',
  })

  return tagId
}

export async function ensureDefaultTagCategories(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
): Promise<Id<'tagCategories'>[]> {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const existing = await ctx.db
    .query('tagCategories')
    .withIndex('by_campaign_slug', (q) => q.eq('campaignId', campaignId))
    .collect()

  const ids: Id<'tagCategories'>[] = []
  for (const d of Object.values(SYSTEM_DEFAULT_CATEGORIES)) {
    const found = existing.find((c) => c.slug === d.slug)
    if (found) {
      ids.push(found._id)
    } else {
      const id = await insertTagCategory(
        ctx,
        {
          campaignId,
          kind: d.kind,
          categoryName: d.pluralName,
          iconName: d.iconName,
          defaultColor: d.defaultColor,
        },
        true,
      )
      ids.push(id)
    }
  }
  return ids
}

export async function getTagsByCampaign(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
): Promise<Tag[]> {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const categories = await ctx.db
    .query('tagCategories')
    .withIndex('by_campaign_slug', (q) => q.eq('campaignId', campaignId))
    .collect()

  const tags = await ctx.db
    .query('tags')
    .withIndex('by_campaign_name', (q) => q.eq('campaignId', campaignId))
    .collect()
  return tags.map((t) => {
    const category = categories.find((c) => c._id === t.categoryId)
    if (!category) {
      throw new Error(`Category not found for tag ${t._id}`)
    }
    return {
      ...t,
      category,
    }
  })
}

export async function getTagsByCategory(
  ctx: Ctx,
  categoryId: Id<'tagCategories'>,
): Promise<Tag[]> {
  const category = await ctx.db.get(categoryId)
  if (!category) {
    throw new Error('Category not found')
  }

  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: category.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  if (category.campaignId !== campaignWithMembership.campaign._id) {
    throw new Error('Category not found')
  }

  const tags = await ctx.db
    .query('tags')
    .withIndex('by_campaign_category', (q) =>
      q.eq('campaignId', category.campaignId).eq('categoryId', category._id),
    )
    .collect()

  return tags.map((t) => ({
    ...t,
    category: { ...category, type: SIDEBAR_ITEM_TYPES.tagCategories },
    type: SIDEBAR_ITEM_TYPES.tags,
  }))
}

export async function insertTagCategory(
  ctx: MutationCtx,
  input: Omit<
    TagCategory,
    | '_id'
    | '_creationTime'
    | 'updatedAt'
    | 'createdBy'
    | 'slug'
    | 'name'
    | 'pluralName'
    | 'type'
    | 'parentId'
  > &
    ({ categoryName: string } | { name: string; pluralName: string }),
  allowSystem: boolean = false,
): Promise<Id<'tagCategories'>> {
  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: input.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  if (
    !input.campaignId ||
    input.campaignId !== campaignWithMembership.campaign._id
  ) {
    throw new Error('Invalid campaign')
  }

  if (!allowSystem && input.kind !== CATEGORY_KIND.User) {
    throw new Error('Invalid kind')
  }

  let name: string
  let pluralName: string

  if ('categoryName' in input) {
    // auto-pluralize mode
    const isPlural = pluralize.isPlural(input.categoryName)
    name = capitalizeFirstLetter(
      isPlural ? pluralize.singular(input.categoryName) : input.categoryName,
    )
    pluralName = capitalizeFirstLetter(
      isPlural ? input.categoryName : pluralize.plural(input.categoryName),
    )
  } else {
    // manual mode (plural and singular specified)
    name = capitalizeFirstLetter(input.name)
    pluralName = capitalizeFirstLetter(input.pluralName)
  }

  const uniqueSlug = await findUniqueSlug(pluralName, async (slug) => {
    const conflict = await ctx.db
      .query('tagCategories')
      .withIndex('by_campaign_slug', (q) =>
        q.eq('campaignId', input.campaignId).eq('slug', slug),
      )
      .unique()
    return conflict !== null
  })

  const id = await ctx.db.insert('tagCategories', {
    updatedAt: Date.now(),
    campaignId: input.campaignId,
    slug: uniqueSlug,
    name,
    pluralName,
    kind: input.kind,
    iconName: input.iconName,
    defaultColor: input.defaultColor,
    createdBy: campaignWithMembership.member._id,
    type: 'tagCategories',
    parentId: undefined, // Categories cannot have parents
  })
  return id
}

export const updateTagCategory = async (
  ctx: MutationCtx,
  categoryId: Id<'tagCategories'>,
  input: {
    iconName?: string
    defaultColor?: string
  } & ({ categoryName: string } | { name: string; pluralName: string }),
): Promise<{ categoryId: Id<'tagCategories'>; slug: string }> => {
  const category = await ctx.db.get(categoryId)
  if (!category) {
    throw new Error('Category not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: category.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  if (category.kind === CATEGORY_KIND.SystemManaged) {
    throw new Error('User cannot update system-managed categories')
  }

  const updates: Partial<TagCategory> = {
    updatedAt: Date.now(),
  }

  if ('categoryName' in input) {
    // auto-pluralize mode
    const isPlural = pluralize.isPlural(input.categoryName)
    updates.name = capitalizeFirstLetter(
      isPlural ? pluralize.singular(input.categoryName) : input.categoryName,
    )
    updates.pluralName = capitalizeFirstLetter(
      isPlural ? input.categoryName : pluralize.plural(input.categoryName),
    )
  } else {
    // manual mode
    if (input.name !== undefined) {
      updates.name = capitalizeFirstLetter(input.name)
    }
    if (input.pluralName !== undefined) {
      updates.pluralName = capitalizeFirstLetter(input.pluralName)
    }
  }

  if (input.iconName !== undefined) {
    updates.iconName = input.iconName
  }

  if (input.defaultColor !== undefined) {
    updates.defaultColor = input.defaultColor
  }

  if (updates.pluralName !== undefined) {
    const uniqueSlug = await findUniqueSlug(
      updates.pluralName,
      async (slug) => {
        const conflict = await ctx.db
          .query('tagCategories')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', category.campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null && conflict._id !== categoryId
      },
    )
    updates.slug = uniqueSlug
  }

  await ctx.db.patch(categoryId, updates)

  const updatedCategory = await ctx.db.get(categoryId)
  if (!updatedCategory) {
    throw new Error('Category not found after update')
  }

  return { categoryId, slug: updatedCategory.slug }
}

export const updateTagAndContent = async (
  ctx: MutationCtx,
  tagId: Id<'tags'>,
  input: {
    name?: string
    iconName?: string
    color?: string | null
    description?: string
    imageStorageId?: Id<'_storage'>
  },
) => {
  const tag = await ctx.db.get(tagId)
  if (!tag) {
    throw new Error('Tag not found')
  }

  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: tag.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )
  if (tag.campaignId !== campaignWithMembership.campaign._id) {
    throw new Error('Tag not found')
  }

  const category = await ctx.db.get(tag.categoryId)
  if (!category) {
    throw new Error('Category not found')
  }

  if (category.kind === CATEGORY_KIND.SystemManaged) {
    throw new Error('Managed-category tags cannot be updated')
  }

  const updates: {
    updatedAt: number
    name?: string
    iconName?: string
    color?: string | undefined
    description?: string
    imageStorageId?: Id<'_storage'>
  } = {
    updatedAt: Date.now(),
  }

  if (input.name !== undefined) {
    if (input.name) {
      // Check for case-insensitive duplicate by querying all tags
      const allTags = await ctx.db
        .query('tags')
        .withIndex('by_campaign_name', (q) =>
          q.eq('campaignId', tag.campaignId),
        )
        .collect()
      const nameLower = input.name.toLowerCase()
      const existing = allTags.find(
        (t) => t.name?.toLowerCase() === nameLower && t._id !== tagId,
      )
      if (existing) {
        throw new Error('Tag already exists')
      }
      updates.name = input.name
    } else {
      updates.name = undefined
    }
  }
  if (input.iconName !== undefined) {
    updates.iconName = input.iconName
  }
  if (input.color !== undefined) {
    // null means explicitly clear the color
    // undefined means don't update
    updates.color = input.color === null ? undefined : input.color
  }
  if (input.description !== undefined) {
    updates.description = input.description
  }
  if (input.imageStorageId !== undefined) {
    if (input.imageStorageId) {
      const url = await ctx.storage.getUrl(input.imageStorageId)
      if (!url) {
        throw new Error('Invalid storage reference')
      }
    }
    updates.imageStorageId = input.imageStorageId
  }
  await ctx.db.patch(tagId, updates)

  if (updates.name !== undefined || updates.color !== undefined) {
    const newName = updates.name
    const newColor = updates.color

    const allBlocks = await ctx.db
      .query('blocks')
      .withIndex('by_campaign_note_block', (q) =>
        q.eq('campaignId', tag.campaignId),
      )
      .collect()

    const updateTagsInContent = (content: any): any => {
      if (Array.isArray(content)) {
        return content.map(updateTagsInContent)
      } else if (content && typeof content === 'object') {
        if (content.type === 'tag' && content.props?.tagId === tagId) {
          return {
            ...content,
            props: {
              ...content.props,
              tagName: newName ?? content.props.tagName,
              tagColor: newColor ?? content.props.tagColor,
            },
          }
        }

        const updatedContent = { ...content }
        if (content.content) {
          updatedContent.content = updateTagsInContent(content.content)
        }
        if (content.children) {
          updatedContent.children = updateTagsInContent(content.children)
        }

        return updatedContent
      }
      return content
    }

    for (const block of allBlocks) {
      const updatedContent = updateTagsInContent(block.content)

      if (JSON.stringify(updatedContent) !== JSON.stringify(block.content)) {
        await ctx.db.patch(block._id, {
          content: updatedContent,
          updatedAt: Date.now(),
        })
      }
    }
  }
}

export const deleteTagAndCleanupContent = async (
  ctx: MutationCtx,
  tagId: Id<'tags'>,
): Promise<Id<'tags'>> => {
  const tag = await ctx.db.get(tagId)
  if (!tag) {
    throw new Error('Tag not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: tag.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const category = await ctx.db.get(tag.categoryId)
  if (!category) {
    throw new Error('Category not found')
  }

  if (category.kind === CATEGORY_KIND.SystemManaged) {
    throw new Error('System-managed categories cannot be deleted')
  }

  // find all sidebar children
  const notes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_parent', (q) =>
      q.eq('campaignId', tag.campaignId).eq('parentId', tagId),
    )
    .collect()

  const maps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_parent', (q) =>
      q.eq('campaignId', tag.campaignId).eq('parentId', tagId),
    )
    .collect()

  for (const note of notes) {
    await deleteNote(ctx, note._id)
  }
  for (const map of maps) {
    await deleteMap(ctx, map._id)
  }

  //TODO: modify all tags in content to just be text without being an actual tag inline content
  await ctx.db.delete(tagId)
  return tagId
}

export const deleteTagCategory = async (
  ctx: MutationCtx,
  categoryId: Id<'tagCategories'>,
): Promise<Id<'tagCategories'>> => {
  const category = await ctx.db.get(categoryId)
  if (!category) {
    throw new Error('Category not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: category.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  if (category.kind !== CATEGORY_KIND.User) {
    throw new Error('Only user categories can be deleted')
  }

  const tags = await ctx.db
    .query('tags')
    .withIndex('by_campaign_category', (q) =>
      q.eq('campaignId', category.campaignId).eq('categoryId', category._id),
    )
    .collect()
  if (tags.length > 0) {
    throw new Error('Cannot delete category with existing tags')
  }
  //TODO: delete all other children

  await ctx.db.delete(categoryId)
  return categoryId
}

export async function getNoteLevelTag(
  ctx: Ctx,
  noteId: Id<'notes'>,
): Promise<Tag | null> {
  const note = await ctx.db.get(noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  // Check if note's parentId is a tag
  if (!note.parentId) {
    return null
  }

  const parentItem = await getSidebarItemById(
    ctx,
    note.campaignId,
    note.parentId,
  )
  if (!parentItem || parentItem.type !== SIDEBAR_ITEM_TYPES.tags) {
    return null
  }

  const tag = parentItem as Tag

  const category = await ctx.db.get(tag.categoryId)
  if (!category) {
    throw new Error('Category not found')
  }

  return {
    ...tag,
    category: { ...category, type: SIDEBAR_ITEM_TYPES.tagCategories },
    type: SIDEBAR_ITEM_TYPES.tags,
  } as Tag
}

export async function getBlockLevelTag(
  ctx: Ctx,
  blockDbId: Id<'blocks'>,
): Promise<Tag | null> {
  const block = await ctx.db.get(blockDbId)
  if (!block) {
    throw new Error('Block not found')
  }

  const note = await ctx.db.get(block.noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  // Check if note's parentId is a tag
  if (!note.parentId) {
    return null
  }

  const parentItem = await getSidebarItemById(
    ctx,
    note.campaignId,
    note.parentId,
  )
  if (!parentItem || parentItem.type !== SIDEBAR_ITEM_TYPES.tags) {
    return null
  }

  return parentItem as Tag
}

export async function findBlock(
  ctx: Ctx,
  noteId: Id<'notes'>,
  blockId: string,
): Promise<Block | null> {
  const note = await ctx.db.get(noteId)
  if (!note) {
    return null
  }

  // Use the full index to efficiently find the block
  const block = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q
        .eq('campaignId', note.campaignId)
        .eq('noteId', noteId)
        .eq('blockId', blockId),
    )
    .unique()

  return block ? (block as Block) : null
}

export async function getBlockLevelTags(
  ctx: Ctx,
  blockDbId: Id<'blocks'>,
): Promise<Id<'tags'>[]> {
  const block = await ctx.db.get(blockDbId)
  if (!block) {
    throw new Error('Block not found')
  }

  const blockTagIds = await ctx.db
    .query('blockTags')
    .withIndex('by_campaign_block_tag', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', blockDbId),
    )
    .collect()
    .then((bt) => bt.map((b) => b.tagId))

  return blockTagIds
}

export async function getInlineTagIdsForBlock(
  ctx: Ctx,
  blockDbId: Id<'blocks'>,
): Promise<Id<'tags'>[]> {
  const block = await ctx.db.get(blockDbId)
  if (!block) {
    throw new Error('Block not found')
  }
  return extractTagIdsFromBlockContent(block.content)
}

export async function getNoteLevelTagIdForBlock(
  ctx: Ctx,
  blockDbId: Id<'blocks'>,
): Promise<Id<'tags'> | null> {
  const noteTag = await getBlockLevelTag(ctx, blockDbId)
  return noteTag?._id ?? null
}

export async function getEffectiveTagIdsForBlock(
  ctx: Ctx,
  blockDbId: Id<'blocks'>,
): Promise<Id<'tags'>[]> {
  const [blockLevelTagIds, inlineTagIds, noteLevelTagId] = await Promise.all([
    getBlockLevelTags(ctx, blockDbId),
    getInlineTagIdsForBlock(ctx, blockDbId),
    getNoteLevelTagIdForBlock(ctx, blockDbId),
  ])

  const combined = noteLevelTagId
    ? [...blockLevelTagIds, ...inlineTagIds, noteLevelTagId]
    : [...blockLevelTagIds, ...inlineTagIds]

  return [...new Set(combined)]
}

export async function doesBlockMatchRequiredTags(
  ctx: Ctx,
  blockDbId: Id<'blocks'>,
  requiredTagIds: Id<'tags'>[],
): Promise<boolean> {
  if (!requiredTagIds || requiredTagIds.length === 0) return true
  const effectiveTagIds = await getEffectiveTagIdsForBlock(ctx, blockDbId)
  return requiredTagIds.every((tagId) => effectiveTagIds.includes(tagId))
}

async function addTagToBlock(
  ctx: MutationCtx,
  block: Block,
  tagId: Id<'tags'>,
) {
  const existing = await ctx.db
    .query('blockTags')
    .withIndex('by_campaign_block_tag', (q) =>
      q
        .eq('campaignId', block.campaignId)
        .eq('blockId', block._id)
        .eq('tagId', tagId),
    )
    .unique()

  if (!existing) {
    await ctx.db.insert('blockTags', {
      campaignId: block.campaignId,
      blockId: block._id,
      tagId,
    })

    await ctx.db.patch(block._id, {
      updatedAt: Date.now(),
    })
  }
  return block._id
}

// handles the automatic insertion of blocks that dont already exist in the db
export async function addTagToBlockHandler(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
  blockId: string,
  tagId: Id<'tags'>,
) {
  const note = await getNote(ctx, noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const existingBlock = await findBlockByBlockNoteId(ctx, noteId, blockId)

  if (existingBlock) {
    const inlineTagIds = extractTagIdsFromBlockContent(existingBlock.content)
    if (inlineTagIds.includes(tagId)) {
      throw new Error(
        'Cannot manually add tag that already exists as inline tag in block content',
      )
    }

    await addTagToBlock(ctx, existingBlock, tagId)
  } else {
    const targetBlock = await findBlockByBlockNoteId(ctx, noteId, blockId)

    if (targetBlock) {
      const inlineTagIds = extractTagIdsFromBlockContent(targetBlock)
      if (inlineTagIds.includes(tagId)) {
        throw new Error(
          'Cannot manually add tag that already exists as inline tag in block content',
        )
      }

      const blockDbId = await ctx.db.insert('blocks', {
        noteId,
        blockId,
        position: undefined,
        content: targetBlock,
        isTopLevel: false,
        campaignId: note.campaignId,
        updatedAt: Date.now(),
      })

      const block = await ctx.db.get(blockDbId)
      if (!block) {
        throw new Error('Block not found')
      }

      await addTagToBlock(ctx, block, tagId)
    }
  }

  return blockId
}

async function removeTagFromBlock(
  ctx: MutationCtx,
  block: Block,
  tagIdToRemove: Id<'tags'>,
): Promise<Id<'blocks'>> {
  const blockTag = await ctx.db
    .query('blockTags')
    .withIndex('by_campaign_block_tag', (q) =>
      q
        .eq('campaignId', block.campaignId)
        .eq('blockId', block._id)
        .eq('tagId', tagIdToRemove),
    )
    .unique()

  if (blockTag) {
    await ctx.db.delete(blockTag._id)
  }

  return block._id
}

// handles the automatic removal of blocks that dont have any tags left
export async function removeTagFromBlockHandler(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
  blockId: string,
  tagId: Id<'tags'>,
) {
  const note = await getNote(ctx, noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const block = await findBlockByBlockNoteId(ctx, noteId, blockId)
  if (!block) {
    throw new Error('Block not found')
  }

  const inlineTagIds = extractTagIdsFromBlockContent(block.content)
  if (inlineTagIds.includes(tagId)) {
    throw new Error(
      'Cannot manually remove tag that exists as inline tag in block content',
    )
  }

  await removeTagFromBlock(ctx, block, tagId)

  const remainingTags = await getBlockLevelTags(ctx, block._id)
  if (remainingTags.length === 0 && !block.isTopLevel) {
    await ctx.db.delete(block._id)
  } else {
    await ctx.db.patch(block._id, {
      updatedAt: Date.now(),
    })
  }

  return blockId
}

export function extractAllBlocksWithTags(
  content: CustomBlock[],
  noteTagId: Id<'tags'> | null,
): Map<
  string,
  { block: CustomBlock; tagIds: Id<'tags'>[]; isTopLevel: boolean }
> {
  const blocksMap = new Map<
    string,
    { block: CustomBlock; tagIds: Id<'tags'>[]; isTopLevel: boolean }
  >()

  function traverseBlocks(blocks: any[], isTopLevel: boolean = false) {
    if (!Array.isArray(blocks)) return

    blocks.forEach((block) => {
      if (block.id) {
        const tagIds = extractTagIdsFromBlockContent(block)

        if (isTopLevel || tagIds.length > 0 || noteTagId) {
          blocksMap.set(block.id, {
            block,
            tagIds,
            isTopLevel,
          })
        }
      }

      if (block.children && Array.isArray(block.children)) {
        traverseBlocks(block.children, false)
      }
    })
  }

  traverseBlocks(content, true)
  return blocksMap
}

export function extractTagIdsFromBlockContent(block: any): Id<'tags'>[] {
  const tagIds: Id<'tags'>[] = []

  function traverseImmediate(content: any, depth: number = 0) {
    if (!content || depth > 2) return

    if (Array.isArray(content)) {
      content.forEach((item) => traverseImmediate(item, depth + 1))
    } else if (typeof content === 'object') {
      if (
        content.type === 'tag' &&
        content.props?.tagId &&
        !tagIds.includes(content.props.tagId)
      ) {
        tagIds.push(content.props.tagId)
        return
      }

      if (content.text !== undefined || content.type === 'text') {
        Object.values(content).forEach((value) =>
          traverseImmediate(value, depth + 1),
        )
      } else if (content.content && !content.id) {
        traverseImmediate(content.content, depth + 1)
      }
    }
  }

  if (block.content) {
    traverseImmediate(block.content, 0)
  }

  return tagIds
}

export function computeTopLevelPositions(
  allBlocksWithTags: Map<
    string,
    { block: CustomBlock; tagIds: Id<'tags'>[]; isTopLevel: boolean }
  >,
): Map<string, number> {
  const order = Array.from(allBlocksWithTags.entries())
    .filter(([_, data]) => data.isTopLevel)
    .map(([id]) => id)
  const positions = new Map<string, number>()
  order.forEach((id, index) => positions.set(id, index))
  return positions
}

export async function upsertBlock(
  ctx: MutationCtx,
  existingBlock: Block | undefined,
  params: {
    noteId: Id<'notes'>
    campaignId: Id<'campaigns'>
    blockId: string
    isTopLevel: boolean
    position?: number
    content: CustomBlock
    now: number
  },
): Promise<Id<'blocks'>> {
  if (existingBlock) {
    await ctx.db.patch(existingBlock._id, {
      position: params.position,
      content: params.content,
      isTopLevel: params.isTopLevel,
      updatedAt: params.now,
    })
    return existingBlock._id
  }

  return await ctx.db.insert('blocks', {
    noteId: params.noteId,
    blockId: params.blockId,
    position: params.position,
    content: params.content,
    isTopLevel: params.isTopLevel,
    campaignId: params.campaignId,
    updatedAt: params.now,
  })
}

export async function updateBlockTags(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  finalBlockDbId: Id<'blocks'>,
  existingBlockContent: CustomBlock | undefined,
  inlineTagIds: Id<'tags'>[],
): Promise<void> {
  const currentTagIds = await getBlockLevelTags(ctx, finalBlockDbId)

  const oldInlineTagIds = existingBlockContent
    ? extractTagIdsFromBlockContent(existingBlockContent)
    : []

  const manualTags = currentTagIds.filter(
    (tagId) => !oldInlineTagIds.includes(tagId),
  )

  const finalTagIds = [...new Set([...inlineTagIds, ...manualTags])]

  const tagsToRemove = currentTagIds.filter(
    (tagId) => !finalTagIds.includes(tagId),
  )
  const tagsToAdd = finalTagIds.filter(
    (tagId) => !currentTagIds.includes(tagId),
  )

  for (const tagId of tagsToRemove) {
    const blockTag = await ctx.db
      .query('blockTags')
      .withIndex('by_campaign_block_tag', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('blockId', finalBlockDbId)
          .eq('tagId', tagId),
      )
      .unique()
    if (blockTag) {
      await ctx.db.delete(blockTag._id)
    }
  }

  for (const tagId of tagsToAdd) {
    await ctx.db.insert('blockTags', {
      campaignId,
      blockId: finalBlockDbId,
      tagId,
    })
  }
}

export async function insertInlineBlockTags(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  finalBlockDbId: Id<'blocks'>,
  inlineTagIds: Id<'tags'>[],
): Promise<void> {
  const finalTagIds = [...new Set([...inlineTagIds])]
  for (const tagId of finalTagIds) {
    await ctx.db.insert('blockTags', {
      campaignId,
      blockId: finalBlockDbId,
      tagId,
    })
  }
}

async function removeBlockAndTags(
  ctx: MutationCtx,
  block: Block,
): Promise<void> {
  const blockTags = await ctx.db
    .query('blockTags')
    .withIndex('by_campaign_block_tag', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', block._id),
    )
    .collect()

  for (const bt of blockTags) {
    await ctx.db.delete(bt._id)
  }
  await ctx.db.delete(block._id)
}

export async function cleanupUnprocessedBlocks(
  ctx: MutationCtx,
  existingBlocks: Block[],
  processedBlockIds: Set<string>,
  content: CustomBlock[],
  now: number,
): Promise<void> {
  for (const existingBlock of existingBlocks) {
    if (!processedBlockIds.has(existingBlock.blockId)) {
      const currentTagIds = await getBlockLevelTags(ctx, existingBlock._id)
      const blockInNewContent = findBlockById(content, existingBlock.blockId)
      const inlineTagIdsNew = blockInNewContent
        ? extractTagIdsFromBlockContent(blockInNewContent)
        : []

      const hasAnyTags =
        (currentTagIds && currentTagIds.length > 0) ||
        (inlineTagIdsNew && inlineTagIdsNew.length > 0)

      if (!hasAnyTags) {
        await removeBlockAndTags(ctx, existingBlock)
      } else {
        await ctx.db.patch(existingBlock._id, {
          isTopLevel: false,
          position: undefined,
          content: blockInNewContent
            ? blockInNewContent
            : existingBlock.content,
          updatedAt: now,
        })
      }
    }
  }
}

export function findBlockById(content: any, blockId: string): any | null {
  if (!Array.isArray(content)) return null

  for (const block of content) {
    if (block.id === blockId) {
      return block
    }

    if (block.children && Array.isArray(block.children)) {
      const found = findBlockById(block.children, blockId)
      if (found) return found
    }
  }
  return null
}

export function isBlockChildOf(
  blockId: string,
  parentBlockId: string,
  content: CustomBlock[],
): boolean {
  function searchInBlocks(
    blocks: any[],
    targetBlockId: string,
    currentParentId?: string,
  ): boolean {
    if (!Array.isArray(blocks)) return false

    for (const block of blocks) {
      if (block.id === targetBlockId) {
        return currentParentId === parentBlockId
      }

      if (block.children && Array.isArray(block.children)) {
        if (searchInBlocks(block.children, targetBlockId, block.id)) {
          return true
        }
      }
    }

    return false
  }

  return searchInBlocks(content, blockId)
}

export function filterOutChildBlocks(
  blocks: any[],
  content: CustomBlock[],
): any[] {
  const blockIds = blocks.map((b) => b.blockId)

  const filtered = blocks.filter((block) => {
    const isChild = blockIds.some(
      (otherBlockId) =>
        otherBlockId !== block.blockId &&
        isBlockChildOf(block.blockId, otherBlockId, content),
    )

    return !isChild
  })

  return filtered
}
