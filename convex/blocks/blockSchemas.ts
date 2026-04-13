import { z } from 'zod'

// --- Styles & inline content ---

const stylesSchema = z
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

export const inlineContentSchema = styledTextSchema

export const tableContentSchema = z.strictObject({
  type: z.literal('tableContent'),
  columnWidths: z.array(z.number().nullable()),
  headerRows: z.number().optional(),
  headerCols: z.number().optional(),
  rows: z.array(
    z.strictObject({
      cells: z.array(z.array(inlineContentSchema)),
    }),
  ),
})

// --- Block props ---

const textAlignmentSchema = z.enum(['left', 'center', 'right', 'justify']).optional()

const defaultProps = {
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlignment: textAlignmentSchema,
}

const paragraphPropsSchema = z.strictObject({ ...defaultProps })

const headingPropsSchema = z.strictObject({
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

const bulletListItemPropsSchema = z.strictObject({ ...defaultProps })

const numberedListItemPropsSchema = z.strictObject({
  start: z.number().optional(),
  ...defaultProps,
})

const checkListItemPropsSchema = z.strictObject({
  checked: z.boolean().optional(),
  ...defaultProps,
})

const toggleListItemPropsSchema = z.strictObject({ ...defaultProps })

const quotePropsSchema = z.strictObject({
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
})

const codeBlockPropsSchema = z.strictObject({
  language: z.string().optional(),
})

const dividerPropsSchema = z.strictObject({})

const imagePropsSchema = z.strictObject({
  name: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlignment: textAlignmentSchema,
  showPreview: z.boolean().optional(),
  previewWidth: z.number().optional(),
})

const videoPropsSchema = z.strictObject({
  name: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlignment: textAlignmentSchema,
  showPreview: z.boolean().optional(),
  previewWidth: z.number().optional(),
})

const audioPropsSchema = z.strictObject({
  name: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
  showPreview: z.boolean().optional(),
})

const filePropsSchema = z.strictObject({
  name: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
})

const tablePropsSchema = z.strictObject({
  textColor: z.string().optional(),
})

// --- Flat block content (canonical discriminated union) ---

const inlineContent = z.array(inlineContentSchema).optional()

export const flatBlockContentSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('paragraph'),
    props: paragraphPropsSchema,
    content: inlineContent,
  }),
  z.strictObject({ type: z.literal('heading'), props: headingPropsSchema, content: inlineContent }),
  z.strictObject({
    type: z.literal('bulletListItem'),
    props: bulletListItemPropsSchema,
    content: inlineContent,
  }),
  z.strictObject({
    type: z.literal('numberedListItem'),
    props: numberedListItemPropsSchema,
    content: inlineContent,
  }),
  z.strictObject({
    type: z.literal('checkListItem'),
    props: checkListItemPropsSchema,
    content: inlineContent,
  }),
  z.strictObject({
    type: z.literal('toggleListItem'),
    props: toggleListItemPropsSchema,
    content: inlineContent,
  }),
  z.strictObject({ type: z.literal('quote'), props: quotePropsSchema, content: inlineContent }),
  z.strictObject({
    type: z.literal('codeBlock'),
    props: codeBlockPropsSchema,
    content: inlineContent,
  }),
  z.strictObject({ type: z.literal('divider'), props: dividerPropsSchema, content: inlineContent }),
  z.strictObject({ type: z.literal('image'), props: imagePropsSchema, content: inlineContent }),
  z.strictObject({ type: z.literal('video'), props: videoPropsSchema, content: inlineContent }),
  z.strictObject({ type: z.literal('audio'), props: audioPropsSchema, content: inlineContent }),
  z.strictObject({ type: z.literal('file'), props: filePropsSchema, content: inlineContent }),
  z.strictObject({
    type: z.literal('table'),
    props: tablePropsSchema,
    content: tableContentSchema.optional(),
  }),
])

// --- Derived: block type enum ---

const blockTypes = flatBlockContentSchema.options.map((opt) => opt.shape.type.value) as [
  string,
  ...Array<string>,
]
export const blockTypeSchema = z.enum(blockTypes)

// --- BlockNote ID (UUID v4) ---

export const blockNoteIdSchema = z.uuid({ version: 'v4' })

// --- Derived: hierarchical BlockNote schema (adds id + recursive children) ---

type BlockNoteBlock = {
  id: z.infer<typeof blockNoteIdSchema>
  type: z.infer<typeof blockTypeSchema>
  props: z.infer<typeof flatBlockContentSchema>['props']
  content?: Array<z.infer<typeof inlineContentSchema>> | z.infer<typeof tableContentSchema>
  children?: Array<BlockNoteBlock>
}

export const blockNoteBlockSchema: z.ZodType<BlockNoteBlock> = z.lazy(() => {
  const [first, second, ...rest] = flatBlockContentSchema.options.map((opt) =>
    opt.extend({ id: blockNoteIdSchema, children: z.array(blockNoteBlockSchema).optional() }),
  )
  return z.discriminatedUnion('type', [
    first!,
    second!,
    ...rest,
  ]) as unknown as z.ZodType<BlockNoteBlock>
})
