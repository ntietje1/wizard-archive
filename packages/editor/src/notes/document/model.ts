import type { z } from 'zod'
import { z as zod } from 'zod'
import { noteValuePropsSchema } from '../values/schema'
import { parseSerializedAuthoredDestination } from '../../resources/authored-destination'
import { isUuidV7 } from '../../resources/domain-id'
import type { NoteBlockId } from '../../resources/domain-id'
import {
  COMMON_RICH_TEXT_BLOCK_TYPES,
  createCommonRichTextBlockContentSchemas,
  createRichTextBlockSchema,
  defaultRichTextPropsSchema,
  enforceUniqueRichTextBlockIdentities,
  richTextTextSchema,
} from '../../rich-text/blocknote/common-model'
import type { CommonRichTextBlockContent } from '../../rich-text/blocknote/common-model'

export const NOTE_BLOCK_TYPE_VALUES = [
  ...COMMON_RICH_TEXT_BLOCK_TYPES,
  'toggleListItem',
  'divider',
  'embed',
  'table',
] as const

export type NoteBlockType = (typeof NOTE_BLOCK_TYPE_VALUES)[number]

const valueInlineContentSchema = zod.strictObject({
  type: zod.literal('value'),
  props: noteValuePropsSchema,
})

const inlineContentSchema = zod.discriminatedUnion('type', [
  richTextTextSchema,
  valueInlineContentSchema,
])

const tableCellSchema = zod.strictObject({
  type: zod.literal('tableCell'),
  content: zod.array(inlineContentSchema),
  props: zod
    .strictObject({
      colspan: zod.number().optional(),
      rowspan: zod.number().optional(),
      textColor: zod.string().optional(),
      backgroundColor: zod.string().optional(),
      textAlignment: zod.enum(['left', 'center', 'right', 'justify']).optional(),
    })
    .optional(),
})

const tableContentSchema = zod.strictObject({
  type: zod.literal('tableContent'),
  columnWidths: zod.array(zod.number().nullable()),
  headerRows: zod.number().optional(),
  headerCols: zod.number().optional(),
  rows: zod.array(
    zod.strictObject({
      cells: zod.array(tableCellSchema),
    }),
  ),
})

const commonBlockContentSchemas = createCommonRichTextBlockContentSchemas(inlineContentSchema)
const inlineContent = zod.array(inlineContentSchema).optional()

const embedSharedPropsSchema = {
  destination: zod.string().refine((value) => parseSerializedAuthoredDestination(value) !== null),
  backgroundColor: zod.string().optional(),
  textAlignment: zod.enum(['left', 'center', 'right', 'justify']).optional(),
  previewWidth: zod.number().positive().optional(),
  previewHeight: zod.number().positive().optional(),
  previewAspectRatio: zod.number().positive().optional(),
}

const embedPropsSchema = zod.strictObject(embedSharedPropsSchema)

const tablePropsSchema = zod.strictObject({
  textColor: zod.string().optional(),
})

const toggleListItemBlockContentSchema = zod.strictObject({
  type: zod.literal('toggleListItem'),
  props: defaultRichTextPropsSchema,
  content: inlineContent,
})

const dividerBlockContentSchema = zod.strictObject({
  type: zod.literal('divider'),
  props: zod.strictObject({}),
  content: inlineContent,
})

const embedBlockContentSchema = zod.strictObject({
  type: zod.literal('embed'),
  props: embedPropsSchema,
  content: zod.undefined().optional(),
})

const tableBlockContentSchema = zod.strictObject({
  type: zod.literal('table'),
  props: tablePropsSchema,
  content: tableContentSchema.optional(),
})

type InlineContentItem = z.infer<typeof inlineContentSchema>
const allFlatBlockContentSchemas = [
  ...commonBlockContentSchemas,
  toggleListItemBlockContentSchema,
  dividerBlockContentSchema,
  embedBlockContentSchema,
  tableBlockContentSchema,
] as const

type NoteExtensionBlockContent = z.infer<
  | typeof toggleListItemBlockContentSchema
  | typeof dividerBlockContentSchema
  | typeof embedBlockContentSchema
  | typeof tableBlockContentSchema
>
export type NoteBlockContent =
  | CommonRichTextBlockContent<InlineContentItem>
  | NoteExtensionBlockContent
export const noteBlockContentSchema = zod.discriminatedUnion(
  'type',
  allFlatBlockContentSchemas,
) as z.ZodType<NoteBlockContent>

export type InlineContent = Array<InlineContentItem>
export type TableContent = z.infer<typeof tableContentSchema>
export type NoteBlock = z.infer<typeof noteBlockSchema>
export type PartialNoteBlock = z.infer<typeof partialBlockNoteBlockSchema>

const noteBlockIdSchema = zod.custom<NoteBlockId>(
  (value) => typeof value === 'string' && isUuidV7(value),
  'Expected a lowercase UUIDv7 note block id',
)

type NoteBlockNode = NoteBlockContent & {
  id: z.infer<typeof noteBlockIdSchema>
  children?: Array<NoteBlockNode>
}

