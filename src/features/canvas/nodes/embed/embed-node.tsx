import { useEffect, useRef, useState } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { PendingRichEmbedActivationRef } from './use-rich-embed-lifecycle'
import { normalizeEmbedNodeData } from './embed-node-data'
import {
  useCanvasDomRuntime,
  useCanvasInteractionServices,
} from '../../runtime/providers/canvas-runtime'
import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import type { EmbedNodeData } from './embed-node-data'
import { EmbedNoteContent } from './embed-note-content'
import { CanvasFloatingFormattingToolbar } from '../shared/canvas-floating-formatting-toolbar'
import { useCanvasEditableNodeSession } from '../shared/use-canvas-editable-node-session'
import type { AnySidebarItemWithContent } from 'convex/sidebarItems/types/types'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { cn } from '~/features/shadcn/lib/utils'
import { CanvasNodeConnectionHandles } from '../shared/canvas-node-connection-handles'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import { getCanvasNodeSurfaceStyle } from '../shared/canvas-node-surface-style'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { resolveFilePreviewImageUrl } from '~/features/editor/components/viewer/file/file-preview-source'
import { EmbeddedCanvasContent } from './embedded-canvas-content'
import { EmbeddedFileContent } from './embedded-file-content'
import { EmbeddedMapContent } from './embedded-map-content'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasViewportZoom } from '../../react/use-canvas-engine'
import type { CanvasNodeComponentProps } from '../canvas-node-types'

const EMBED_FLOATING_LABEL_GAP_PX = 6
const EMBED_FLOATING_LABEL_LINE_HEIGHT_PX = 16

export function EmbedNode({ id, data, dragging }: CanvasNodeComponentProps<EmbedNodeData>) {
  const normalizedData = normalizeEmbedNodeData(data)
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const sidebarItemId = normalizedData.sidebarItemId
  const { itemsMap } = useActiveSidebarItems()
  const item = sidebarItemId ? itemsMap.get(sidebarItemId) : undefined
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)
  const { data: contentItem } = useSidebarItemById(sidebarItemId)
  const domRuntime = useCanvasDomRuntime()
  const { editSession, canEdit } = useCanvasInteractionServices()
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const editableSession = useCanvasEditableNodeSession({
    id,
    canEdit: canEdit && interactiveRenderMode,
    editing: editSession.editingEmbedId === id,
    setEditing: (editing) => editSession.setEditingEmbedId(editing ? id : null),
  })
  const isEditing = editableSession.editable && contentItem?.type === SIDEBAR_ITEM_TYPES.notes
  const noteEditor = contentItem?.type === SIDEBAR_ITEM_TYPES.notes ? editor : null
  const showsFormattingToolbar = isEditing && noteEditor !== null

  const zoom = useCanvasViewportZoom()
  const label = item?.name ?? 'Missing item'
  const isMissing = !item
  const showFloatingLabel = !showsFormattingToolbar

  useEffect(() => domRuntime.registerNodeSurfaceElement(id, surfaceRef.current), [domRuntime, id])

  return (
    <ResizableNodeWrapper
      id={id}
      nodeType="embed"
      dragging={!!dragging}
      minWidth={240}
      minHeight={180}
      lockedAspectRatio={getLockedAspectRatio(contentItem, normalizedData.lockedAspectRatio)}
      editing={showsFormattingToolbar}
      chrome={
        <>
          <CanvasFloatingFormattingToolbar editor={noteEditor} visible={showsFormattingToolbar} />
          <CanvasNodeConnectionHandles />
          {showFloatingLabel && (
            <EmbedFloatingLabel label={label} missing={isMissing} zoom={zoom} />
          )}
        </>
      }
    >
      <div
        ref={surfaceRef}
        className={cn(
          'relative h-full w-full overflow-hidden rounded-lg',
          isEditing ? 'select-text' : 'select-none',
        )}
        style={getCanvasNodeSurfaceStyle(normalizedData)}
        onDoubleClick={(event) => {
          if (!interactiveRenderMode || contentItem?.type !== SIDEBAR_ITEM_TYPES.notes) {
            return
          }

          event.preventDefault()
          event.stopPropagation()
          editableSession.handleDoubleClick(event)
        }}
      >
        {!isMissing && (
          <div className="h-full w-full min-h-0 min-w-0">
            <EmbedRichContent
              nodeId={id}
              contentItem={contentItem}
              isEditing={isEditing}
              isExclusivelySelected={editableSession.isExclusivelySelected}
              interactiveRenderMode={interactiveRenderMode}
              onActivated={editableSession.handleActivated}
              onEditorChange={setEditor}
              pendingActivationRef={editableSession.pendingActivationRef}
            />
          </div>
        )}
      </div>
    </ResizableNodeWrapper>
  )
}

