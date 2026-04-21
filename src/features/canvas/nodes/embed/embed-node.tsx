import { useEffect, useState } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { RichEmbedLifecycleController } from './use-rich-embed-lifecycle'
import { useRichEmbedActivation } from './use-rich-embed-lifecycle'
import {
  useIsCanvasNodeSelected,
  useSelectedCanvasNodeIds,
} from '../../runtime/selection/use-canvas-selection-state'
import { isExclusivelySelectedNode } from '../../utils/canvas-selection-utils'
import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import type { EmbedNodeData } from './embed-node-data'
import { EmbedNoteContent } from './embed-note-content'
import { CanvasFloatingFormattingToolbar } from '../shared/canvas-floating-formatting-toolbar'
import { ItemPreviewContent } from '~/features/editor/components/item-preview-content'
import type { Node, NodeProps } from '@xyflow/react'
import type { AnySidebarItemWithContent } from 'convex/sidebarItems/types/types'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { cn } from '~/features/shadcn/lib/utils'
import { CanvasNodeConnectionHandles } from '../shared/canvas-node-connection-handles'
import {
  useCanvasEditSessionContext,
  useCanvasPermissionsContext,
} from '../../runtime/providers/canvas-runtime-hooks'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'

export function EmbedNode({ id, data, dragging }: NodeProps<Node<EmbedNodeData>>) {
  const sidebarItemId = data.sidebarItemId
  const { itemsMap } = useActiveSidebarItems()
  const item = sidebarItemId ? itemsMap.get(sidebarItemId) : undefined
  const isSelected = useIsCanvasNodeSelected(id)
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)

  const { data: contentItem } = useSidebarItemById(sidebarItemId)

  const editSession = useCanvasEditSessionContext()
  const canEdit = useCanvasPermissionsContext()
  const { editingEmbedId, setEditingEmbedId } = editSession
  const selectedNodeIds = useSelectedCanvasNodeIds()
  const isExclusivelySelected = isExclusivelySelectedNode(selectedNodeIds, id)
  const isEditing = editingEmbedId === id && isExclusivelySelected
  const noteEditor = contentItem?.type === SIDEBAR_ITEM_TYPES.notes ? editor : null
  const showsFormattingToolbar = isEditing && noteEditor !== null

  useEffect(() => {
    if (editingEmbedId === id && !isExclusivelySelected) {
      setEditingEmbedId(null)
    }
  }, [editingEmbedId, id, isExclusivelySelected, setEditingEmbedId])

  const { lifecycle, handleDoubleClick } = useRichEmbedActivation({
    canEdit: canEdit && isExclusivelySelected,
    embedId: id,
    setEditingEmbedId,
  })

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
      editing={showsFormattingToolbar}
    >
      <CanvasFloatingFormattingToolbar editor={noteEditor} visible={showsFormattingToolbar} />
      <CanvasNodeConnectionHandles selected={isSelected} />
      {showFloatingLabel && (
        <div className="pointer-events-none absolute left-3 top-0 z-20 max-w-[calc(100%-1.5rem)] -translate-y-[calc(100%+0.375rem)]">
          <span className="block truncate text-xs font-medium text-muted-foreground">
            {isMissing ? `Warning: ${label}` : label}
          </span>
        </div>
      )}
      <div
        className="relative h-full w-full overflow-hidden rounded-lg border bg-card shadow-sm"
        onDoubleClick={handleDoubleClick}
      >
        {!isMissing && (
          <div className="h-full">
            <EmbedRichContent
              contentItem={contentItem}
              isEditing={isEditing}
              isExclusivelySelected={isExclusivelySelected}
              lifecycle={lifecycle}
              onEditorChange={setEditor}
            />
          </div>
        )}
      </div>
    </ResizableNodeWrapper>
  )
}

function EmbedRichContent({
  contentItem,
  isEditing,
  isExclusivelySelected,
  lifecycle,
  onEditorChange,
}: {
  contentItem: AnySidebarItemWithContent | undefined
  isEditing: boolean
  isExclusivelySelected: boolean
  lifecycle: RichEmbedLifecycleController
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
        onCanvasEditorChange={onEditorChange}
      />
    )
  }

  const hasScrollableContent = contentItem.type === SIDEBAR_ITEM_TYPES.folders

  return (
    <div
      className={cn(
        'h-full overflow-hidden',
        hasScrollableContent && isExclusivelySelected && 'nowheel',
      )}
    >
      <ItemPreviewContent item={contentItem} />
    </div>
  )
}
