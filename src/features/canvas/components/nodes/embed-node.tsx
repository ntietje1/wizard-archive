import { useContext, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { AlertTriangle, ExternalLinkIcon } from 'lucide-react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { CanvasContext } from '../../utils/canvas-context'
import { useEmbedNoteActivation } from '../../hooks/useEmbedNoteActivation'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import { EmbedNoteContent } from './embed-note-content'
import { ItemPreviewContent } from '~/features/editor/components/item-preview-content'
import type { NodeProps } from '@xyflow/react'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItemWithContent } from 'convex/sidebarItems/types/types'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'

export function EmbedNode({ id, data, selected, dragging }: NodeProps) {
  const sidebarItemId = data.sidebarItemId as Id<'sidebarItems'> | undefined
  const { itemsMap } = useActiveSidebarItems()
  const item = sidebarItemId ? itemsMap.get(sidebarItemId) : undefined

  const { data: contentItem } = useSidebarItemById(sidebarItemId)

  const { editingEmbedId, setEditingEmbedId, canEdit } = useContext(CanvasContext)
  const isEditing = editingEmbedId === id && !!selected

  const scrollTopRef = useRef(0)
  const { clickCoordsRef, handleDoubleClick } = useEmbedNoteActivation({
    canEdit,
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
              selected={!!selected}
              scrollTopRef={scrollTopRef}
              clickCoordsRef={clickCoordsRef}
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

  if (contentItem.type === SIDEBAR_ITEM_TYPES.notes) {
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
  }

  const hasScrollableContent = contentItem.type === SIDEBAR_ITEM_TYPES.folders

  return (
    <div className={cn('h-full overflow-hidden', hasScrollableContent && selected && 'nowheel')}>
      <ItemPreviewContent item={contentItem} />
    </div>
  )
}
