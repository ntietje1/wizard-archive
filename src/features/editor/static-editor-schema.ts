import { BlockNoteSchema } from '@blocknote/core'
import { customBlockSpecs } from '../../../shared/editor-blocks/editor-blocknote-spec-factory'
import { customInlineContentSpecs, customStyleSpecs } from './editor-dom-specs'

export function createStaticEditorSchema() {
  return BlockNoteSchema.create({
    blockSpecs: customBlockSpecs,
    inlineContentSpecs: customInlineContentSpecs,
    styleSpecs: customStyleSpecs,
  })
}
