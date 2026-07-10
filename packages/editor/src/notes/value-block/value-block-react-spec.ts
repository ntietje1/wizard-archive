import { createElement } from 'react'
import { createReactInlineContentSpec } from '@blocknote/react'
import { noteValueInlineConfig } from '../values/block-config'
import { getValueInlineText, parseValueInlineExternalElement } from '../values/external-format'
import { ValueInlineContent } from './value-block-spec'

export const reactValueInlineSpec = createReactInlineContentSpec(noteValueInlineConfig, {
  parse: parseValueInlineExternalElement,
  render: (props) =>
    createElement(ValueInlineContent, {
      inlineContent: props.inlineContent,
      updateInlineContent: props.updateInlineContent,
    }),
  toExternalHTML: (props) =>
    createElement(
      'span',
      {
        'data-note-value-expression-source': props.inlineContent.props.expressionSource,
        'data-note-value-id': props.inlineContent.props.valueId,
        'data-note-value-inline': 'true',
        'data-note-value-slug': props.inlineContent.props.slug,
      },
      getValueInlineText(props.inlineContent.props),
    ),
})
