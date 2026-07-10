import { BlockNoteSchema } from '@blocknote/core'
import { customBlockSpecs } from './document/schema-factory'
import { noteInlineContentSpecs, noteStyleSpecs } from './dom-specs'
import { reactEmbedBlockSpec } from './embeds/embed-block-react-spec'
import { reactValueInlineSpec } from './value-block/value-block-react-spec'

const { value: _value, ...inlineContentSpecsWithoutValue } = noteInlineContentSpecs
const { embed: _embed, ...blockSpecsWithoutEmbed } = customBlockSpecs

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
    styleSpecs: noteStyleSpecs,
  })
}
