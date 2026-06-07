import { RawNoteContent } from './raw-note-content'
import { createStaticEditorSchemaWithEmbeds } from '../static-editor-schema-with-embeds'
import type { ComponentProps } from 'react'

type RawNoteContentWithEmbedsProps = Omit<ComponentProps<typeof RawNoteContent>, 'schemaFactory'>

export function RawNoteContentWithEmbeds(props: RawNoteContentWithEmbedsProps) {
  return <RawNoteContent {...props} schemaFactory={createStaticEditorSchemaWithEmbeds} />
}
