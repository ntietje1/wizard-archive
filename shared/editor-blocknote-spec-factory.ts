import {
  createInlineContentSpec,
  createStyleSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import { noteValueInlineConfig } from './note-values/block-config'
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
  ...defaultBlockSpecs,
} satisfies BlockSpecs
