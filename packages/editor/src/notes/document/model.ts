import type { z } from 'zod'
import { z as zod } from 'zod'
import {
  deriveExternalEmbedName,
  embedTargetKindSchema,
  embedTargetSchema,
  externalEmbedUrlSchema,
} from '../../../../../shared/embeds/embedTargets'
import { noteValuePropsSchema } from '../values/schema'
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
  backgroundColor: zod.string().optional(),
  textAlignment: textAlignmentSchema,
  previewWidth: zod.number().positive().optional(),
  previewHeight: zod.number().positive().optional(),
  previewAspectRatio: zod.number().positive().optional(),
}

const emptyEmbedPropsSchema = zod.strictObject({
  targetKind: zod.literal(embedTargetKindSchema.enum.empty).optional(),
  ...embedSharedPropsSchema,
})

const resourceEmbedPropsSchema = zod.strictObject({
  targetKind: zod.literal(embedTargetKindSchema.enum.resource),
  resourceId: zod.string().min(1),
  ...embedSharedPropsSchema,
})

const externalUrlEmbedPropsSchema = zod.strictObject({
  targetKind: zod.literal(embedTargetKindSchema.enum.externalUrl),
  url: externalEmbedUrlSchema,
  name: zod.string().trim().min(1).optional(),
  ...embedSharedPropsSchema,
})

const embedPropsSchema = zod.union([
  emptyEmbedPropsSchema,
  resourceEmbedPropsSchema,
  externalUrlEmbedPropsSchema,
])

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

const LEGACY_MEDIA_BLOCK_TYPES = new Set(['image', 'video', 'audio', 'file'])

type LegacyBlock = Record<string, unknown> & {
  children?: Array<LegacyBlock>
  props?: Record<string, unknown>
  type?: string
}

type EmbedProps = {
  backgroundColor?: string
  name?: string
  previewWidth?: number
  resourceId?: string
  targetKind: 'empty' | 'resource' | 'externalUrl'
  textAlignment?: 'left' | 'center' | 'right' | 'justify'
  url?: string
}

export function migrateLegacyMediaBlocks(blocks: Array<LegacyBlock>): Array<LegacyBlock> {
  return blocks.map(migrateLegacyMediaBlock)
}

function migrateLegacyMediaBlock(block: LegacyBlock): LegacyBlock {
  const children = Array.isArray(block.children)
    ? migrateLegacyMediaBlocks(block.children)
    : block.children

  if (!isLegacyMediaBlockType(block.type)) {
    if (block.type !== 'embed') {
      return children === block.children ? block : { ...block, children }
    }

    return stripUndefined({
      ...block,
      props: getCurrentEmbedProps(block.props ?? {}, block.content),
      content: undefined,
      children,
    })
  }

  return stripUndefined({
    ...block,
    type: 'embed',
    props: getLegacyMediaEmbedProps(block.props ?? {}),
    content: undefined,
    children,
  })
}

function getLegacyMediaEmbedProps(props: Record<string, unknown>): EmbedProps {
  const baseProps = getLegacyMediaBaseProps(props)
  const url = typeof props.url === 'string' ? props.url : ''
  const name = getLegacyMediaName(props, url)
  const externalTarget = embedTargetSchema.safeParse({
    kind: 'externalUrl',
    url,
    name: name ?? null,
  })

  if (!externalTarget.success || externalTarget.data.kind !== 'externalUrl') {
    return {
      ...baseProps,
      targetKind: url ? 'externalUrl' : 'empty',
      ...(url ? { url, ...(name ? { name } : {}) } : {}),
    }
  }

  return stripUndefined({
    ...baseProps,
    targetKind: 'externalUrl',
    url: externalTarget.data.url,
    name: externalTarget.data.name ?? undefined,
  })
}

function getLegacyMediaBaseProps(props: Record<string, unknown>) {
  return stripUndefined({
    backgroundColor: typeof props.backgroundColor === 'string' ? props.backgroundColor : undefined,
    textAlignment: isTextAlignment(props.textAlignment) ? props.textAlignment : undefined,
    previewWidth: getPositiveNumber(props.previewWidth),
  })
}

function getCurrentEmbedProps(
  props: Record<string, unknown>,
  legacyContent?: unknown,
): Record<string, unknown> {
  const next = { ...props }
  for (const key of ['previewWidth', 'previewHeight', 'previewAspectRatio'] as const) {
    const value = getPositiveNumber(props[key])
    if (value === undefined) {
      delete next[key]
    } else {
      next[key] = value
    }
  }
  if (legacyContent !== undefined) {
    delete next.previewHeight
  }
  return next
}

function getLegacyMediaName(props: Record<string, unknown>, url: string): string | null {
  for (const key of ['name', 'caption']) {
    const value = props[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return deriveExternalEmbedName(url)
}

function isLegacyMediaBlockType(type: unknown): type is 'image' | 'video' | 'audio' | 'file' {
  return typeof type === 'string' && LEGACY_MEDIA_BLOCK_TYPES.has(type)
}

function isTextAlignment(value: unknown): value is 'left' | 'center' | 'right' | 'justify' {
  return value === 'left' || value === 'center' || value === 'right' || value === 'justify'
}

function getPositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
  ) as T
}
