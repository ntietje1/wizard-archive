import { BlockNoteSchema } from '@blocknote/core'
import type { BlockNoteEditor, PartialInlineContent } from '@blocknote/core'
import { customBlockSpecs, customInlineContentSpecs, customStyleSpecs } from './editor-dom-specs'
import type { NoteValueProps } from '../../../shared/note-values/types'
import type { CustomBlock, CustomPartialBlock } from '../../../convex/blocks/types'
export { customBlockSpecs, customInlineContentSpecs, customStyleSpecs } from './editor-dom-specs'

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: customBlockSpecs,
  inlineContentSpecs: customInlineContentSpecs,
  styleSpecs: customStyleSpecs,
})

type CustomBlockSchema = typeof editorSchema.blockSchema
type CustomInlineContentSchema = typeof editorSchema.inlineContentSchema
export type CustomStyleSchema = typeof editorSchema.styleSchema

export type { CustomBlock, CustomPartialBlock }

export interface CustomValuePartialInlineContent {
  type: 'value'
  props: NoteValueProps
  content?: undefined
}

type CustomPartialInlineContent =
  | PartialInlineContent<CustomInlineContentSchema, CustomStyleSchema>
  | Array<CustomValuePartialInlineContent>

type BaseCustomBlockNoteEditor = BlockNoteEditor<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>

export type CustomBlockNoteEditor = BaseCustomBlockNoteEditor & {
  document: Array<CustomBlock>
  insertInlineContent(
    content: CustomPartialInlineContent,
    options?: { updateSelection?: boolean },
  ): void
}
