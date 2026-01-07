import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core'
import type { Block, BlockNoteEditor, PartialBlock } from '@blocknote/core'
import { MentionInlineContent } from '~/components/notes-page/editor/blocks/mention-inline-content'

export const customInlineContentSpecs = {
  ...defaultInlineContentSpecs,
  mention: MentionInlineContent,
}

export const editorSchema = BlockNoteSchema.create({
  inlineContentSpecs: customInlineContentSpecs,
})

export type CustomBlockSchema = typeof editorSchema.blockSchema
export type CustomInlineContentSchema = typeof editorSchema.inlineContentSchema
export type CustomStyleSchema = typeof editorSchema.styleSchema

export type CustomPartialBlock = PartialBlock<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>

export type CustomBlock = Block<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>

export type CustomBlockNoteEditor = BlockNoteEditor<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>
