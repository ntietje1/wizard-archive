import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import type {
  Block,
  BlockNoteEditor,
  BlockSpecs,
  InlineContent,
  InlineContentSpecs,
  PartialBlock,
  PartialInlineContent,
  StyleSpecs,
} from '@blocknote/core'

// remove link from inline content specs
const { link: _link, ...remainingInlineContentSpecs } =
  defaultInlineContentSpecs

export const customInlineContentSpecs = {
  ...remainingInlineContentSpecs,
} as InlineContentSpecs

export const customStyleSpecs = {
  ...defaultStyleSpecs,
} satisfies StyleSpecs

export const customBlockSpecs = {
  ...defaultBlockSpecs,
} as BlockSpecs

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: customBlockSpecs,
  inlineContentSpecs: customInlineContentSpecs,
  styleSpecs: customStyleSpecs,
})

export type CustomBlockSchema = typeof editorSchema.blockSchema
export type CustomInlineContentSchema = typeof editorSchema.inlineContentSchema
export type CustomStyleSchema = typeof editorSchema.styleSchema

export type CustomBlock = Block<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>

export type CustomPartialBlock = PartialBlock<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>

export type CustomInlineContent = InlineContent<
  CustomInlineContentSchema,
  CustomStyleSchema
>

export type CustomPartialInlineContent = PartialInlineContent<
  CustomInlineContentSchema,
  CustomStyleSchema
>

export type CustomBlockNoteEditor = BlockNoteEditor<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>
