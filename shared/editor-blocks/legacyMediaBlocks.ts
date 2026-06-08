import { deriveExternalEmbedName, embedTargetSchema } from '../embeds/embedTargets'

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
  targetKind: 'empty' | 'externalUrl'
  textAlignment?: 'left' | 'center' | 'right' | 'justify'
  url?: string
}

export function migrateLegacyMediaBlocks(blocks: Array<LegacyBlock>): Array<LegacyBlock> {
  return blocks.map(migrateLegacyMediaBlock)
}

export function getLegacyBlockProjectionMigrationPatch(block: {
  content?: unknown
  inlineContent?: unknown
  props?: Record<string, unknown>
  type?: string
}): Record<string, unknown> | null {
  if (isLegacyMediaBlockType(block.type)) return getLegacyMediaProjectionPatch(block)
  if (block.type === 'embed') return getEmbedProjectionPatch(block)
  if (block.type === 'table') return getTableProjectionPatch(block)
  if (usesInlineContent(block.type)) return getInlineProjectionPatch(block)
  return null
}

function getLegacyMediaProjectionPatch(block: { props?: Record<string, unknown> }) {
  return {
    type: 'embed',
    props: getLegacyMediaEmbedProps(block.props ?? {}),
    content: null,
    inlineContent: null,
    plainText: '',
  }
}

function getEmbedProjectionPatch(block: {
  content?: unknown
  inlineContent?: unknown
  props?: Record<string, unknown>
}) {
  const patch: Record<string, unknown> = {}
  const props = getCurrentEmbedProps(block.props ?? {})
  if (props !== block.props) patch.props = props
  if (block.content === undefined) patch.content = null
  if (block.inlineContent !== null) patch.inlineContent = null
  return nonEmptyPatch(patch)
}

function getTableProjectionPatch(block: { content?: unknown; inlineContent?: unknown }) {
  const patch: Record<string, unknown> = {}
  const content =
    isTableContent(block.content) || block.content === null
      ? block.content
      : migrateLegacyTableContent(block.inlineContent)
  if (content !== block.content) patch.content = content
  if (block.inlineContent !== null) patch.inlineContent = null
  return nonEmptyPatch(patch)
}

function getInlineProjectionPatch(block: { content?: unknown; inlineContent?: unknown }) {
  if (block.content !== undefined) return null
  return { content: Array.isArray(block.inlineContent) ? block.inlineContent : null }
}

function nonEmptyPatch(patch: Record<string, unknown>) {
  return Object.keys(patch).length > 0 ? patch : null
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
      props: getCurrentEmbedProps(block.props ?? {}),
      content: undefined,
      children,
    })
  }

  return stripUndefined({
    ...block,
    type: 'embed',
    props: getLegacyMediaEmbedProps(block.props ?? {}),
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
      targetKind: 'empty',
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

function getCurrentEmbedProps(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).filter(([key]) => key !== 'previewHeight'))
}

function migrateLegacyTableContent(value: unknown) {
  if (!isTableContent(value)) return null

  return {
    ...value,
    rows: value.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        if (isTableCell(cell)) return cell
        return {
          type: 'tableCell' as const,
          content: Array.isArray(cell) ? cell : [],
        }
      }),
    })),
  }
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

function usesInlineContent(type: unknown) {
  return (
    type === 'paragraph' ||
    type === 'heading' ||
    type === 'bulletListItem' ||
    type === 'numberedListItem' ||
    type === 'checkListItem' ||
    type === 'toggleListItem' ||
    type === 'quote' ||
    type === 'codeBlock' ||
    type === 'divider'
  )
}

function isTableContent(value: unknown): value is {
  rows: Array<{ cells: Array<unknown> }>
  type: 'tableContent'
} {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'type' in value &&
    value.type === 'tableContent' &&
    'rows' in value &&
    Array.isArray(value.rows)
  )
}

function isTableCell(value: unknown): value is {
  content: Array<unknown>
  type: 'tableCell'
} {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'type' in value &&
    value.type === 'tableCell' &&
    'content' in value &&
    Array.isArray(value.content)
  )
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
