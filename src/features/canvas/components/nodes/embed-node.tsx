import { useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { AlertTriangle, ExternalLinkIcon } from 'lucide-react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { useRichEmbedActivation } from '../../hooks/useRichEmbedLifecycle'
import { useSelectedCanvasNodeIds } from '../../hooks/useCanvasSelectionState'
import type { RichEmbedLifecycleController } from '../../hooks/useRichEmbedLifecycle'
import { isExclusivelySelectedNode } from '../../utils/canvas-selection-utils'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import type { EmbedNodeData } from './embed-node-data'
import { EmbedNoteContent } from './embed-note-content'
import { ItemPreviewContent } from '~/features/editor/components/item-preview-content'
import type { Node, NodeProps } from '@xyflow/react'
import type { AnySidebarItemWithContent } from 'convex/sidebarItems/types/types'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'
import { useCanvasRuntimeContext } from '../../hooks/canvas-runtime-context'
export function EmbedNode({ id, data, selected, dragging }: NodeProps<Node<EmbedNodeData>>) {
  const sidebarItemId = data.sidebarItemId
  const { itemsMap } = useActiveSidebarItems()
  const item = sidebarItemId ? itemsMap.get(sidebarItemId) : undefined

  const { data: contentItem } = useSidebarItemById(sidebarItemId)

  const { editSession, canEdit } = useCanvasRuntimeContext()
  const { editingEmbedId, setEditingEmbedId } = editSession
  const selectedNodeIds = useSelectedCanvasNodeIds()
  const isExclusivelySelected = isExclusivelySelectedNode(selectedNodeIds, id)
  const isEditing = editingEmbedId === id && isExclusivelySelected

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

  const { navigateToItem } = useEditorNavigation()

  const Icon = getSidebarItemIcon(item)
  const label = item?.name ?? 'Missing item'
  const isMissing = !item

  return (
    <ResizableNodeWrapper
      id={id}
      selected={!!selected}
      dragging={!!dragging}
      minWidth={240}
      minHeight={180}
    >
      <div
        className="h-full w-full rounded-lg border bg-card shadow-sm flex flex-col overflow-hidden"
        onDoubleClick={handleDoubleClick}
      >
        <Handle type="target" position={Position.Top} className="!bg-primary" />

        <div className="flex items-center gap-2 min-w-0 px-3 py-2">
          {isMissing ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate select-none">{label}</p>
          </div>
          {item && (
            <div
              className={cn(
                'shrink-0 overflow-hidden',
                selected ? 'w-auto opacity-100' : 'w-0 opacity-0',
              )}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  void navigateToItem(item.slug)
                }}
                aria-label="Open item"
                tabIndex={selected ? 0 : -1}
              >
                <ExternalLinkIcon className="size-3.5" />
              </Button>
            </div>
          )}
        </div>

        {!isMissing && (
          <div className="flex-1 min-h-0 border-t">
            <EmbedRichContent
              contentItem={contentItem}
              isEditing={isEditing}
              isExclusivelySelected={isExclusivelySelected}
              lifecycle={lifecycle}
            />
          </div>
        )}

        <Handle type="source" position={Position.Bottom} className="!bg-primary" />
      </div>
    </ResizableNodeWrapper>
  )
}

function EmbedRichContent({
  contentItem,
  isEditing,
  isExclusivelySelected,
  lifecycle,
}: {
  contentItem: AnySidebarItemWithContent | undefined
  isEditing: boolean
  isExclusivelySelected: boolean
  lifecycle: RichEmbedLifecycleController
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
