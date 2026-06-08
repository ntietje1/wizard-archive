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
  const viewProps = mapEmbedRenderProps(props)
  return (
    <NoteEmbedBlockView
      {...viewProps}
      editable={surface.editable}
      sourceNoteId={surface.sourceNoteId}
    />
  )
}

export function RenderExternalEmbedBlock(props: EmbedBlockRenderProps) {
  const surface = useNoteEmbedSurface()
  const viewProps = mapEmbedRenderProps(props)
  return <NoteEmbedBlockView {...viewProps} editable={false} sourceNoteId={surface.sourceNoteId} />
}

function mapEmbedRenderProps(props: EmbedBlockRenderProps): NoteEmbedBlockBaseProps {
  const editor = props.editor
  return {
    block: props.block,
    editor: {
      domElement: editor.domElement,
      replaceBlocks: (blocksToRemove, blocksToInsert) => {
        editor.replaceBlocks(
          blocksToRemove as Parameters<typeof editor.replaceBlocks>[0],
          blocksToInsert as Parameters<typeof editor.replaceBlocks>[1],
        )
      },
      setTextCursorPosition: editor.setTextCursorPosition
        ? (targetBlock, placement) => {
            editor.setTextCursorPosition!(
              targetBlock as Parameters<NonNullable<typeof editor.setTextCursorPosition>>[0],
              placement,
            )
          }
        : undefined,
      updateBlock: (block, update) => {
        editor.updateBlock(
          block as Parameters<typeof editor.updateBlock>[0],
          update as Parameters<typeof editor.updateBlock>[1],
        )
      },
    },
  }
}
