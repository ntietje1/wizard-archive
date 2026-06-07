import { createBlockSpec } from '@blocknote/core'
import { createRoot } from 'react-dom/client'
import { embedBlockConfig } from '../../../../../../shared/editor-blocks/editor-blocknote-spec-factory'
import { EmbedContent } from '~/features/embeds/components/embed-content'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { cn } from '~/features/shadcn/lib/utils'
import { embedTargetFromBlockProps } from './embed-block-targets'
import type { Id } from 'convex/_generated/dataModel'
import type { NoteEmbedBlockProps } from './embed-block-targets'

export function createStaticEmbedBlockSpec(sourceNoteId: Id<'sidebarItems'> | null) {
  return createBlockSpec(embedBlockConfig, {
    render: (block) => {
      const dom = document.createElement('section')
      const contentDOM = document.createElement('span')
      const reactRootElement = document.createElement('div')
      const target = embedTargetFromBlockProps(block.props as NoteEmbedBlockProps)
      const width = positiveNumber(block.props.previewWidth)
      const height = positiveNumber(block.props.previewHeight)
      const root = createRoot(reactRootElement)

      dom.className = cn(
        'note-embed-block relative my-2 overflow-hidden rounded-lg border border-border bg-card text-card-foreground',
        target.kind === 'empty' && 'border-dashed bg-muted/20',
      )
      dom.dataset.noteEmbedDropTarget = 'true'
      if (width) dom.style.width = `${width}px`
      if (height) dom.style.height = `${height}px`
      dom.style.maxWidth = '100%'
      contentDOM.className = 'sr-only'
      dom.append(contentDOM, reactRootElement)

      root.render(
        <div className="min-h-36">
          <EmbedContent
            target={target}
            sourceItemId={sourceNoteId}
            mode="readonly"
            renderSidebarItem={(item) => <SidebarItemPreviewContent item={item} />}
          />
        </div>,
      )

      return {
        contentDOM,
        destroy: () => root.unmount(),
        dom,
      }
    },
  })()
}

function positiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}
