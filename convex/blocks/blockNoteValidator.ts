import { z } from 'zod'
import { zodToConvex } from 'convex-helpers/server/zod4'

// --- Styles ---

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

// --- Inline Content ---
// Link inline content is removed in our editor schema (editorSpecs.ts)

const styledTextSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string(),
  styles: stylesSchema,
})

const inlineContentSchema = styledTextSchema

// --- Table Content ---

const tableContentSchema = z.strictObject({
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

// --- Shared Props ---

const textAlignmentSchema = z.enum(['left', 'center', 'right', 'justify']).optional()

const defaultPropsSchema = {
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlignment: textAlignmentSchema,
}

// --- Block Schema (recursive via z.lazy) ---

type BlockNoteBlock = {
  id: string
  type: string
  props: Record<string, unknown>
  content?: Array<z.infer<typeof inlineContentSchema>> | z.infer<typeof tableContentSchema>
  children?: Array<BlockNoteBlock>
}

const blockNoteBlockSchema: z.ZodType<BlockNoteBlock> = z.lazy(() =>
  z.discriminatedUnion('type', [
    // --- Inline content blocks ---
    z.strictObject({
      id: z.string(),
      type: z.literal('paragraph'),
      props: z.strictObject({ ...defaultPropsSchema }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('heading'),
      props: z.strictObject({
        level: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(5),
          z.literal(6),
        ]),
        isToggleable: z.boolean().optional(),
        ...defaultPropsSchema,
      }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('bulletListItem'),
      props: z.strictObject({ ...defaultPropsSchema }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('numberedListItem'),
      props: z.strictObject({
        start: z.number().optional(),
        ...defaultPropsSchema,
      }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('checkListItem'),
      props: z.strictObject({
        checked: z.boolean().optional(),
        ...defaultPropsSchema,
      }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('toggleListItem'),
      props: z.strictObject({ ...defaultPropsSchema }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('quote'),
      props: z.strictObject({
        textColor: z.string().optional(),
        backgroundColor: z.string().optional(),
      }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('codeBlock'),
      props: z.strictObject({
        language: z.string().optional(),
      }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),

    // --- No-content blocks ---
    z.strictObject({
      id: z.string(),
      type: z.literal('divider'),
      props: z.strictObject({}),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('image'),
      props: z.strictObject({
        name: z.string().optional(),
        url: z.string().optional(),
        caption: z.string().optional(),
        backgroundColor: z.string().optional(),
        textAlignment: textAlignmentSchema,
        showPreview: z.boolean().optional(),
        previewWidth: z.number().optional(),
      }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('video'),
      props: z.strictObject({
        name: z.string().optional(),
        url: z.string().optional(),
        caption: z.string().optional(),
        backgroundColor: z.string().optional(),
        textAlignment: textAlignmentSchema,
        showPreview: z.boolean().optional(),
        previewWidth: z.number().optional(),
      }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('audio'),
      props: z.strictObject({
        name: z.string().optional(),
        url: z.string().optional(),
        caption: z.string().optional(),
        backgroundColor: z.string().optional(),
        showPreview: z.boolean().optional(),
      }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('file'),
      props: z.strictObject({
        name: z.string().optional(),
        url: z.string().optional(),
        caption: z.string().optional(),
        backgroundColor: z.string().optional(),
      }),
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),

    // --- Table block ---
    z.strictObject({
      id: z.string(),
      type: z.literal('table'),
      props: z.strictObject({
        textColor: z.string().optional(),
      }),
      content: tableContentSchema.optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
  ]),
)

export { blockNoteBlockSchema }
export const blockNoteBlockValidator = zodToConvex(blockNoteBlockSchema)
