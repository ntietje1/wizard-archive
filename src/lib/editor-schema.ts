import {
  
  BlockNoteSchema,
  
  defaultInlineContentSpecs
} from '@blocknote/core'
import type {Block, BlockNoteEditor,
  PartialBlock
} from '@blocknote/core';
import { TagInlineContent } from '~/components/notes-page/editor/blocks/tag-inline-content'

export const customInlineContentSpecs = {
  ...defaultInlineContentSpecs,
  tag: TagInlineContent,
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