function EmbedFloatingLabel({
  label,
  missing,
  zoom,
}: {
  label: string
  missing: boolean
  zoom: number
}) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1

  return (
    <div
      data-testid="embed-node-floating-label-frame"
      className="pointer-events-none absolute left-0 top-0 z-20 w-full select-none"
      style={{
        height: EMBED_FLOATING_LABEL_LINE_HEIGHT_PX / safeZoom,
        transform: `translateY(calc(-100% - ${EMBED_FLOATING_LABEL_GAP_PX / safeZoom}px))`,
      }}
    >
      <span
        data-testid="embed-node-floating-label"
        className="absolute bottom-0 left-0 block truncate text-xs font-medium text-muted-foreground"
        style={{
          lineHeight: `${EMBED_FLOATING_LABEL_LINE_HEIGHT_PX}px`,
          transform: `scale(${1 / safeZoom})`,
          transformOrigin: 'left bottom',
          width: `${safeZoom * 100}%`,
        }}
      >
        {missing ? `Warning: ${label}` : label}
      </span>
    </div>
  )
}

function EmbedRichContent({
  nodeId,
  contentItem,
  isEditing,
  isExclusivelySelected,
  interactiveRenderMode,
  onActivated,
  onEditorChange,
  pendingActivationRef,
}: {
  nodeId: string
  contentItem: AnySidebarItemWithContent | undefined
  isEditing: boolean
  isExclusivelySelected: boolean
  interactiveRenderMode: boolean
  onActivated: () => void
  onEditorChange: (editor: CustomBlockNoteEditor | null) => void
  pendingActivationRef: PendingRichEmbedActivationRef
}): React.ReactElement | null {
  if (!contentItem) {
    return (
      <div className="h-full flex items-center justify-center opacity-50">
        <div className="h-3 w-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
      </div>
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.notes) {
    return (
      <EmbedNoteContent
        noteId={contentItem._id}
        content={contentItem.content}
        editable={isEditing}
        isExclusivelySelected={isExclusivelySelected}
        onActivated={onActivated}
        onCanvasEditorChange={onEditorChange}
        pendingActivationRef={pendingActivationRef}
      />
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.canvases) {
    return interactiveRenderMode ? (
      <EmbeddedCanvasContent
        nodeId={nodeId}
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
      <EmbeddedMapContent nodeId={nodeId} map={contentItem} />
    ) : (
      <SidebarItemPreviewContent item={contentItem} />
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.files) {
    return interactiveRenderMode ? (
      <EmbeddedFileContent nodeId={nodeId} file={contentItem} />
    ) : (
      <SidebarItemPreviewContent item={contentItem} />
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

function getLockedAspectRatio(
  contentItem: AnySidebarItemWithContent | undefined,
  lockedAspectRatio: number | undefined,
) {
  if (contentItem?.type === SIDEBAR_ITEM_TYPES.gameMaps) {
    return lockedAspectRatio
  }

  if (contentItem?.type === SIDEBAR_ITEM_TYPES.files) {
    const hasVisualPreview =
      resolveFilePreviewImageUrl({
        downloadUrl: contentItem.downloadUrl,
        contentType: contentItem.contentType,
        previewUrl: contentItem.previewUrl,
      }) !== null

    return hasVisualPreview ? lockedAspectRatio : undefined
  }

  return undefined
}
