import { BlockNoteSchema } from '@blocknote/core'
import type { BlockNoteEditor, PartialInlineContent } from '@blocknote/core'
import { customBlockSpecs } from '../../../shared/editor-blocks/editor-blocknote-spec-factory'
import { customInlineContentSpecs, customStyleSpecs } from './editor-dom-specs'
import { reactValueInlineSpec } from './value-block/value-block-react-spec'
import { reactEmbedBlockSpec } from './components/extensions/embed-block/embed-block-react-spec'
import type { NoteValueProps } from '../../../shared/note-values/schema'
import type { CustomBlock } from 'shared/editor-blocks/types'

const editorSchema = BlockNoteSchema.create({
  blockSpecs: customBlockSpecs,
  inlineContentSpecs: customInlineContentSpecs,
  styleSpecs: customStyleSpecs,
})

const { value: _value, ...inlineContentSpecsWithoutValue } = customInlineContentSpecs
const { embed: _embed, ...blockSpecsWithoutEmbed } = customBlockSpecs

/**
 * createEditorSchema swaps app-only React specs into the otherwise shared schema.
 * Serialization remains owned by the shared BlockNote config.
 */
export function createEditorSchema() {
  return BlockNoteSchema.create({
    blockSpecs: {
      ...blockSpecsWithoutEmbed,
      embed: reactEmbedBlockSpec,
    },
    inlineContentSpecs: {
      ...inlineContentSpecsWithoutValue,
      value: reactValueInlineSpec,
    },
    styleSpecs: customStyleSpecs,
  })
}

type CustomBlockSchema = typeof editorSchema.blockSchema
type CustomInlineContentSchema = typeof editorSchema.inlineContentSchema
export type CustomStyleSchema = typeof editorSchema.styleSchema

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
