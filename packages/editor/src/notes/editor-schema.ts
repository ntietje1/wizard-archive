import { BlockNoteSchema } from '@blocknote/core'
import type { BlockNoteEditor, PartialInlineContent } from '@blocknote/core'
import { customBlockSpecs } from './document/schema-factory'
import type { NoteBlock } from './document/model'
import type { NoteValueProps } from './values/schema'
import { noteInlineContentSpecs, noteStyleSpecs } from './dom-specs'

function createBaseNoteEditorSchema() {
  return BlockNoteSchema.create({
    blockSpecs: customBlockSpecs,
    inlineContentSpecs: noteInlineContentSpecs,
    styleSpecs: noteStyleSpecs,
  })
}

const baseNoteEditorSchema = createBaseNoteEditorSchema()

type CustomBlockSchema = typeof baseNoteEditorSchema.blockSchema
type CustomInlineContentSchema = typeof baseNoteEditorSchema.inlineContentSchema
type CustomStyleSchema = typeof baseNoteEditorSchema.styleSchema

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
  document: Array<NoteBlock>
  insertInlineContent(
    content: CustomPartialInlineContent,
    options?: { updateSelection?: boolean },
  ): void
}
