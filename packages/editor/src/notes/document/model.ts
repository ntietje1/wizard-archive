import type { z } from 'zod'
import { z as zod } from 'zod'
import { noteValuePropsSchema } from '../values/schema'
import { parseSerializedAuthoredDestination } from '../../resources/authored-destination'
import { isUuidV7 } from '../../resources/domain-id'
import type { NoteBlockId } from '../../resources/domain-id'

export const NOTE_BLOCK_REGISTRY = [
  { type: 'paragraph', props: 'defaultText', content: 'inline' },
  { type: 'heading', props: 'heading', content: 'inline' },
  { type: 'bulletListItem', props: 'defaultText', content: 'inline' },
  { type: 'numberedListItem', props: 'numberedListItem', content: 'inline' },
  { type: 'checkListItem', props: 'checkListItem', content: 'inline' },
  { type: 'toggleListItem', props: 'defaultText', content: 'inline' },
  { type: 'quote', props: 'defaultText', content: 'inline' },
  { type: 'codeBlock', props: 'codeBlock', content: 'inline' },
  { type: 'divider', props: 'empty', content: 'inline' },
  { type: 'embed', props: 'embed', content: 'none' },
  { type: 'table', props: 'table', content: 'table' },
] as const

export const NOTE_BLOCK_TYPE_VALUES = NOTE_BLOCK_REGISTRY.map((entry) => entry.type) as [
  (typeof NOTE_BLOCK_REGISTRY)[0]['type'],
  (typeof NOTE_BLOCK_REGISTRY)[1]['type'],
  ...Array<(typeof NOTE_BLOCK_REGISTRY)[number]['type']>,
]

export type NoteBlockType = (typeof NOTE_BLOCK_REGISTRY)[number]['type']

const stylesSchema = zod
  .strictObject({
    bold: zod.boolean().optional(),
    italic: zod.boolean().optional(),
    underline: zod.boolean().optional(),
    strike: zod.boolean().optional(),
    code: zod.boolean().optional(),
    textColor: zod.string().optional(),
    backgroundColor: zod.string().optional(),
  })
  .optional()

const styledTextSchema = zod.strictObject({
  type: zod.literal('text'),
  text: zod.string(),
  styles: stylesSchema,
})

const valueInlineContentSchema = zod.strictObject({
  type: zod.literal('value'),
  props: noteValuePropsSchema,
})

