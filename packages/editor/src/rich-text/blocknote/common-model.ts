import type { z } from 'zod'
import { z as zod } from 'zod'
import type { UuidV7 } from '../../resources/domain-id'

export const COMMON_RICH_TEXT_BLOCK_TYPES = [
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'quote',
  'codeBlock',
] as const

type RichTextStyles = Readonly<{
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
  textColor?: string
  backgroundColor?: string
}>

export type RichTextText = Readonly<{
  type: 'text'
  text: string
  styles?: RichTextStyles
}>

type DefaultTextProps = Readonly<{
  textColor?: string
  backgroundColor?: string
  textAlignment?: 'left' | 'center' | 'right' | 'justify'
}>
type HeadingProps = DefaultTextProps &
  Readonly<{ level: 1 | 2 | 3 | 4 | 5 | 6; isToggleable?: boolean }>
type NumberedListItemProps = DefaultTextProps & Readonly<{ start?: number }>
type CheckListItemProps = DefaultTextProps & Readonly<{ checked?: boolean }>
type CodeBlockProps = Readonly<{ language?: string }>
type Props<Shape, Optional extends boolean> = Optional extends true
  ? Readonly<{ props?: Shape }>
  : Readonly<{ props: Shape }>
type InlineBlock<Type extends string, Shape, Inline, Optional extends boolean> = Readonly<{
  type: Type
  content?: Array<Inline>
}> &
  Props<Shape, Optional>

export type CommonRichTextBlockContent<
  Inline = RichTextText,
  OptionalProps extends boolean = false,
> =
  | InlineBlock<'paragraph', DefaultTextProps, Inline, OptionalProps>
  | InlineBlock<'heading', HeadingProps, Inline, OptionalProps>
  | InlineBlock<'bulletListItem', DefaultTextProps, Inline, OptionalProps>
  | InlineBlock<'numberedListItem', NumberedListItemProps, Inline, OptionalProps>
  | InlineBlock<'checkListItem', CheckListItemProps, Inline, OptionalProps>
  | InlineBlock<'quote', DefaultTextProps, Inline, OptionalProps>
  | InlineBlock<'codeBlock', CodeBlockProps, Inline, OptionalProps>

export type CommonRichTextBlock<
  Inline = RichTextText,
  OptionalProps extends boolean = false,
> = CommonRichTextBlockContent<Inline, OptionalProps> & {
  id: UuidV7
  children?: Array<CommonRichTextBlock<Inline, OptionalProps>>
}

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

export const richTextTextSchema = zod.strictObject({
  type: zod.literal('text'),
  text: zod.string(),
  styles: stylesSchema,
})

const textAlignmentSchema = zod.enum(['left', 'center', 'right', 'justify']).optional()
export const defaultRichTextPropsSchema = zod.strictObject({
  textColor: zod.string().optional(),
  backgroundColor: zod.string().optional(),
  textAlignment: textAlignmentSchema,
})
const headingPropsSchema = zod.strictObject({
  level: zod.union([
    zod.literal(1),
    zod.literal(2),
    zod.literal(3),
    zod.literal(4),
    zod.literal(5),
    zod.literal(6),
  ]),
  isToggleable: zod.boolean().optional(),
  ...defaultRichTextPropsSchema.shape,
})
const numberedListItemPropsSchema = zod.strictObject({
  start: zod.number().optional(),
  ...defaultRichTextPropsSchema.shape,
})
const checkListItemPropsSchema = zod.strictObject({
  checked: zod.boolean().optional(),
  ...defaultRichTextPropsSchema.shape,
})
const codeBlockPropsSchema = zod.strictObject({ language: zod.string().optional() })

export function createCommonRichTextBlockContentSchemas(
  inlineContentItemSchema: z.ZodType,
  optionalProps = false,
) {
  const content = zod.array(inlineContentItemSchema).optional()
  const props = <Schema extends z.ZodType>(schema: Schema) =>
    optionalProps ? schema.optional() : schema
  return [
    zod.strictObject({
      type: zod.literal('paragraph'),
      props: props(defaultRichTextPropsSchema),
      content,
    }),
    zod.strictObject({ type: zod.literal('heading'), props: props(headingPropsSchema), content }),
    zod.strictObject({
      type: zod.literal('bulletListItem'),
      props: props(defaultRichTextPropsSchema),
      content,
    }),
    zod.strictObject({
      type: zod.literal('numberedListItem'),
      props: props(numberedListItemPropsSchema),
      content,
    }),
    zod.strictObject({
      type: zod.literal('checkListItem'),
      props: props(checkListItemPropsSchema),
      content,
    }),
    zod.strictObject({
      type: zod.literal('quote'),
      props: props(defaultRichTextPropsSchema),
      content,
    }),
    zod.strictObject({
      type: zod.literal('codeBlock'),
      props: props(codeBlockPropsSchema),
      content,
    }),
  ] as const
}

export function createRichTextBlockSchema<Block>(
  contentSchemas: ReadonlyArray<z.ZodObject<{ type: z.ZodLiteral<string> } & z.ZodRawShape>>,
  idSchema: z.ZodType<string>,
): z.ZodType<Block> {
  let blockSchema: z.ZodType<Block>
  blockSchema = zod.lazy<z.ZodType<Block>>(() => {
    const options = contentSchemas.map((schema) =>
      zod.strictObject({
        ...schema.shape,
        id: idSchema,
        children: zod.array(blockSchema).optional(),
      }),
    )
    const [first, second, ...rest] = options
    const schema = zod.discriminatedUnion('type', [first, second, ...rest])
    return schema as typeof schema & z.ZodType<Block>
  })
  return blockSchema
}

export function enforceUniqueRichTextBlockIdentities(
  blocks: ReadonlyArray<{ id?: string; children?: ReadonlyArray<unknown> }>,
  context: z.RefinementCtx,
): void {
  const identities = new Set<string>()
  const pending = blocks.map((block, index) => ({ block, path: [index] as Array<PropertyKey> }))
  while (pending.length > 0) {
    const { block, path } = pending.pop()!
    if (block.id && identities.has(block.id)) {
      context.addIssue({ code: 'custom', message: 'Duplicate rich-text block identity', path })
    } else if (block.id) {
      identities.add(block.id)
    }
    block.children?.forEach((child, index) => {
      pending.push({
        block: child as { id?: string; children?: ReadonlyArray<unknown> },
        path: [...path, 'children', index],
      })
    })
  }
}
