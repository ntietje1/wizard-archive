import {
  createBlockSpec,
  createInlineContentSpec,
  createStyleSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import { noteValueInlineConfig } from '../note-values/block-config'
import type {
  BlockSpecs,
  CustomInlineContentImplementation,
  CustomStyleImplementation,
  InlineContentSpecs,
  StyleSchema,
  StyleSpecs,
} from '@blocknote/core'

type TextColorStyleConfig = {
  propSchema: 'string'
  type: 'textColor'
}
type StyleRenderer = CustomStyleImplementation<TextColorStyleConfig>
type ValueInlineRenderer = CustomInlineContentImplementation<
  typeof noteValueInlineConfig,
  StyleSchema
>

type EditorSpecRenderers = {
  valueInline: ValueInlineRenderer
  textColor: StyleRenderer
}

const TEXT_COLOR_STYLE_CONFIG = {
  propSchema: 'string',
  type: 'textColor',
} satisfies TextColorStyleConfig

const { link: _link, ...inlineContentWithoutLinks } = defaultInlineContentSpecs
const {
  image: _image,
  video: _video,
  audio: _audio,
  file: _file,
  ...defaultBlockSpecsWithoutMedia
} = defaultBlockSpecs

export const embedBlockConfig = {
  type: 'embed',
  propSchema: {
    targetKind: {
      default: 'empty',
      values: ['empty', 'sidebarItem', 'externalUrl'] as const,
    },
    sidebarItemId: { default: undefined, type: 'string' },
    url: { default: undefined, type: 'string' },
    name: { default: undefined, type: 'string' },
    backgroundColor: { default: 'default' },
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

const embedBlockSpec = createBlockSpec(embedBlockConfig, {
  render: () => {
    const dom = document.createElement('div')
    return { dom }
  },
})()

export function createCustomInlineContentSpecs(
  renderers: Pick<EditorSpecRenderers, 'valueInline'>,
) {
  const valueInlineSpec = createInlineContentSpec(noteValueInlineConfig, renderers.valueInline)
  return {
    ...inlineContentWithoutLinks,
    value: valueInlineSpec,
  } as InlineContentSpecs & { value: typeof valueInlineSpec }
}

export function createCustomStyleSpecs(renderers: Pick<EditorSpecRenderers, 'textColor'>) {
  const textColorStyleSpec = createStyleSpec(TEXT_COLOR_STYLE_CONFIG, renderers.textColor)
  return {
    ...defaultStyleSpecs,
    textColor: textColorStyleSpec,
  } satisfies StyleSpecs
}

export const customBlockSpecs = {
  ...defaultBlockSpecsWithoutMedia,
  embed: embedBlockSpec,
} satisfies BlockSpecs

export const legacyMediaDecodeBlockSpecs = {
  ...defaultBlockSpecs,
  embed: embedBlockSpec,
} satisfies BlockSpecs
