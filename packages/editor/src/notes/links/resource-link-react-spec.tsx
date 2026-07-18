import { createReactInlineContentSpec } from '@blocknote/react'
import {
  parseNoteResourceLinkExternalElement,
  noteResourceLinkText,
} from './resource-link-external'
import { NoteResourceLinkInline } from './resource-link-inline'
import { noteResourceLinkInlineConfig } from './resource-link-model'

export const reactNoteResourceLinkInlineSpec = createReactInlineContentSpec(
  noteResourceLinkInlineConfig,
  {
    parse: parseNoteResourceLinkExternalElement,
    render: ({ inlineContent }) => <NoteResourceLinkInline props={inlineContent.props} />,
    toExternalHTML: ({ inlineContent }) => (
      <span
        data-note-resource-link="true"
        data-note-resource-link-destination={inlineContent.props.destination}
        data-note-resource-link-label={inlineContent.props.label}
      >
        {noteResourceLinkText(inlineContent.props)}
      </span>
    ),
  },
)
