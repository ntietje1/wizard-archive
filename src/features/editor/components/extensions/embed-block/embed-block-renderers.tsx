import { NoteEmbedBlockView } from './embed-block'
import { NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE } from './embed-block-html'
import type { NoteEmbedBlockProps } from './embed-block-targets'
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
  const blockProps = props.block.props as NoteEmbedBlockProps
  return (
    <section
      className="note-embed-block"
      data-content-type="embed"
      {...getExternalEmbedDataAttributes(blockProps)}
      {...{ [NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE]: 'true' }}
    >
      {getExternalEmbedLabel(blockProps)}
    </section>
  )
}

function mapEmbedRenderProps(props: EmbedBlockRenderProps): NoteEmbedBlockBaseProps {
  const editor = props.editor
  return {
    block: props.block,
    // BlockNote exposes editor methods with broader block shapes than
    // NoteEmbedBlockView accepts, so this adapter narrows them at the boundary.
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

function getExternalEmbedLabel(props: NoteEmbedBlockProps) {
  if (props.name) return props.name
  if (props.url) return props.url
  if (props.sidebarItemId) return 'Embedded item'
  return 'Empty embed'
}

function getExternalEmbedDataAttributes(props: NoteEmbedBlockProps) {
  return {
    'data-target-kind': props.targetKind,
    'data-sidebar-item-id': props.targetKind === 'sidebarItem' ? props.sidebarItemId : undefined,
    'data-url': props.targetKind === 'externalUrl' ? props.url : undefined,
    'data-name': props.targetKind === 'externalUrl' ? props.name : undefined,
    'data-preview-width': props.previewWidth,
    'data-preview-height': props.previewHeight,
    'data-preview-aspect-ratio': props.previewAspectRatio,
  }
}
