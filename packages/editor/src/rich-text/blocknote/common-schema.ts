import {
  COLORS_DEFAULT,
  createStyleSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultProps,
  defaultStyleSpecs,
} from '@blocknote/core'
import type { CustomStyleImplementation, StyleSpecs } from '@blocknote/core'

export const commonRichTextBlockSpecs = {
  paragraph: defaultBlockSpecs.paragraph,
  heading: defaultBlockSpecs.heading,
  bulletListItem: defaultBlockSpecs.bulletListItem,
  numberedListItem: defaultBlockSpecs.numberedListItem,
  checkListItem: defaultBlockSpecs.checkListItem,
  quote: defaultBlockSpecs.quote,
  codeBlock: defaultBlockSpecs.codeBlock,
}

export const commonRichTextInlineContentSpecs = { text: defaultInlineContentSpecs.text }

type TextColorStyleConfig = { propSchema: 'string'; type: 'textColor' }
const TEXT_COLOR_STYLE_CONFIG = {
  propSchema: 'string',
  type: 'textColor',
} satisfies TextColorStyleConfig

export function createCommonRichTextStyleSpecs(
  textColor: CustomStyleImplementation<TextColorStyleConfig>,
) {
  return {
    ...defaultStyleSpecs,
    textColor: createStyleSpec(TEXT_COLOR_STYLE_CONFIG, textColor),
  } satisfies StyleSpecs
}

export function renderRichTextColorStyle(value: string | undefined) {
  const element = document.createElement('span')
  const color = resolveRichTextColor(value, 'text')
  if (color) element.style.color = color
  return { contentDOM: element, dom: element }
}

export function resolveRichTextColor(
  value: string | undefined,
  surface: 'background' | 'text',
): string | undefined {
  if (!value || value === defaultProps.textColor.default) return undefined
  return COLORS_DEFAULT[value]?.[surface] ?? value
}
