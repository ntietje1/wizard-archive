import { BlockNoteSchema } from '@blocknote/core'
import { customBlockSpecs } from '../../../shared/editor-blocks/editor-blocknote-spec-factory'
import { customInlineContentSpecs, customStyleSpecs } from './editor-dom-specs'

const staticEditorSchema = BlockNoteSchema.create({
  blockSpecs: customBlockSpecs,
  inlineContentSpecs: customInlineContentSpecs,
  styleSpecs: customStyleSpecs,
})

export function createStaticEditorSchema() {
  return staticEditorSchema
}
