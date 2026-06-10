import { createContext, use } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { PendingRichEmbedActivationRef } from '../hooks/use-rich-embed-lifecycle'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { EmbedNoteContent } from './canvas-embed-note-content'
import { EmbeddedCanvasContent } from './embedded-canvas-content'
import { EmbeddedMapContent } from './embedded-map-content'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { FileMediaEmbedContent } from '~/features/previews/components/file-media-embed-content'
import { cn } from '~/features/shadcn/lib/utils'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { EmbedMediaLayoutReporter } from '../utils/embed-media'

export type CanvasSidebarItemEmbedContextValue = {
  isEditing: boolean
  isExclusivelySelected: boolean
  interactiveRenderMode: boolean
  onActivated: () => void
  onEditorChange: (editor: CustomBlockNoteEditor | null) => void
  pendingActivationRef: PendingRichEmbedActivationRef
  textColor: string | null
}

const CanvasSidebarItemEmbedContext = createContext<CanvasSidebarItemEmbedContextValue | null>(null)

export function CanvasSidebarItemEmbedProvider({
  children,
  value,
}: {
  children: ReactNode
  value: CanvasSidebarItemEmbedContextValue
}) {
  return (
    <CanvasSidebarItemEmbedContext.Provider value={value}>
      {children}
    </CanvasSidebarItemEmbedContext.Provider>
  )
}

export function CanvasSidebarItemEmbedRenderer({
  item,
  allowInnerScroll = true,
  onMediaLayout,
}: {
  item: AnySidebarItemWithContent
  allowInnerScroll?: boolean
  onMediaLayout?: EmbedMediaLayoutReporter
}) {
  const context = use(CanvasSidebarItemEmbedContext)
  if (!context) {
    throw new Error(
      'CanvasSidebarItemEmbedRenderer must be used within CanvasSidebarItemEmbedProvider',
    )
  }

  return (
    <CanvasSidebarItemEmbedContent
      {...context}
      contentItem={item}
      allowInnerScroll={allowInnerScroll}
      onMediaLayout={onMediaLayout}
    />
  )
}

function CanvasSidebarItemEmbedContent({
  allowInnerScroll,
  contentItem,
  isEditing,
  isExclusivelySelected,
  interactiveRenderMode,
  onActivated,
  onEditorChange,
  onMediaLayout,
  pendingActivationRef,
  textColor,
}: {
  allowInnerScroll: boolean
  contentItem: AnySidebarItemWithContent
  isEditing: boolean
  isExclusivelySelected: boolean
  interactiveRenderMode: boolean
  onActivated: () => void
  onEditorChange: (editor: CustomBlockNoteEditor | null) => void
  onMediaLayout?: EmbedMediaLayoutReporter
  pendingActivationRef: PendingRichEmbedActivationRef
  textColor: string | null
}): ReactElement | null {
  if (contentItem.type === SIDEBAR_ITEM_TYPES.notes) {
    return (
      <EmbedNoteContent
        note={contentItem}
        editable={isEditing}
        isExclusivelySelected={isExclusivelySelected}
        onActivated={onActivated}
        onCanvasEditorChange={onEditorChange}
        pendingActivationRef={pendingActivationRef}
        textColor={textColor}
      />
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.canvases) {
    return interactiveRenderMode ? (
      <EmbeddedCanvasContent
        canvasId={contentItem._id}
        previewUrl={contentItem.previewUrl}
        alt={contentItem.name}
      />
    ) : (
      <SidebarItemPreviewContent item={contentItem} />
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.gameMaps) {
    return interactiveRenderMode ? (
      <EmbeddedMapContent map={contentItem} onMediaLayout={onMediaLayout} />
    ) : (
      <SidebarItemPreviewContent item={contentItem} />
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.files) {
    return (
      <FileMediaEmbedContent
        downloadUrl={contentItem.downloadUrl}
        contentType={contentItem.contentType}
        previewUrl={contentItem.previewUrl}
        name={contentItem.name}
        allowInnerScroll={allowInnerScroll}
        onMediaLayout={onMediaLayout}
      />
    )
  }

  const hasScrollableContent = contentItem.type === SIDEBAR_ITEM_TYPES.folders

  return (
    <div
      className={cn(
        'h-full overflow-hidden',
        hasScrollableContent && interactiveRenderMode && isExclusivelySelected && 'nowheel',
      )}
    >
      <SidebarItemPreviewContent item={contentItem} />
    </div>
  )
}
