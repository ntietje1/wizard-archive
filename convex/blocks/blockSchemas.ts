import { z } from 'zod'
import { BLOCK_REGISTRY, BLOCK_TYPES, CANVAS_BLOCK_TYPES } from '../../shared/blockRegistry'
import { noteValuePropsSchema } from '../../shared/note-values/schema'
import type { BlockType } from '../../shared/blockRegistry'

// --- Styles & inline content ---

export const stylesSchema = z
  .strictObject({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    strike: z.boolean().optional(),
    code: z.boolean().optional(),
    textColor: z.string().optional(),
    backgroundColor: z.string().optional(),
  })
  .optional()

const styledTextSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string(),
  styles: stylesSchema,
})

export const valuePropsSchema = noteValuePropsSchema

export const valueInlineContentSchema = z.strictObject({
  type: z.literal('value'),
  props: valuePropsSchema,
})

export const inlineContentSchema = z.discriminatedUnion('type', [
  styledTextSchema,
  valueInlineContentSchema,
])

export const tableCellSchema = z.strictObject({
  type: z.literal('tableCell'),
  content: z.array(inlineContentSchema),
  props: z
    .strictObject({
      colspan: z.number().optional(),
      rowspan: z.number().optional(),
      textColor: z.string().optional(),
      backgroundColor: z.string().optional(),
      textAlignment: z.enum(['left', 'center', 'right', 'justify']).optional(),
    })
    .optional(),
})

export const tableContentSchema = z.strictObject({
  type: z.literal('tableContent'),
  columnWidths: z.array(z.number().nullable()),
  headerRows: z.number().optional(),
  headerCols: z.number().optional(),
  rows: z.array(
    z.strictObject({
      cells: z.array(tableCellSchema),
    }),
  ),
})

// --- Block props ---

export const textAlignmentSchema = z.enum(['left', 'center', 'right', 'justify']).optional()

const defaultProps = {
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlignment: textAlignmentSchema,
}

export const paragraphPropsSchema = z.strictObject({ ...defaultProps })

export const headingPropsSchema = z.strictObject({
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  isToggleable: z.boolean().optional(),
  ...defaultProps,
})

export const bulletListItemPropsSchema = paragraphPropsSchema

export const numberedListItemPropsSchema = z.strictObject({
  start: z.number().optional(),
  ...defaultProps,
})

export const checkListItemPropsSchema = z.strictObject({
  checked: z.boolean().optional(),
  ...defaultProps,
})

export const toggleListItemPropsSchema = paragraphPropsSchema

export const quotePropsSchema = paragraphPropsSchema

export const codeBlockPropsSchema = z.strictObject({
  language: z.string().optional(),
})

export const dividerPropsSchema = z.strictObject({})

export const imagePropsSchema = z.strictObject({
  name: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlignment: textAlignmentSchema,
  showPreview: z.boolean().optional(),
  previewWidth: z.number().optional(),
})

export const videoPropsSchema = imagePropsSchema

export const audioPropsSchema = z.strictObject({
  name: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
  showPreview: z.boolean().optional(),
})

export const filePropsSchema = z.strictObject({
  name: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
})

export const tablePropsSchema = z.strictObject({
  textColor: z.string().optional(),
})

const blockPropSchemas = {
  defaultText: paragraphPropsSchema,
  heading: headingPropsSchema,
  numberedListItem: numberedListItemPropsSchema,
  checkListItem: checkListItemPropsSchema,
  codeBlock: codeBlockPropsSchema,
  empty: dividerPropsSchema,
  mediaPreview: imagePropsSchema,
  audio: audioPropsSchema,
  file: filePropsSchema,
  table: tablePropsSchema,
} as const

// --- Flat block content (canonical discriminated union) ---

const inlineContent = z.array(inlineContentSchema).optional()

export const paragraphBlockContentSchema = z.strictObject({
  type: z.literal('paragraph'),
  props: paragraphPropsSchema,
  content: inlineContent,
})

export const headingBlockContentSchema = z.strictObject({
  type: z.literal('heading'),
  props: headingPropsSchema,
  content: inlineContent,
})

export const bulletListItemBlockContentSchema = z.strictObject({
  type: z.literal('bulletListItem'),
  props: bulletListItemPropsSchema,
  content: inlineContent,
})

export const numberedListItemBlockContentSchema = z.strictObject({
  type: z.literal('numberedListItem'),
  props: numberedListItemPropsSchema,
  content: inlineContent,
})

export const checkListItemBlockContentSchema = z.strictObject({
  type: z.literal('checkListItem'),
  props: checkListItemPropsSchema,
  content: inlineContent,
})

export const toggleListItemBlockContentSchema = z.strictObject({
  type: z.literal('toggleListItem'),
  props: toggleListItemPropsSchema,
  content: inlineContent,
})

export const quoteBlockContentSchema = z.strictObject({
  type: z.literal('quote'),
  props: quotePropsSchema,
  content: inlineContent,
})

export const codeBlockBlockContentSchema = z.strictObject({
  type: z.literal('codeBlock'),
  props: codeBlockPropsSchema,
  content: inlineContent,
})

export const dividerBlockContentSchema = z.strictObject({
  type: z.literal('divider'),
  props: dividerPropsSchema,
  content: inlineContent,
})

export const imageBlockContentSchema = z.strictObject({
  type: z.literal('image'),
  props: imagePropsSchema,
  content: inlineContent,
})

