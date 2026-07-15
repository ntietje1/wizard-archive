import {
  createBlockSpec,
  createInlineContentSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from '@blocknote/core'
import { noteValueInlineConfig } from '../values/block-config'
import { EMPTY_AUTHORED_DESTINATION_SERIALIZED } from '../../resources/authored-destination'
import type {
  BlockSpecs,
  CustomInlineContentImplementation,
  InlineContentSpecs,
  StyleSchema,
} from '@blocknote/core'

type ValueInlineRenderer = CustomInlineContentImplementation<
  typeof noteValueInlineConfig,
  StyleSchema
>

type NoteDocumentSpecRenderers = {
  valueInline: ValueInlineRenderer
}

type EmbedBlockRenderer = () => { dom: HTMLElement }

const { link: _link, ...inlineContentWithoutLinks } = defaultInlineContentSpecs
const {
  image: _image,
  video: _video,
  audio: _audio,
  file: _file,
  ...defaultBlockSpecsWithoutMedia
} = defaultBlockSpecs

const embedBlockConfig = {
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
  renderers: Pick<NoteDocumentSpecRenderers, 'valueInline'>,
) {
  const valueInlineSpec = createInlineContentSpec(noteValueInlineConfig, renderers.valueInline)
  return {
    ...inlineContentWithoutLinks,
    value: valueInlineSpec,
  } as InlineContentSpecs & { value: typeof valueInlineSpec }
}

export function createNoteBlockSpecs({
  renderEmbedBlock,
}: {
  renderEmbedBlock: EmbedBlockRenderer
}) {
  return {
    ...defaultBlockSpecsWithoutMedia,
    embed: createEmbedBlockSpec(renderEmbedBlock),
  } satisfies BlockSpecs
}
