import { createBlockSpec, createInlineContentSpec, defaultBlockSpecs } from '@blocknote/core'
import { noteResourceLinkInlineConfig } from '../links/resource-link-model'
import { noteValueInlineConfig } from '../values/block-config'
import { EMPTY_AUTHORED_DESTINATION_SERIALIZED } from '../../resources/authored-destination'
import type {
  BlockSpecs,
  CustomInlineContentImplementation,
  InlineContentSpecs,
  StyleSchema,
} from '@blocknote/core'
import {
  commonRichTextBlockSpecs,
  commonRichTextInlineContentSpecs,
} from '../../rich-text/blocknote/common-schema'

type ValueInlineRenderer = CustomInlineContentImplementation<
  typeof noteValueInlineConfig,
  StyleSchema
>

type NoteDocumentSpecRenderers = {
  resourceLink: CustomInlineContentImplementation<typeof noteResourceLinkInlineConfig, StyleSchema>
  valueInline: ValueInlineRenderer
}

type EmbedBlockRenderer = () => { dom: HTMLElement }

export const embedBlockConfig = {
  type: 'embed',
  propSchema: {
    destination: { default: EMPTY_AUTHORED_DESTINATION_SERIALIZED },
    backgroundColor: { default: 'default', type: 'string' },
    textAlignment: {
      default: 'left',
      values: ['left', 'center', 'right', 'justify'] as const,
    },
    previewWidth: { default: undefined, type: 'number' },
    previewHeight: { default: undefined, type: 'number' },
    previewAspectRatio: { default: undefined, type: 'number' },
  },
  content: 'none',
} as const

function createEmbedBlockSpec(render: EmbedBlockRenderer) {
  return createBlockSpec(embedBlockConfig, { render })()
}

export function createCustomInlineContentSpecs(
  renderers: Pick<NoteDocumentSpecRenderers, 'resourceLink' | 'valueInline'>,
) {
  const resourceLinkSpec = createInlineContentSpec(
    noteResourceLinkInlineConfig,
    renderers.resourceLink,
  )
  const valueInlineSpec = createInlineContentSpec(noteValueInlineConfig, renderers.valueInline)
  return {
    ...commonRichTextInlineContentSpecs,
    resourceLink: resourceLinkSpec,
    value: valueInlineSpec,
  } as InlineContentSpecs & {
    resourceLink: typeof resourceLinkSpec
    value: typeof valueInlineSpec
  }
}

export function createNoteBlockSpecs({
  renderEmbedBlock,
}: {
  renderEmbedBlock: EmbedBlockRenderer
}) {
  return createNoteBlockSpecsWithEmbed(createEmbedBlockSpec(renderEmbedBlock))
}

export function createNoteBlockSpecsWithEmbed<TEmbed extends BlockSpecs[string]>(embed: TEmbed) {
  return {
    ...commonRichTextBlockSpecs,
    toggleListItem: defaultBlockSpecs.toggleListItem,
    divider: defaultBlockSpecs.divider,
    table: defaultBlockSpecs.table,
    embed,
  } satisfies BlockSpecs
}