export const noteBlockSchema = createRichTextBlockSchema<NoteBlockNode>(
  allFlatBlockContentSchemas,
  noteBlockIdSchema,
)

export const noteDocumentSchema = zod
  .array(noteBlockSchema)
  .min(1)
  .superRefine(enforceUniqueRichTextBlockIdentities)
  .superRefine(enforceUniqueNoteDocumentIdentities)

type PartialFlatBlockContent = {
  [Type in NoteBlockContent['type']]: Omit<
    Extract<NoteBlockContent, { type: Type }>,
    'props' | 'content'
  > & {
    props?: Extract<NoteBlockContent, { type: Type }>['props']
    content?: Extract<NoteBlockContent, { type: Type }>['content']
  }
}[NoteBlockContent['type']]

type PartialNoteBlockNode = PartialFlatBlockContent & {
  id?: z.infer<typeof noteBlockIdSchema>
  children?: Array<PartialNoteBlockNode>
}

function createPartialBlockSchema(
  schemas: ReadonlyArray<z.ZodObject<{ type: z.ZodLiteral<string> } & z.ZodRawShape>>,
): z.ZodType<PartialNoteBlockNode> {
  let partialBlockNodeSchema: z.ZodType<PartialNoteBlockNode> | null = null
  const partialBlockSchema: z.ZodType<PartialNoteBlockNode> = zod.lazy(() => {
    partialBlockNodeSchema ??= createPartialBlockNodeSchema(schemas, partialBlockSchema)
    return partialBlockNodeSchema
  })

  return partialBlockSchema
}

function createPartialBlockNodeSchema(
  schemas: ReadonlyArray<z.ZodObject<{ type: z.ZodLiteral<string> } & z.ZodRawShape>>,
  partialBlockSchema: z.ZodType<PartialNoteBlockNode>,
): z.ZodType<PartialNoteBlockNode> {
  if (schemas.length < 2) {
    throw new Error(
      `createPartialBlockSchema requires at least 2 block types, got ${schemas.length}`,
    )
  }

  const options = schemas.map((schema) =>
    zod.strictObject({
      ...schema.shape,
      props: zod.optional(schema.shape.props),
      content:
        'content' in schema.shape ? zod.optional(schema.shape.content) : zod.undefined().optional(),
      id: noteBlockIdSchema.optional(),
      children: zod.array(partialBlockSchema).optional(),
    }),
  )

  const [first, second, ...rest] = options
  return zod.discriminatedUnion('type', [first, second, ...rest]) as z.ZodType<PartialNoteBlockNode>
}

const partialBlockNoteBlockSchema = createPartialBlockSchema(allFlatBlockContentSchemas)

export const partialNoteDocumentSchema = zod
  .array(partialBlockNoteBlockSchema)
  .min(1)
  .superRefine(enforceUniqueRichTextBlockIdentities)
  .superRefine(enforceUniqueNoteDocumentIdentities)

function enforceUniqueNoteDocumentIdentities(
  blocks: ReadonlyArray<PartialNoteBlockNode>,
  context: z.RefinementCtx,
): void {
  const valueIds = new Set<string>()
  const pending = blocks.map((block, index) => ({ block, path: [index] as Array<PropertyKey> }))
  while (pending.length > 0) {
    const { block, path } = pending.pop()!
    enforceUniqueNoteValueIdentities(block.content, [...path, 'content'], valueIds, context)
    block.children?.forEach((child, index) => {
      pending.push({ block: child, path: [...path, 'children', index] })
    })
  }
}

function enforceUniqueNoteValueIdentities(
  content: PartialNoteBlockNode['content'],
  path: Array<PropertyKey>,
  valueIds: Set<string>,
  context: z.RefinementCtx,
): void {
  if (Array.isArray(content)) {
    enforceUniqueInlineValueIdentities(content, path, valueIds, context)
    return
  }
  content?.rows.forEach((row, rowIndex) => {
    row.cells.forEach((cell, cellIndex) => {
      enforceUniqueInlineValueIdentities(
        cell.content,
        [...path, 'rows', rowIndex, 'cells', cellIndex, 'content'],
        valueIds,
        context,
      )
    })
  })
}

function enforceUniqueInlineValueIdentities(
  content: ReadonlyArray<InlineContentItem>,
  path: Array<PropertyKey>,
  valueIds: Set<string>,
  context: z.RefinementCtx,
): void {
  content.forEach((item, index) => {
    if (item.type !== 'value') return
    addUniqueNoteValueIdentity(
      item.props.valueId,
      valueIds,
      [...path, index, 'props', 'valueId'],
      context,
    )
  })
}

function addUniqueNoteValueIdentity(
  value: unknown,
  identities: Set<string>,
  path: Array<PropertyKey>,
  context: z.RefinementCtx,
): void {
  if (typeof value !== 'string') return
  if (identities.has(value)) {
    context.addIssue({ code: 'custom', message: 'Duplicate note value identity', path })
    return
  }
  identities.add(value)
}

export type HeadingLevel = Extract<NoteBlockContent, { type: 'heading' }>['props']['level']

export type Heading = {
  noteBlockId: NoteBlockId
  text: string
  level: HeadingLevel
  normalizedText: string
}
