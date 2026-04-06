import { useContext, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { useEmbedItemContent } from '../../hooks/useEmbedItemContent'
import { CanvasContext } from '../../utils/canvas-context'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import { EmbedNoteContent } from './embed-content/embed-note-content'
import { EmbedFolderContent } from './embed-content/embed-folder-content'
import { EmbedMapContent } from './embed-content/embed-map-content'
import { EmbedFileContent } from './embed-content/embed-file-content'
import { EmbedCanvasContent } from './embed-content/embed-canvas-content'
import type { NodeProps } from '@xyflow/react'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItemWithContent } from 'convex/sidebarItems/types/types'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { assertNever } from '~/shared/utils/utils'

export function EmbedNode({ id, data, selected, dragging }: NodeProps) {
  const sidebarItemId = data.sidebarItemId as SidebarItemId | undefined
  const { itemsMap } = useActiveSidebarItems()
  const item = sidebarItemId ? itemsMap.get(sidebarItemId) : undefined

  const { data: contentItem } = useEmbedItemContent(sidebarItemId, true)

  const { editingEmbedId, setEditingEmbedId, canEdit } =
    useContext(CanvasContext)
  const isEditing = editingEmbedId === id && !!selected

  const scrollTopRef = useRef(0)
  const clickCoordsRef = useRef<{ x: number; y: number } | null>(null)

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (canEdit) {
      clickCoordsRef.current = { x: e.clientX, y: e.clientY }
      setEditingEmbedId(id)
    }
  }

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
        </div>

        {!isMissing && (
          <div className="flex-1 min-h-0 border-t">
            <EmbedRichContent
              contentItem={contentItem}
              isEditing={isEditing}
              selected={!!selected}
              scrollTopRef={scrollTopRef}
              clickCoordsRef={clickCoordsRef}
            />
          </div>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-primary"
        />
      </div>
    </ResizableNodeWrapper>
  )
}

function EmbedRichContent({
  contentItem,
  isEditing,
  selected,
  scrollTopRef,
  clickCoordsRef,
}: {
  contentItem: AnySidebarItemWithContent | undefined
  isEditing: boolean
  selected: boolean
  scrollTopRef: React.RefObject<number>
  clickCoordsRef: React.RefObject<{ x: number; y: number } | null>
}): React.ReactElement | null {
  if (!contentItem) {
    return (
      <div className="h-full flex items-center justify-center opacity-50">
        <div className="h-3 w-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
      </div>
    )
  }

  switch (contentItem.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return (
        <EmbedNoteContent
          noteId={contentItem._id}
          content={contentItem.content}
          editable={isEditing}
          selected={selected}
          scrollTopRef={scrollTopRef}
          clickCoordsRef={clickCoordsRef}
        />
      )
    case SIDEBAR_ITEM_TYPES.folders:
      return <EmbedFolderContent folderId={contentItem._id} />
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return <EmbedMapContent imageUrl={contentItem.imageUrl} />
    case SIDEBAR_ITEM_TYPES.files:
      return (
        <EmbedFileContent
          downloadUrl={contentItem.downloadUrl}
          contentType={contentItem.contentType}
        />
      )
    case SIDEBAR_ITEM_TYPES.canvases:
      return <EmbedCanvasContent canvasId={contentItem._id} />
    default:
      assertNever(contentItem)
      return null
  }
}
