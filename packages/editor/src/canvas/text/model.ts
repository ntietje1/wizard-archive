import type { ZodLiteral, z } from 'zod'
import { z as zod } from 'zod'
import { canvasTextWithinWorkload } from '../workload'
import { generateUuidV7, isUuidV7 } from '../../resources/domain-id'
import type { UuidV7 } from '../../resources/domain-id'

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

export type CanvasTextBlock = CanvasTextBlockContent & {
  id: UuidV7
  children?: Array<CanvasTextBlock>
}

const canvasTextBlockIdSchema = zod.custom<UuidV7>(
  (value) => typeof value === 'string' && isUuidV7(value),
  'Expected a lowercase UUIDv7 canvas text block id',
)

const canvasTextBlockSchema: z.ZodType<CanvasTextBlock> = zod.lazy(() => {
  const options = canvasTextBlockContentSchemas.map((schema) =>
    zod.strictObject({
      ...schema.shape,
      id: canvasTextBlockIdSchema,
      children: zod.array(canvasTextBlockSchema).optional(),
    }),
  )

  const [first, second, ...rest] = options
  return zod.discriminatedUnion('type', [first, second, ...rest]) as z.ZodType<CanvasTextBlock>
})

const canvasTextDocumentSchema: z.ZodType<CanvasTextDocument> = zod
  .array(canvasTextBlockSchema)
  .superRefine(enforceUniqueCanvasTextBlockIdentities)

export type CanvasTextDocument = Array<CanvasTextBlock>

export function parseCanvasTextDocument(value: unknown): CanvasTextDocument | null {
  if (!canvasTextWithinWorkload(value)) return null
  const result = canvasTextDocumentSchema.safeParse(value)
  return result.success ? result.data : null
}

export function createCanvasTextDocument(text: string): CanvasTextDocument {
  return [{ id: generateUuidV7(), type: 'paragraph', content: [{ type: 'text', text }] }]
}

export function duplicateCanvasTextDocument(document: CanvasTextDocument): CanvasTextDocument {
  const duplicateBlock = (block: CanvasTextBlock): CanvasTextBlock => ({
    ...structuredClone(block),
    id: generateUuidV7(),
    ...(block.children ? { children: block.children.map(duplicateBlock) } : {}),
  })
  return document.map(duplicateBlock)
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

function enforceUniqueCanvasTextBlockIdentities(
  document: CanvasTextDocument,
  context: z.RefinementCtx,
): void {
  const identities = new Set<string>()
  const visit = (block: CanvasTextBlock, path: Array<PropertyKey>) => {
    if (identities.has(block.id)) {
      context.addIssue({ code: 'custom', message: 'Duplicate canvas text block identity', path })
    } else {
      identities.add(block.id)
    }
    block.children?.forEach((child, index) => visit(child, [...path, 'children', index, 'id']))
  }
  document.forEach((block, index) => visit(block, [index, 'id']))
}
