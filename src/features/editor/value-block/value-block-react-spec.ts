import { createElement } from 'react'
import { createReactInlineContentSpec } from '@blocknote/react'
import { noteValueInlineConfig } from '../../../../shared/note-values/block-config'
import { ValueInlineContent } from './value-block-spec'

const valueInlineSpec = createReactInlineContentSpec(noteValueInlineConfig, {
  render: (props) =>
    createElement(ValueInlineContent, {
      inlineContent: props.inlineContent,
      updateInlineContent: props.updateInlineContent,
    }),
  toExternalHTML: (props) =>
    createElement(
      'span',
      null,
      props.inlineContent.props.slug || props.inlineContent.props.expressionSource || 'value',
    ),
})

export function createReactValueInlineSpec() {
  return valueInlineSpec
}
