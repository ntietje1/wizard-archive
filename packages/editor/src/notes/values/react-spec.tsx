import { createReactInlineContentSpec } from '@blocknote/react'
import { noteValueInlineConfig } from './block-config'
import { NoteValueInline } from './value-inline'

export const reactNoteValueInlineSpec = createReactInlineContentSpec(noteValueInlineConfig, {
  render: ({ inlineContent, updateInlineContent }) => (
    <NoteValueInline props={inlineContent.props} update={updateInlineContent} />
  ),
  toExternalHTML: ({ inlineContent }) => (
    <span
      data-note-value-inline="true"
      data-note-value-id={inlineContent.props.valueId}
      data-note-value-label={inlineContent.props.label}
      data-note-value-expression-source={inlineContent.props.expressionSource}
    >
      {inlineContent.props.label || inlineContent.props.expressionSource || 'value'}
    </span>
  ),
})
