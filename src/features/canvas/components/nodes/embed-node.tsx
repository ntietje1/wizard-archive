import { Handle, Position } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { useIsEmbedRichView } from '../../hooks/useEmbedZoomLevel'
import { useEmbedItemContent } from '../../hooks/useEmbedItemContent'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import { EmbedNoteContent } from './embed-content/embed-note-content'
import { EmbedFolderContent } from './embed-content/embed-folder-content'
import { EmbedMapContent } from './embed-content/embed-map-content'
import { EmbedFileContent } from './embed-content/embed-file-content'
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

  const isRichView = useIsEmbedRichView()
  const contentItem = useEmbedItemContent(sidebarItemId, isRichView)

  const Icon = getSidebarItemIcon(item)
  const label = item?.name ?? 'Missing item'
  const typeLabel = item?.type ?? 'unknown'
  const isMissing = !item
  const previewUrl = item?.previewUrl

  return (
    <ResizableNodeWrapper
      id={id}
      selected={!!selected}
      dragging={!!dragging}
      minWidth={isRichView ? 240 : 200}
      minHeight={isRichView ? 180 : 260}
    >
      <div className="h-full w-full rounded-lg border bg-card shadow-sm flex flex-col overflow-hidden">
        <Handle type="target" position={Position.Top} className="!bg-primary" />

        <div className="flex items-center gap-2 min-w-0 px-3 py-2">
          {isMissing ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate select-none">{label}</p>
            {!isRichView && !previewUrl && (
              <p className="text-xs text-muted-foreground uppercase tracking-widest select-none">
                {typeLabel}
              </p>
            )}
          </div>
        </div>

        {isRichView && !isMissing && (
          <div className="flex-1 min-h-0 border-t">
            <EmbedRichContent contentItem={contentItem} />
          </div>
        )}

        {!isRichView && !isMissing && previewUrl && (
          <div className="flex-1 min-h-0 border-t">
            <img
              src={previewUrl}
              alt={label}
              className="w-full h-full object-cover object-top"
            />
          </div>
        )}

        {!isRichView && !isMissing && !previewUrl && (
          <div className="flex-1 min-h-0 border-t flex items-center justify-center">
            <Icon className="h-8 w-8 text-muted-foreground/50" />
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
}: {
  contentItem: AnySidebarItemWithContent | undefined
}) {
  if (!contentItem) {
    return (
      <div className="h-full flex items-center justify-center opacity-50">
        <div className="h-3 w-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
      </div>
    )
  }

  switch (contentItem.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return <EmbedNoteContent noteId={contentItem._id} />
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
      return null
    default:
      assertNever(contentItem)
  }
}
