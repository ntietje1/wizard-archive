import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import {
  NOTE_BLOCK_REGISTRY,
  NOTE_BLOCK_TYPE_VALUES,
} from '@wizard-archive/editor/notes/document-contract'
import { SHARE_STATUS_VALUES } from '../../shared/block-shares/share-status'
import { convexValidatorFields } from '../common/schema'
import type { NoteBlockId } from '@wizard-archive/editor/resources/domain-id'

export const blockNoteIdValidator = v.string()
const persistedBlockNoteIdValidator = v.string() as Validator<NoteBlockId>

export const blockShareStatusValidator = literals(...SHARE_STATUS_VALUES)

export const blockTypeValidator = literals(...NOTE_BLOCK_TYPE_VALUES)

export const editorBlockInputValidator = v.any()

const textAlignmentValidator = literals('left', 'center', 'right', 'justify')

const inlineStyleValidator = v.object({
  bold: v.optional(v.boolean()),
  italic: v.optional(v.boolean()),
  underline: v.optional(v.boolean()),
  strike: v.optional(v.boolean()),
  code: v.optional(v.boolean()),
  textColor: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
})

const textInlineContentValidator = v.object({
  type: v.literal('text'),
  text: v.string(),
  styles: v.optional(inlineStyleValidator),
})

const noteValuePropsValidator = v.object({
  valueId: v.string(),
  slug: v.string(),
  expressionSource: v.string(),
})

const valueInlineContentValidator = v.object({
  type: v.literal('value'),
  props: noteValuePropsValidator,
})

export const inlineContentItemValidator = v.union(
  textInlineContentValidator,
  valueInlineContentValidator,
)

export const inlineContentArrayValidator = v.array(inlineContentItemValidator)

const tableCellValidator = v.object({
  type: v.literal('tableCell'),
  content: inlineContentArrayValidator,
  props: v.optional(
    v.object({
      colspan: v.optional(v.number()),
      rowspan: v.optional(v.number()),
      textColor: v.optional(v.string()),
      backgroundColor: v.optional(v.string()),
      textAlignment: v.optional(textAlignmentValidator),
    }),
  ),
})

export const tableContentValidator = v.object({
  type: v.literal('tableContent'),
  columnWidths: v.array(v.nullable(v.number())),
  headerRows: v.optional(v.number()),
  headerCols: v.optional(v.number()),
  rows: v.array(
    v.object({
      cells: v.array(tableCellValidator),
    }),
  ),
})

export const blockContentValidator = v.union(inlineContentArrayValidator, tableContentValidator)

const defaultBlockPropsValidator = v.object({
  textColor: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  textAlignment: v.optional(textAlignmentValidator),
})

const headingPropsValidator = v.object({
  level: v.union(
    v.literal(1),
    v.literal(2),
    v.literal(3),
    v.literal(4),
    v.literal(5),
    v.literal(6),
  ),
  isToggleable: v.optional(v.boolean()),
  textColor: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  textAlignment: v.optional(textAlignmentValidator),
})

const numberedListItemPropsValidator = v.object({
  start: v.optional(v.number()),
  textColor: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  textAlignment: v.optional(textAlignmentValidator),
})

const checkListItemPropsValidator = v.object({
  checked: v.optional(v.boolean()),
  textColor: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  textAlignment: v.optional(textAlignmentValidator),
})

const codeBlockPropsValidator = v.object({
  language: v.optional(v.string()),
})

const emptyPropsValidator = v.object({})

const embedSharedPropsValidator = {
  backgroundColor: v.optional(v.string()),
  textAlignment: v.optional(textAlignmentValidator),
  previewWidth: v.optional(v.number()),
  previewHeight: v.optional(v.number()),
  previewAspectRatio: v.optional(v.number()),
}

const embedPropsValidator = v.union(
  v.object({
    targetKind: v.optional(v.literal('empty')),
    ...embedSharedPropsValidator,
  }),
  v.object({
    targetKind: v.literal('resource'),
    resourceId: v.string(),
    ...embedSharedPropsValidator,
  }),
  v.object({
    targetKind: v.literal('externalUrl'),
    url: v.string(),
    name: v.optional(v.string()),
    ...embedSharedPropsValidator,
  }),
)

const tablePropsValidator = v.object({
  textColor: v.optional(v.string()),
})

const blockPropValidators = {
  defaultText: defaultBlockPropsValidator,
  heading: headingPropsValidator,
  numberedListItem: numberedListItemPropsValidator,
  checkListItem: checkListItemPropsValidator,
  codeBlock: codeBlockPropsValidator,
  empty: emptyPropsValidator,
  embed: embedPropsValidator,
  table: tablePropsValidator,
} as const

const blockCommonTableFields = {
  noteId: v.id('sidebarItems'),
  blockNoteId: persistedBlockNoteIdValidator,
  position: v.nullable(v.number()),
  parentBlockId: v.nullable(persistedBlockNoteIdValidator),
  depth: v.number(),
  plainText: v.string(),
  campaignId: v.id('campaigns'),
  shareStatus: v.nullable(blockShareStatusValidator),
}

const persistedContentFields = {
  inline: {
    content: v.nullable(inlineContentArrayValidator),
  },
  none: {
    content: v.nullable(inlineContentArrayValidator),
  },
  table: {
    content: v.nullable(tableContentValidator),
  },
} as const

function blockTableVariant(entry: (typeof NOTE_BLOCK_REGISTRY)[number]) {
  return v.object({
    ...blockCommonTableFields,
    type: v.literal(entry.type),
    props: blockPropValidators[entry.props],
    ...persistedContentFields[entry.content],
  })
}

const blockTableVariants = NOTE_BLOCK_REGISTRY.map(blockTableVariant) as unknown as [
  ReturnType<typeof blockTableVariant>,
  ReturnType<typeof blockTableVariant>,
  ...Array<ReturnType<typeof blockTableVariant>>,
]

const blockTableValidator = v.union(...blockTableVariants)

export const blocksTables = {
  blocks: defineTable(blockTableValidator)
    .index('by_campaign_note_block', ['campaignId', 'noteId', 'blockNoteId'])
    .index('by_campaign_note_type', ['campaignId', 'noteId', 'type'])
    .searchIndex('search_plainText', {
      searchField: 'plainText',
      filterFields: ['campaignId', 'noteId', 'type'],
    }),
}

const blockSystemFields = convexValidatorFields('blocks')

function blockVariant(entry: (typeof NOTE_BLOCK_REGISTRY)[number]) {
  return v.object({
    ...blockSystemFields,
    ...blockCommonTableFields,
    type: v.literal(entry.type),
    props: blockPropValidators[entry.props],
    ...persistedContentFields[entry.content],
  })
}

const blockVariants = NOTE_BLOCK_REGISTRY.map(blockVariant) as unknown as [
  ReturnType<typeof blockVariant>,
  ReturnType<typeof blockVariant>,
  ...Array<ReturnType<typeof blockVariant>>,
]

export const blockValidator = v.union(...blockVariants)
