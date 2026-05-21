import {
  COLORS_DEFAULT,
  createInlineContentSpec,
  createStyleSpec,
  defaultInlineContentSpecs,
  defaultProps,
  defaultStyleSpecs,
} from '@blocknote/core'
import { noteValueInlineConfig } from '../../../shared/note-values/block-config'
import { customBlockSpecs } from '../../../shared/editor-blocknote-schema'
import type { InlineContentSpecs, StyleSpecs } from '@blocknote/core'

const { link: _link, ...remainingInlineContentSpecs } = defaultInlineContentSpecs

const valueInlineSpec = createInlineContentSpec(noteValueInlineConfig, {
  render: (inlineContent) => {
    const element = document.createElement('span')
    element.textContent = inlineContent.props.slug || 'value'
    element.dataset.valueInline = 'true'
    return { dom: element }
  },
  toExternalHTML: (inlineContent) => {
    const element = document.createElement('span')
    element.textContent = inlineContent.props.slug || 'value'
    return { dom: element }
  },
})

function renderTextColorStyle(value: string | undefined) {
  const span = document.createElement('span')
  if (value && value !== defaultProps.textColor.default) {
    span.style.color = COLORS_DEFAULT[value]?.text ?? value
  }

  return {
    contentDOM: span,
    dom: span,
  }
}

const textColorStyleSpec = createStyleSpec(
  {
    propSchema: 'string',
    type: 'textColor',
  },
  {
    parse: (element) => {
      if (element.tagName === 'SPAN' && element.style.color) {
        return element.style.color
      }

      return undefined
    },
    render: (value) => renderTextColorStyle(value),
    toExternalHTML: (value) => renderTextColorStyle(value),
  },
)

export { customBlockSpecs }

export const customInlineContentSpecs = {
  ...remainingInlineContentSpecs,
  value: valueInlineSpec,
} as InlineContentSpecs & {
  value: typeof valueInlineSpec
}

export const customStyleSpecs = {
  ...defaultStyleSpecs,
  textColor: textColorStyleSpec,
} satisfies StyleSpecs
