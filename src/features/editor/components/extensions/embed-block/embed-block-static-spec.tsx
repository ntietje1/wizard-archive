import { createBlockSpec } from '@blocknote/core'
import { createRoot } from 'react-dom/client'
import { embedBlockConfig } from '../../../../../../shared/editor-blocks/editor-blocknote-spec-factory'
import { EmbedContent } from '~/features/embeds/components/embed-content'
import { cn } from '~/features/shadcn/lib/utils'
import { DEFAULT_NOTE_EMBED_PREVIEW_WIDTH, embedTargetFromBlockProps } from './embed-block-targets'
import { getDocumentEmbedAspectRatioForTarget } from '~/features/embeds/utils/document-embed-layout'
import type { Id } from 'convex/_generated/dataModel'
import type { NoteEmbedBlockProps } from './embed-block-targets'
import { SidebarItemPreviewRenderer } from './sidebar-item-preview-renderer'

export function createStaticEmbedBlockSpec(sourceNoteId: Id<'sidebarItems'> | null) {
  return createBlockSpec(embedBlockConfig, {
    render: (block) => {
      const dom = document.createElement('section')
      const reactRootElement = document.createElement('div')
      const target = embedTargetFromBlockProps(block.props as NoteEmbedBlockProps)
      const width =
        positiveNumber(block.props.previewWidth) ??
        (target.kind !== 'empty' ? DEFAULT_NOTE_EMBED_PREVIEW_WIDTH : undefined)
      const aspectRatio =
        positiveNumber(block.props.previewAspectRatio) ??
        getDocumentEmbedAspectRatioForTarget(target)
      const height = aspectRatio ? undefined : positiveNumber(block.props.previewHeight)
      const root = createRoot(reactRootElement)

      dom.className = cn(
        'note-embed-block relative my-2 overflow-hidden border border-border bg-card text-card-foreground',
        target.kind === 'empty' && 'border-dashed bg-muted/20',
      )
      if (width) dom.style.width = `${width}px`
      dom.style.maxWidth = '100%'
      dom.append(reactRootElement)

      root.render(
        <div
          className="min-h-36 w-full min-w-full overflow-hidden"
          style={getStaticEmbedBodyStyle({ aspectRatio: aspectRatio ?? undefined, height })}
        >
          <EmbedContent
            target={target}
            sourceItemId={sourceNoteId}
            mode="readonly"
            SidebarItemRenderer={SidebarItemPreviewRenderer}
          />
        </div>,
      )

      return {
        destroy: () => root.unmount(),
        dom,
      }
    },
  })()
}

function positiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function getStaticEmbedBodyStyle({
  aspectRatio,
  height,
}: {
  aspectRatio: number | undefined
  height: number | undefined
}) {
  if (aspectRatio) return { aspectRatio: `${aspectRatio} / 1` }
  if (height) return { height }
  return undefined
}
