import type { ZodLiteral, z } from 'zod'
import { z as zod } from 'zod'

const textStyleKeys = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'textColor',
  'backgroundColor',
] as const

const textStylesSchema = zod.strictObject(createCanvasTextStyleShape()).optional()

const textInlineContentSchema = zod.strictObject({
  type: zod.literal('text'),
  text: zod.string(),
  styles: textStylesSchema,
})

const textAlignmentSchema = zod.enum(['left', 'center', 'right', 'justify']).optional()

const defaultTextPropsSchema = zod.strictObject({
  textColor: zod.string().optional(),
  backgroundColor: zod.string().optional(),
  textAlignment: textAlignmentSchema,
})

const inlineContentSchema = zod.array(textInlineContentSchema).optional()

const headingLevelSchema = zod.union(
  [1, 2, 3, 4, 5, 6].map((level) => zod.literal(level)) as [
    ZodLiteral<1>,
    ZodLiteral<2>,
    ZodLiteral<3>,
    ZodLiteral<4>,
    ZodLiteral<5>,
    ZodLiteral<6>,
  ],
)

const headingPropsSchema = zod.strictObject({
  level: headingLevelSchema,
  isToggleable: zod.boolean().optional(),
  textColor: zod.string().optional(),
  backgroundColor: zod.string().optional(),
  textAlignment: textAlignmentSchema,
})

const numberedListItemPropsSchema = zod.strictObject({
  start: zod.number().optional(),
  textColor: zod.string().optional(),
  backgroundColor: zod.string().optional(),
  textAlignment: textAlignmentSchema,
})

const checkListItemPropsSchema = zod.strictObject({
  checked: zod.boolean().optional(),
  textColor: zod.string().optional(),
  backgroundColor: zod.string().optional(),
  textAlignment: textAlignmentSchema,
})

const codeBlockPropsSchema = zod.strictObject({
  language: zod.string().optional(),
})

const canvasTextBlockContentSchemas = [
  zod.strictObject({
    type: zod.literal('paragraph'),
    props: defaultTextPropsSchema.optional(),
    content: inlineContentSchema,
  }),
  zod.strictObject({
    type: zod.literal('heading'),
    props: headingPropsSchema.optional(),
    content: inlineContentSchema,
  }),
  zod.strictObject({
    type: zod.literal('bulletListItem'),
    props: defaultTextPropsSchema.optional(),
    content: inlineContentSchema,
  }),
  zod.strictObject({
    type: zod.literal('numberedListItem'),
    props: numberedListItemPropsSchema.optional(),
    content: inlineContentSchema,
  }),
  zod.strictObject({
    type: zod.literal('checkListItem'),
    props: checkListItemPropsSchema.optional(),
    content: inlineContentSchema,
  }),
  zod.strictObject({
    type: zod.literal('quote'),
    props: defaultTextPropsSchema.optional(),
    content: inlineContentSchema,
  }),
  zod.strictObject({
    type: zod.literal('codeBlock'),
    props: codeBlockPropsSchema.optional(),
    content: inlineContentSchema,
  }),
] as const

type CanvasTextBlockContent = z.infer<(typeof canvasTextBlockContentSchemas)[number]>

type CanvasTextBlock = CanvasTextBlockContent & {
  id?: string
  children?: Array<CanvasTextBlock>
}

const canvasTextBlockSchema: z.ZodType<CanvasTextBlock> = zod.lazy(() => {
  const options = canvasTextBlockContentSchemas.map((schema) =>
    zod.strictObject({
      ...schema.shape,
      id: zod.string().min(1).optional(),
      children: zod.array(canvasTextBlockSchema).optional(),
    }),
  )

  const [first, second, ...rest] = options
  return zod.discriminatedUnion('type', [first, second, ...rest]) as z.ZodType<CanvasTextBlock>
})

const canvasTextDocumentSchema: z.ZodType<CanvasTextDocument> = zod.array(canvasTextBlockSchema)

export type CanvasTextDocument = Array<CanvasTextBlock>

export function parseCanvasTextDocument(value: unknown): CanvasTextDocument | null {
  const result = canvasTextDocumentSchema.safeParse(value)
  return result.success ? result.data : null
}

export function createCanvasTextDocument(text: string): CanvasTextDocument {
  return [{ type: 'paragraph', content: [{ type: 'text', text }] }]
}

export function canvasTextDocumentPlainText(document: CanvasTextDocument | undefined): string {
  if (!document) return ''
  const blocks: Array<string> = []
  const visit = (block: CanvasTextBlock) => {
    blocks.push(block.content?.map((content) => content.text).join('') ?? '')
    block.children?.forEach(visit)
  }
  document.forEach(visit)
  return blocks.join('\n')
}

function createCanvasTextStyleShape() {
  return Object.fromEntries(
    textStyleKeys.map((key) => [
      key,
      key === 'textColor' || key === 'backgroundColor'
        ? zod.string().optional()
        : zod.boolean().optional(),
    ]),
  ) as {
    [Key in (typeof textStyleKeys)[number]]: Key extends 'textColor' | 'backgroundColor'
      ? z.ZodOptional<z.ZodString>
      : z.ZodOptional<z.ZodBoolean>
  }
}
