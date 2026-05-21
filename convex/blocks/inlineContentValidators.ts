import { v } from 'convex/values'
import type { InlineContentItem, InlineContent, TableContent } from './types'

const blockPropValueValidator = v.union(v.string(), v.number(), v.boolean(), v.null())

type InlineStyles = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
  textColor?: string
  backgroundColor?: string
}

const STYLE_FIELD_TYPES = {
  bold: 'boolean',
  italic: 'boolean',
  underline: 'boolean',
  strike: 'boolean',
  code: 'boolean',
  textColor: 'string',
  backgroundColor: 'string',
} as const

const stylesValidator = v.optional(
  v.object({
    bold: v.optional(v.boolean()),
    italic: v.optional(v.boolean()),
    underline: v.optional(v.boolean()),
    strike: v.optional(v.boolean()),
    code: v.optional(v.boolean()),
    textColor: v.optional(v.string()),
    backgroundColor: v.optional(v.string()),
  }),
)

const textInlineContentValidator = v.object({
  type: v.literal('text'),
  text: v.string(),
  styles: stylesValidator,
})

const valueInlineContentValidator = v.object({
  type: v.literal('value'),
  props: v.object({
    valueId: v.string(),
    slug: v.string(),
    expressionSource: v.string(),
  }),
})

const inlineContentValidator = v.union(textInlineContentValidator, valueInlineContentValidator)

export const inlineContentArrayValidator = v.array(inlineContentValidator)

const tableCellPropsValidator = v.optional(v.record(v.string(), blockPropValueValidator))

const tableCellValidator = v.object({
  type: v.literal('tableCell'),
  content: inlineContentArrayValidator,
  props: tableCellPropsValidator,
})

const tableContentValidator = v.object({
  type: v.literal('tableContent'),
  columnWidths: v.array(v.union(v.number(), v.null())),
  headerRows: v.optional(v.number()),
  headerCols: v.optional(v.number()),
  rows: v.array(
    v.object({
      cells: v.array(v.union(inlineContentArrayValidator, tableCellValidator)),
    }),
  ),
})

export const blockContentValidator = v.union(inlineContentArrayValidator, tableContentValidator)

function isStyles(value: unknown): value is InlineStyles {
  if (value === undefined) return true
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  for (const [key, nestedValue] of Object.entries(value)) {
    const expectedType = STYLE_FIELD_TYPES[key as keyof typeof STYLE_FIELD_TYPES]
    if (expectedType === undefined || typeof nestedValue !== expectedType) return false
  }
  return true
}

export function isInlineContentItem(item: unknown): item is InlineContentItem {
  if (typeof item !== 'object' || item === null || !('type' in item)) {
    return false
  }
  if (item.type === 'text') {
    return (
      'text' in item &&
      typeof item.text === 'string' &&
      isStyles('styles' in item ? item.styles : undefined)
    )
  }
  if (item.type !== 'value') {
    return false
  }
  if (!('props' in item) || typeof item.props !== 'object' || item.props === null) {
    return false
  }
  return (
    'valueId' in item.props &&
    typeof item.props.valueId === 'string' &&
    'slug' in item.props &&
    typeof item.props.slug === 'string' &&
    'expressionSource' in item.props &&
    typeof item.props.expressionSource === 'string'
  )
}

function isInlineContent(content: unknown): content is InlineContent {
  return Array.isArray(content) && content.every(isInlineContentItem)
}

function isTableCellProps(
  value: unknown,
): value is Record<string, string | number | boolean | null> {
  if (value === undefined) return true
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every(
    (nestedValue) =>
      nestedValue === null ||
      typeof nestedValue === 'string' ||
      typeof nestedValue === 'number' ||
      typeof nestedValue === 'boolean',
  )
}

function isTableCell(
  value: unknown,
): value is Extract<TableContent['rows'][number]['cells'][number], { type: 'tableCell' }> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'type' in value &&
    value.type === 'tableCell' &&
    'content' in value &&
    isInlineContent(value.content) &&
    isTableCellProps('props' in value ? value.props : undefined)
  )
}

function isTableRow(value: unknown): value is TableContent['rows'][number] {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'cells' in value &&
    Array.isArray(value.cells) &&
    value.cells.every((cell) => isInlineContent(cell) || isTableCell(cell))
  )
}

export function isTableContent(content: unknown): content is TableContent {
  return (
    !!content &&
    typeof content === 'object' &&
    !Array.isArray(content) &&
    'type' in content &&
    content.type === 'tableContent' &&
    'columnWidths' in content &&
    Array.isArray(content.columnWidths) &&
    content.columnWidths.every((width) => typeof width === 'number' || width === null) &&
    (!('headerRows' in content) || typeof content.headerRows === 'number') &&
    (!('headerCols' in content) || typeof content.headerCols === 'number') &&
    'rows' in content &&
    Array.isArray(content.rows) &&
    content.rows.every(isTableRow)
  )
}

export function isBlockContent(content: unknown): content is InlineContent | TableContent {
  return isInlineContent(content) || isTableContent(content)
}
