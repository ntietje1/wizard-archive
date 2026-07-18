import { BlockNoteSchema } from '@blocknote/core'
import { createCustomInlineContentSpecs, createNoteBlockSpecs } from './schema-factory'
import { createCommonRichTextStyleSpecs } from '../../rich-text/blocknote/common-schema'
import { headlessRenderers } from './headless-renderers'
import { createHeadlessBlockNoteEditor } from './headless-editor'

const customInlineContentSpecs = createCustomInlineContentSpecs({
  resourceLink: headlessRenderers.resourceLink,
  valueInline: headlessRenderers.valueInline,
})

const customStyleSpecs = createCommonRichTextStyleSpecs(headlessRenderers.textColor)

const headlessNoteBlockSpecs = createNoteBlockSpecs({
  renderEmbedBlock: headlessRenderers.embedBlock,
})

const headlessNoteSchema = BlockNoteSchema.create({
  blockSpecs: headlessNoteBlockSpecs,
  inlineContentSpecs: customInlineContentSpecs,
  styleSpecs: customStyleSpecs,
})

export function createHeadlessNoteEditor() {
  return createHeadlessBlockNoteEditor({ schema: headlessNoteSchema })
}
