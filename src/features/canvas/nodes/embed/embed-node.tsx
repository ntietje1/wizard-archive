import { useState } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { RichEmbedLifecycleController } from './use-rich-embed-lifecycle'
import {
  useCanvasEditSessionContext,
  useCanvasPermissionsContext,
} from '../../runtime/providers/canvas-runtime-hooks'
import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import type { EmbedNodeData } from './embed-node-data'
import { EmbedNoteContent } from './embed-note-content'
import { CanvasFloatingFormattingToolbar } from '../shared/canvas-floating-formatting-toolbar'
import { useCanvasEditableNodeSession } from '../shared/use-canvas-editable-node-session'
import type { Node, NodeProps } from '@xyflow/react'
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

export function EmbedNode({ id, data, dragging }: NodeProps<Node<EmbedNodeData>>) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const sidebarItemId = data.sidebarItemId
  const { itemsMap } = useActiveSidebarItems()
  const item = sidebarItemId ? itemsMap.get(sidebarItemId) : undefined
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)
  const { data: contentItem } = useSidebarItemById(sidebarItemId)
  const editSession = useCanvasEditSessionContext()
  const canEdit = useCanvasPermissionsContext()
  const editableSession = useCanvasEditableNodeSession({
    id,
    canEdit: canEdit && interactiveRenderMode,
    editing: editSession.editingEmbedId === id,
    setEditing: (editing) => editSession.setEditingEmbedId(editing ? id : null),
  })
  const isEditing = editableSession.editable && contentItem?.type === SIDEBAR_ITEM_TYPES.notes
  const noteEditor = contentItem?.type === SIDEBAR_ITEM_TYPES.notes ? editor : null
  const showsFormattingToolbar = isEditing && noteEditor !== null

  const label = item?.name ?? 'Missing item'
  const isMissing = !item
  const showFloatingLabel = !showsFormattingToolbar

  return (
    <ResizableNodeWrapper
      id={id}
      nodeType="embed"
      dragging={!!dragging}
      minWidth={240}
      minHeight={180}
      lockedAspectRatio={getLockedAspectRatio(contentItem, data.lockedAspectRatio)}
      editing={showsFormattingToolbar}
      chrome={
        <>
          <CanvasFloatingFormattingToolbar editor={noteEditor} visible={showsFormattingToolbar} />
          <CanvasNodeConnectionHandles
            selected={editableSession.isSelected}
            preserveAnchors={!interactiveRenderMode}
          />
          {showFloatingLabel && (
            <div className="pointer-events-none absolute left-3 top-0 z-20 max-w-[calc(100%-1.5rem)] -translate-y-[calc(100%+0.375rem)]">
              <span className="block truncate text-xs font-medium text-muted-foreground">
                {isMissing ? `Warning: ${label}` : label}
              </span>
            </div>
          )}
        </>
      }
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-lg shadow-sm"
        style={getCanvasNodeSurfaceStyle(data)}
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
              lifecycle={editableSession.lifecycle}
              onActivated={editableSession.handleActivated}
              onEditorChange={setEditor}
            />
          </div>
        )}
      </div>
    </ResizableNodeWrapper>
  )
}

function EmbedRichContent({
  nodeId,
  contentItem,
  isEditing,
  isExclusivelySelected,
  interactiveRenderMode,
  lifecycle,
  onActivated,
  onEditorChange,
}: {
  nodeId: string
  contentItem: AnySidebarItemWithContent | undefined
  isEditing: boolean
  isExclusivelySelected: boolean
  interactiveRenderMode: boolean
  lifecycle: RichEmbedLifecycleController
  onActivated: () => void
  onEditorChange: (editor: CustomBlockNoteEditor | null) => void
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
        lifecycle={lifecycle}
        onActivated={onActivated}
        onCanvasEditorChange={onEditorChange}
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
