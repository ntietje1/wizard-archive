import { CustomBlock } from '../notes/editorSpecs'
import { Id, TableNames } from '../_generated/dataModel'
import { MutationCtx } from '../_generated/server'
import {
  Tag,
  CATEGORY_KIND,
  TagCategory,
  SYSTEM_TAG_CATEGORY_NAMES,
} from './types'
import { Block } from '../notes/types'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { Ctx } from '../common/types'
import { deleteNote } from '../notes/helpers'

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
  };
  return {
    ...combined,
    [idKey]: entity._id,
  } as TCombined;
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

  return { ...tag, category }
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

export async function getTagCategoryByName(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  name: string,
): Promise<TagCategory> {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const existing = await ctx.db
    .query('tagCategories')
    .withIndex('by_campaign_name', (q) =>
      q.eq('campaignId', campaignId).eq('name', name.toLowerCase()),
    )
    .unique()

  if (!existing) {
    throw new Error('Category not found')
  }

  return existing
}

export const insertTagAndNote = async (
  ctx: MutationCtx,
  newTag: Omit<
    Tag,
    | '_id'
    | '_creationTime'
    | 'updatedAt'
    | 'name'
    | 'noteId'
    | 'category'
    | 'createdBy'
  >,
  parentFolderId?: Id<'folders'>,
  allowManagedTags: boolean = false,
): Promise<{ tagId: Id<'tags'>; noteId: Id<'notes'> }> => {
  const { identityWithProfile } = await requireCampaignMembership(
    ctx,
    { campaignId: newTag.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )
  const { profile } = identityWithProfile

  const tagId = await insertTag(ctx, newTag, allowManagedTags)

  const noteId = await ctx.db.insert('notes', {
    userId: profile.userId,
    name: newTag.displayName,
    campaignId: newTag.campaignId,
    updatedAt: Date.now(),
    categoryId: newTag.categoryId,
    tagId: tagId,
    parentFolderId: parentFolderId,
  })

  return { tagId, noteId }
}

export const insertTag = async (
  ctx: MutationCtx,
  newTag: Omit<
    Tag,
    '_id' | '_creationTime' | 'updatedAt' | 'name' | 'category' | 'createdBy'
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

  const existing = await ctx.db
    .query('tags')
    .withIndex('by_campaign_name', (q) =>
      q
        .eq('campaignId', newTag.campaignId)
        .eq('name', newTag.displayName.toLowerCase()),
    )
    .unique()
  if (existing) {
    throw new Error('Tag already exists')
  }

  const tagId = await ctx.db.insert('tags', {
    displayName: newTag.displayName,
    name: newTag.displayName.toLowerCase(),
    categoryId: newTag.categoryId,
    color: newTag.color,
    description: newTag.description,
    campaignId: newTag.campaignId,
    updatedAt: Date.now(),
    createdBy: campaignWithMembership.member._id,
  })

  return tagId
}

export async function ensureDefaultTagCategories(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
): Promise<Id<'tagCategories'>[]> {
  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const defaults = [
    {
      displayName: SYSTEM_TAG_CATEGORY_NAMES.Character,
      kind: CATEGORY_KIND.SystemCore,
    },
    {
      displayName: SYSTEM_TAG_CATEGORY_NAMES.Location,
      kind: CATEGORY_KIND.SystemCore,
    },
    {
      displayName: SYSTEM_TAG_CATEGORY_NAMES.Session,
      kind: CATEGORY_KIND.SystemCore,
    },
    {
      displayName: SYSTEM_TAG_CATEGORY_NAMES.Shared,
      kind: CATEGORY_KIND.SystemManaged,
    },
  ]

  const existing = await ctx.db
    .query('tagCategories')
    .withIndex('by_campaign_name', (q) => q.eq('campaignId', campaignId))
    .collect()

  const existingByName = new Map(existing.map((c) => [c.displayName, c]))
  const ids: Id<'tagCategories'>[] = []
  for (const d of defaults) {
    const found = existingByName.get(d.displayName)
    if (found) {
      ids.push(found._id)
    } else {
      const id = await insertTagCategory(
        ctx,
        {
          campaignId,
          kind: d.kind,
          displayName: d.displayName,
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
    { campaignId: campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const categories = await ctx.db
    .query('tagCategories')
    .withIndex('by_campaign_name', (q) => q.eq('campaignId', campaignId))
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
    return { ...t, category }
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
    .withIndex('by_campaign_categoryId', (q) =>
      q.eq('campaignId', category.campaignId).eq('categoryId', categoryId),
    )
    .collect()
  return tags.map((t) => ({ ...t, category }))
}

export async function insertTagCategory(
  ctx: MutationCtx,
  input: Omit<
    TagCategory,
    '_id' | '_creationTime' | 'updatedAt' | 'name' | 'createdBy'
  >,
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

  const existing = await ctx.db
    .query('tagCategories')
    .withIndex('by_campaign_name', (q) =>
      q
        .eq('campaignId', input.campaignId)
        .eq('name', input.displayName.toLowerCase()),
    )
    .unique()
  if (existing) {
    throw new Error('Category already exists')
  }

  if (!allowSystem && input.kind !== CATEGORY_KIND.User) {
    throw new Error('Invalid kind')
  }

  const id = await ctx.db.insert('tagCategories', {
    updatedAt: Date.now(),
    campaignId: input.campaignId,
    name: input.displayName.toLowerCase(),
    displayName: input.displayName,
    kind: input.kind,
    createdBy: campaignWithMembership.member._id,
  })
  return id
}

export const updateTagCategory = async (
  ctx: MutationCtx,
  categoryId: Id<'tagCategories'>,
  input: {
    displayName?: string
  },
) => {
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

  if (input.displayName !== undefined) {
    const next = input.displayName.toLowerCase()
    const existing = await ctx.db
      .query('tagCategories')
      .withIndex('by_campaign_name', (q) =>
        q.eq('campaignId', category.campaignId).eq('name', next),
      )
      .unique()
    if (existing && existing._id !== categoryId) {
      throw new Error('Category already exists')
    }
    updates.name = next
    updates.displayName = input.displayName
  }

  await ctx.db.patch(categoryId, updates)
  return categoryId
}

export const updateTagAndContent = async (
  ctx: MutationCtx,
  tagId: Id<'tags'>,
  input: {
    displayName?: string
    color?: string
    description?: string
  },
) => {
  const tag = await ctx.db.get(tagId)
  if (!tag) {
    throw new Error('Tag not found')
  }

  const tagNote = await ctx.db
    .query('notes')
    .withIndex('by_campaign_category_tag', (q) =>
      q
        .eq('campaignId', tag.campaignId)
        .eq('categoryId', tag.categoryId)
        .eq('tagId', tagId),
    )
    .unique()

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

  const updates: Partial<Tag> = {
    updatedAt: Date.now(),
  }

  if (input.displayName !== undefined) {
    const next = input.displayName.toLowerCase()
    const existing = await ctx.db
      .query('tags')
      .withIndex('by_campaign_name', (q) =>
        q.eq('campaignId', tag.campaignId).eq('name', next),
      )
      .unique()
    if (existing && existing._id !== tagId) {
      throw new Error('Tag already exists')
    }
    updates.name = input.displayName.toLowerCase()
    updates.displayName = input.displayName
  }
  if (input.color !== undefined) {
    updates.color = input.color
  }
  if (input.description !== undefined) {
    updates.description = input.description
  }

  await ctx.db.patch(tagId, updates)

  if (updates.displayName !== undefined && tagNote) {
    await ctx.db.patch(tagNote._id, {
      name: updates.displayName,
      updatedAt: Date.now(),
    })
  }

  if (updates.displayName !== undefined || updates.color !== undefined) {
    const newDisplayName = updates.displayName
    const newColor = updates.color

    const allBlocks = await ctx.db
      .query('blocks')
      .withIndex('by_campaign_note_toplevel_pos', (q) =>
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
              tagName: newDisplayName ?? content.props.tagName,
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

  const note = await ctx.db
    .query('notes')
    .withIndex('by_campaign_category_tag', (q) =>
      q
        .eq('campaignId', tag.campaignId)
        .eq('categoryId', tag.categoryId)
        .eq('tagId', tagId),
    )
    .unique()

  if (note) {
    await deleteNote(ctx, note._id)
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
    .withIndex('by_campaign_categoryId', (q) =>
      q.eq('campaignId', category.campaignId).eq('categoryId', categoryId),
    )
    .collect()
  if (tags.length > 0) {
    throw new Error('Cannot delete category with existing tags')
  }

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

  if (!note.tagId) {
    return null
  }

  const tag = await ctx.db.get(note.tagId)

  if (!tag) {
    return null
  }

  const category = await ctx.db.get(tag.categoryId)
  if (!category) {
    throw new Error('Category not found')
  }

  return { ...tag, category }
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

  if (!note.tagId) {
    return null
  }

  const tag = await ctx.db.get(note.tagId)
  if (!tag) {
    throw new Error('Tag not found')
  }

  const category = await ctx.db.get(tag.categoryId)
  if (!category) {
    throw new Error('Category not found')
  }

  return { ...tag, category }
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

  const block = (await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q
        .eq('campaignId', note.campaignId)
        .eq('noteId', noteId)
        .eq('blockId', blockId),
    )
    .unique()) as Block | null

  return block
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

export async function addTagToBlock(
  ctx: MutationCtx,
  blockDbId: Id<'blocks'>,
  tagId: Id<'tags'>,
) {
  const block = await ctx.db.get(blockDbId)
  if (!block) {
    throw new Error('Block not found')
  }

  const existing = await ctx.db
    .query('blockTags')
    .withIndex('by_campaign_block_tag', (q) =>
      q
        .eq('campaignId', block.campaignId)
        .eq('blockId', blockDbId)
        .eq('tagId', tagId),
    )
    .unique()

  if (!existing) {
    await ctx.db.insert('blockTags', {
      campaignId: block.campaignId,
      blockId: blockDbId,
      tagId: tagId,
    })

    await ctx.db.patch(blockDbId, {
      updatedAt: Date.now(),
    })
  }
  return blockDbId
}

export async function removeTagFromBlock(
  ctx: MutationCtx,
  blockDbId: Id<'blocks'>,
  tagIdToRemove: Id<'tags'>,
  isTopLevel: boolean,
): Promise<Id<'blocks'> | null> {
  const block = await ctx.db.get(blockDbId)
  if (!block) {
    return null
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: block.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const blockTag = await ctx.db
    .query('blockTags')
    .withIndex('by_campaign_block_tag', (q) =>
      q
        .eq('campaignId', block.campaignId)
        .eq('blockId', blockDbId)
        .eq('tagId', tagIdToRemove),
    )
    .unique()

  if (blockTag) {
    await ctx.db.delete(blockTag._id)
  }

  const remainingTags = await getBlockLevelTags(ctx, blockDbId)
  if (remainingTags.length === 0 && !isTopLevel) {
    await ctx.db.delete(blockDbId)
    return null
  } else {
    await ctx.db.patch(blockDbId, {
      updatedAt: Date.now(),
    })
  }

  return blockDbId
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
            block: block,
            tagIds,
            isTopLevel: isTopLevel,
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

function computeTopLevelPositions(
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

async function upsertBlock(
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

async function updateBlockTags(
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
      campaignId: campaignId,
      blockId: finalBlockDbId,
      tagId: tagId,
    })
  }
}

async function insertInlineBlockTags(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  finalBlockDbId: Id<'blocks'>,
  inlineTagIds: Id<'tags'>[],
): Promise<void> {
  const finalTagIds = [...new Set([...inlineTagIds])]
  for (const tagId of finalTagIds) {
    await ctx.db.insert('blockTags', {
      campaignId: campaignId,
      blockId: finalBlockDbId,
      tagId: tagId,
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

async function cleanupUnprocessedBlocks(
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

export async function saveTopLevelBlocks(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
  content: CustomBlock[],
) {
  const now = Date.now()

  const note = await ctx.db.get(noteId)
  if (!note) return

  const noteLevelTag = note.tagId ? await ctx.db.get(note.tagId) : null

  const allBlocksWithTags = extractAllBlocksWithTags(
    content,
    noteLevelTag?._id || null,
  )

  const existingBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_toplevel_pos', (q) =>
      q.eq('campaignId', note.campaignId).eq('noteId', noteId),
    )
    .collect()

  const existingBlocksMap = new Map(
    existingBlocks.map((block) => [block.blockId, block]),
  )

  const processedBlockIds = new Set<string>()
  const positions = computeTopLevelPositions(allBlocksWithTags)

  for (const [
    blockId,
    { block, tagIds: inlineTagIds, isTopLevel },
  ] of allBlocksWithTags) {
    processedBlockIds.add(blockId)
    const existingBlock = existingBlocksMap.get(blockId)

    const finalBlockDbId = await upsertBlock(ctx, existingBlock, {
      noteId,
      campaignId: note.campaignId,
      blockId,
      isTopLevel,
      position: isTopLevel ? positions.get(blockId) : undefined,
      content: block,
      now,
    })

    if (existingBlock) {
      await updateBlockTags(
        ctx,
        note.campaignId,
        finalBlockDbId,
        existingBlock.content,
        inlineTagIds,
      )
    } else {
      await insertInlineBlockTags(
        ctx,
        note.campaignId,
        finalBlockDbId,
        inlineTagIds,
      )
    }
  }

  await cleanupUnprocessedBlocks(
    ctx,
    existingBlocks,
    processedBlockIds,
    content,
    now,
  )
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
