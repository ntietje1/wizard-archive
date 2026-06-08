import { NoteEmbedBlockView } from './embed-block'
import { useNoteEmbedSurface } from './note-embed-surface-context-value'
import type { embedBlockConfig } from '../../../../../../shared/editor-blocks/editor-blocknote-spec-factory'
import type { ReactCustomBlockRenderProps } from '@blocknote/react'
import type { ComponentProps } from 'react'

type EmbedBlockRenderProps = ReactCustomBlockRenderProps<
  'embed',
  typeof embedBlockConfig.propSchema,
  'none'
>
type NoteEmbedBlockBaseProps = Omit<
  ComponentProps<typeof NoteEmbedBlockView>,
  'editable' | 'sourceNoteId'
>

export function RenderEmbedBlock(props: EmbedBlockRenderProps) {
  const surface = useNoteEmbedSurface()
  const viewProps = props as unknown as NoteEmbedBlockBaseProps
  return (
    <NoteEmbedBlockView
      {...viewProps}
      editable={surface.editable}
      sourceNoteId={surface.sourceNoteId}
    />
  )
}

export function RenderExternalEmbedBlock(
  props: EmbedBlockRenderProps & { context: { nestingLevel: number } },
) {
  const surface = useNoteEmbedSurface()
  const viewProps = props as unknown as NoteEmbedBlockBaseProps
  return <NoteEmbedBlockView {...viewProps} editable={false} sourceNoteId={surface.sourceNoteId} />
}