const inlineContentSchema = zod.discriminatedUnion('type', [
  styledTextSchema,
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

const textAlignmentSchema = zod.enum(['left', 'center', 'right', 'justify']).optional()

const defaultProps = {
  textColor: zod.string().optional(),
  backgroundColor: zod.string().optional(),
  textAlignment: textAlignmentSchema,
}

const paragraphPropsSchema = zod.strictObject({ ...defaultProps })

export const headingPropsSchema = zod.strictObject({
  level: zod.union([
    zod.literal(1),
    zod.literal(2),
    zod.literal(3),
    zod.literal(4),
    zod.literal(5),
    zod.literal(6),
  ]),
  isToggleable: zod.boolean().optional(),
  ...defaultProps,
})

const bulletListItemPropsSchema = paragraphPropsSchema

const numberedListItemPropsSchema = zod.strictObject({
  start: zod.number().optional(),
  ...defaultProps,
})

const checkListItemPropsSchema = zod.strictObject({
  checked: zod.boolean().optional(),
  ...defaultProps,
})

const toggleListItemPropsSchema = paragraphPropsSchema

const quotePropsSchema = paragraphPropsSchema

const codeBlockPropsSchema = zod.strictObject({
  language: zod.string().optional(),
})

const dividerPropsSchema = zod.strictObject({})

const embedSharedPropsSchema = {
  destination: zod.string().refine((value) => parseSerializedAuthoredDestination(value) !== null),
  backgroundColor: zod.string().optional(),
  textAlignment: textAlignmentSchema,
  previewWidth: zod.number().positive().optional(),
  previewHeight: zod.number().positive().optional(),
  previewAspectRatio: zod.number().positive().optional(),
}

const embedPropsSchema = zod.strictObject(embedSharedPropsSchema)

const tablePropsSchema = zod.strictObject({
  textColor: zod.string().optional(),
})

const blockPropSchemas = {
  defaultText: paragraphPropsSchema,
  heading: headingPropsSchema,
  numberedListItem: numberedListItemPropsSchema,
  checkListItem: checkListItemPropsSchema,
  codeBlock: codeBlockPropsSchema,
  empty: dividerPropsSchema,
  embed: embedPropsSchema,
  table: tablePropsSchema,
} as const

const inlineContent = zod.array(inlineContentSchema).optional()

const paragraphBlockContentSchema = zod.strictObject({
  type: zod.literal('paragraph'),
  props: paragraphPropsSchema,
  content: inlineContent,
})

const headingBlockContentSchema = zod.strictObject({
  type: zod.literal('heading'),
  props: headingPropsSchema,
  content: inlineContent,
})

const bulletListItemBlockContentSchema = zod.strictObject({
  type: zod.literal('bulletListItem'),
  props: bulletListItemPropsSchema,
  content: inlineContent,
})

const numberedListItemBlockContentSchema = zod.strictObject({
  type: zod.literal('numberedListItem'),
  props: numberedListItemPropsSchema,
  content: inlineContent,
})

const checkListItemBlockContentSchema = zod.strictObject({
  type: zod.literal('checkListItem'),
  props: checkListItemPropsSchema,
  content: inlineContent,
})

const toggleListItemBlockContentSchema = zod.strictObject({
  type: zod.literal('toggleListItem'),
  props: toggleListItemPropsSchema,
  content: inlineContent,
})

const quoteBlockContentSchema = zod.strictObject({
  type: zod.literal('quote'),
  props: quotePropsSchema,
  content: inlineContent,
})

const codeBlockBlockContentSchema = zod.strictObject({
  type: zod.literal('codeBlock'),
  props: codeBlockPropsSchema,
  content: inlineContent,
})

const dividerBlockContentSchema = zod.strictObject({
  type: zod.literal('divider'),
  props: dividerPropsSchema,
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

const blockContentSchemasByType = {
  paragraph: paragraphBlockContentSchema,
  heading: headingBlockContentSchema,
  bulletListItem: bulletListItemBlockContentSchema,
  numberedListItem: numberedListItemBlockContentSchema,
  checkListItem: checkListItemBlockContentSchema,
  toggleListItem: toggleListItemBlockContentSchema,
  quote: quoteBlockContentSchema,
  codeBlock: codeBlockBlockContentSchema,
  divider: dividerBlockContentSchema,
  embed: embedBlockContentSchema,
  table: tableBlockContentSchema,
} satisfies Record<NoteBlockType, z.ZodObject>

type NoteBlockContentSchema = (typeof blockContentSchemasByType)[NoteBlockType]

const allFlatBlockContentSchemas = NOTE_BLOCK_REGISTRY.map((entry) => {
  const schema = blockContentSchemasByType[entry.type]
  const propSchema = blockPropSchemas[entry.props]
  if (schema.shape.props !== propSchema) {
    throw new Error(`Block registry prop kind mismatch for ${entry.type}`)
  }
  return schema
}) as unknown as [
  typeof paragraphBlockContentSchema,
  typeof headingBlockContentSchema,
  ...Array<NoteBlockContentSchema>,
]

export const noteBlockContentSchema = zod.discriminatedUnion('type', allFlatBlockContentSchemas)

export type NoteBlockContent = z.infer<typeof noteBlockContentSchema>
type InlineContentItem = z.infer<typeof inlineContentSchema>
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

let noteBlockNodeSchema: z.ZodType<NoteBlockNode> | null = null

export const noteBlockSchema: z.ZodType<NoteBlockNode> = zod.lazy(() => {
  noteBlockNodeSchema ??= createNoteBlockNodeSchema()
  return noteBlockNodeSchema
})

function createNoteBlockNodeSchema(): z.ZodType<NoteBlockNode> {
  const options = noteBlockContentSchema.options.map(
    (opt: (typeof noteBlockContentSchema.options)[number]) =>
      opt.extend({ id: noteBlockIdSchema, children: zod.array(noteBlockSchema).optional() }),
  )
  if (options.length < 2) {
    throw new Error(`noteBlockSchema requires at least 2 block types, got ${options.length}`)
  }
  return zod.discriminatedUnion(
    'type',
    options as [(typeof options)[0], (typeof options)[1], ...typeof options],
  ) as z.ZodType<NoteBlockNode>
}

export const noteDocumentSchema = zod.array(noteBlockSchema)

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
  schemas: ReadonlyArray<NoteBlockContentSchema>,
): z.ZodType<PartialNoteBlockNode> {
  let partialBlockNodeSchema: z.ZodType<PartialNoteBlockNode> | null = null
  const partialBlockSchema: z.ZodType<PartialNoteBlockNode> = zod.lazy(() => {
    partialBlockNodeSchema ??= createPartialBlockNodeSchema(schemas, partialBlockSchema)
    return partialBlockNodeSchema
  })

  return partialBlockSchema
}

function createPartialBlockNodeSchema(
  schemas: ReadonlyArray<NoteBlockContentSchema>,
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
      props: schema.shape.props.optional(),
      content: 'content' in schema.shape ? schema.shape.content : zod.undefined().optional(),
      id: noteBlockIdSchema.optional(),
      children: zod.array(partialBlockSchema).optional(),
    }),
  )

  const [first, second, ...rest] = options
  return zod.discriminatedUnion('type', [first, second, ...rest]) as z.ZodType<PartialNoteBlockNode>
}

const partialBlockNoteBlockSchema = createPartialBlockSchema(allFlatBlockContentSchemas)

export const partialNoteDocumentSchema = zod.array(partialBlockNoteBlockSchema)

export type HeadingLevel = Extract<NoteBlockContent, { type: 'heading' }>['props']['level']

export type Heading = {
  noteBlockId: NoteBlockId
  text: string
  level: HeadingLevel
  normalizedText: string
}
