import { BlockNoteSchema } from '@blocknote/core'
import { customBlockSpecs } from '../../../shared/editor-blocks/editor-blocknote-spec-factory'
import { customInlineContentSpecs, customStyleSpecs } from './editor-dom-specs'
import { createStaticEmbedBlockSpec } from './components/extensions/embed-block/embed-block-static-spec'
import type { Id } from 'convex/_generated/dataModel'

const { embed: _embed, ...blockSpecsWithoutEmbed } = customBlockSpecs

export function createStaticEditorSchemaWithEmbeds(sourceNoteId?: Id<'sidebarItems'> | null) {
  return BlockNoteSchema.create({
    blockSpecs: {
      ...blockSpecsWithoutEmbed,
      embed: createStaticEmbedBlockSpec(sourceNoteId ?? null),
    },
    inlineContentSpecs: customInlineContentSpecs,
    styleSpecs: customStyleSpecs,
  })
}