export const videoBlockContentSchema = z.strictObject({
  type: z.literal('video'),
  props: videoPropsSchema,
  content: inlineContent,
})

export const audioBlockContentSchema = z.strictObject({
  type: z.literal('audio'),
  props: audioPropsSchema,
  content: inlineContent,
})

export const fileBlockContentSchema = z.strictObject({
  type: z.literal('file'),
  props: filePropsSchema,
  content: inlineContent,
})

export const tableBlockContentSchema = z.strictObject({
  type: z.literal('table'),
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
  image: imageBlockContentSchema,
  video: videoBlockContentSchema,
  audio: audioBlockContentSchema,
  file: fileBlockContentSchema,
  table: tableBlockContentSchema,
} satisfies Record<BlockType, z.ZodObject>

type FlatBlockContentSchema = (typeof blockContentSchemasByType)[BlockType]

const allFlatBlockContentSchemas = BLOCK_REGISTRY.map((entry) => {
  const schema = blockContentSchemasByType[entry.type]
  const propSchema = blockPropSchemas[entry.props]
  if (schema.shape.props !== propSchema) {
    throw new Error(`Block registry prop kind mismatch for ${entry.type}`)
  }
  return schema
}) as unknown as [
  typeof paragraphBlockContentSchema,
  typeof headingBlockContentSchema,
  ...Array<FlatBlockContentSchema>,
]

export const flatBlockContentSchema = z.discriminatedUnion('type', allFlatBlockContentSchemas)

const canvasFlatBlockContentSchemas = BLOCK_REGISTRY.filter((entry) => entry.canvas).map(
  (entry) => blockContentSchemasByType[entry.type],
) as unknown as [
  typeof paragraphBlockContentSchema,
  typeof headingBlockContentSchema,
  ...Array<FlatBlockContentSchema>,
]

export const canvasAllowedBlockTypes = CANVAS_BLOCK_TYPES

export const canvasFlatBlockContentSchema = z.discriminatedUnion(
  'type',
  canvasFlatBlockContentSchemas,
)

// --- Derived: block type enum ---

export const blockTypeSchema = z.enum(BLOCK_TYPES)

export const canvasBlockTypeSchema = z.enum(canvasAllowedBlockTypes)

// --- BlockNote ID ---

export const blockNoteIdSchema = z.string().min(1)

// --- Derived: hierarchical BlockNote schema (adds id + recursive children) ---

type FlatBlockContent = z.infer<typeof flatBlockContentSchema>

type BlockNoteBlock = FlatBlockContent & {
  id: z.infer<typeof blockNoteIdSchema>
  children?: Array<BlockNoteBlock>
}

export const blockNoteBlockSchema: z.ZodType<BlockNoteBlock> = z.lazy(() => {
  const options = flatBlockContentSchema.options.map((opt) =>
    opt.extend({ id: blockNoteIdSchema, children: z.array(blockNoteBlockSchema).optional() }),
  )
  if (options.length < 2) {
    throw new Error(`blockNoteBlockSchema requires at least 2 block types, got ${options.length}`)
  }
  return z.discriminatedUnion(
    'type',
    options as [(typeof options)[0], (typeof options)[1], ...typeof options],
  ) as z.ZodType<BlockNoteBlock>
})

type PartialFlatBlockContent = {
  [Type in FlatBlockContent['type']]: Omit<
    Extract<FlatBlockContent, { type: Type }>,
    'props' | 'content'
  > & {
    props?: Extract<FlatBlockContent, { type: Type }>['props']
    content?: Extract<FlatBlockContent, { type: Type }>['content']
  }
}[FlatBlockContent['type']]

type PartialBlockNoteBlock = PartialFlatBlockContent & {
  id?: z.infer<typeof blockNoteIdSchema>
  children?: Array<PartialBlockNoteBlock>
}

function createPartialBlockSchema(
  schemas: ReadonlyArray<FlatBlockContentSchema>,
): z.ZodType<PartialBlockNoteBlock> {
  const partialBlockSchema: z.ZodType<PartialBlockNoteBlock> = z.lazy(() => {
    if (schemas.length < 2) {
      throw new Error(
        `createPartialBlockSchema requires at least 2 block types, got ${schemas.length}`,
      )
    }

    const options = schemas.map((schema) =>
      z.strictObject({
        ...schema.shape,
        props: schema.shape.props.optional(),
        content: 'content' in schema.shape ? schema.shape.content : z.undefined().optional(),
        id: blockNoteIdSchema.optional(),
        children: z.array(partialBlockSchema).optional(),
      }),
    )

    const [first, second, ...rest] = options
    return z.discriminatedUnion('type', [
      first,
      second,
      ...rest,
    ]) as z.ZodType<PartialBlockNoteBlock>
  })

  return partialBlockSchema
}

export const partialBlockNoteBlockSchema = createPartialBlockSchema(allFlatBlockContentSchemas)

export const canvasPartialBlockNoteBlockSchema = createPartialBlockSchema(
  canvasFlatBlockContentSchemas,
)

export const partialBlockNoteDocumentSchema = z.array(partialBlockNoteBlockSchema)

export const canvasPartialBlockNoteDocumentSchema = z.array(canvasPartialBlockNoteBlockSchema)

export type CanvasRichTextDocument = z.infer<typeof canvasPartialBlockNoteDocumentSchema>

export function parseCanvasRichTextDocument(value: unknown): CanvasRichTextDocument | null {
  const result = canvasPartialBlockNoteDocumentSchema.safeParse(value)
  return result.success ? result.data : null
}
