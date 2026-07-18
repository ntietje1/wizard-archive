import { BlockNoteSchema } from '@blocknote/core'
import type { BlockNoteEditor } from '@blocknote/core'
import { createNoteBlockSpecsWithEmbed } from './document/schema-factory'
import { noteInlineContentSpecs, noteStyleSpecs } from './dom-specs'
import { reactNoteValueInlineSpec } from './values/react-spec'
import { reactNoteResourceLinkInlineSpec } from './links/resource-link-react-spec'
import { noteEmbedBlockSpec } from './embeds/note-embed-block-spec'

const noteBlockSpecs = createNoteBlockSpecsWithEmbed(noteEmbedBlockSpec)
const {
  resourceLink: _resourceLink,
  value: _value,
  ...defaultNoteInlineContentSpecs
} = noteInlineContentSpecs

export const noteEditorSchema = BlockNoteSchema.create({
  blockSpecs: noteBlockSpecs,
  inlineContentSpecs: {
    ...defaultNoteInlineContentSpecs,
    resourceLink: reactNoteResourceLinkInlineSpec,
    value: reactNoteValueInlineSpec,
  },
  styleSpecs: noteStyleSpecs,
})

export type NoteBlockNoteEditor = BlockNoteEditor<
  typeof noteEditorSchema.blockSchema,
  typeof noteEditorSchema.inlineContentSchema,
  typeof noteEditorSchema.styleSchema
>
