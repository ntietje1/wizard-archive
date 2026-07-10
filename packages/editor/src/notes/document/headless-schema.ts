import { BlockNoteSchema } from '@blocknote/core'
import { createCustomInlineContentSpecs, createNoteBlockSpecs } from './schema-factory'
import { createNoteStyleSpecs } from './style-specs'
import { headlessRenderers } from './headless-renderers'
import { createHeadlessBlockNoteEditor } from './headless-editor'

const customInlineContentSpecs = createCustomInlineContentSpecs({
  valueInline: headlessRenderers.valueInline,
})

const customStyleSpecs = createNoteStyleSpecs({
  textColor: headlessRenderers.textColor,
})

const headlessNoteBlockSpecs = createNoteBlockSpecs({
  renderEmbedBlock: headlessRenderers.embedBlock,
})

const headlessNoteSchema = BlockNoteSchema.create({
  blockSpecs: headlessNoteBlockSpecs,
  inlineContentSpecs: customInlineContentSpecs,
  styleSpecs: customStyleSpecs,
})

export type HeadlessNoteStyleSchema = typeof headlessNoteSchema.styleSchema

export function createHeadlessNoteEditor() {
  return createHeadlessBlockNoteEditor({ schema: headlessNoteSchema })
}
