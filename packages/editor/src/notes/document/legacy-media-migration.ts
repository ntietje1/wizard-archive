import { BlockNoteSchema } from '@blocknote/core'
import { createCustomInlineContentSpecs, createLegacyMediaDecodeBlockSpecs } from './schema-factory'
import { createNoteStyleSpecs } from './style-specs'
import { headlessRenderers } from './headless-renderers'

export const headlessLegacyMediaDecodeNoteSchema = BlockNoteSchema.create({
  blockSpecs: createLegacyMediaDecodeBlockSpecs({
    renderEmbedBlock: headlessRenderers.embedBlock,
  }),
  inlineContentSpecs: createCustomInlineContentSpecs({
    valueInline: headlessRenderers.valueInline,
  }),
  styleSpecs: createNoteStyleSpecs({
    textColor: headlessRenderers.textColor,
  }),
})
