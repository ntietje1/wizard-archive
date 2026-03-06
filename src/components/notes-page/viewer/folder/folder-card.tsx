import { useRef } from 'react'
import { ClientOnly, Link } from '@tanstack/react-router'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import type { ItemCardProps } from './item-card'
import type { Folder } from 'convex/folders/types'
import { canDropFilesOnTarget } from '~/lib/dnd-registry'
import { CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import { MoreVertical } from '~/lib/icons'
import { useEditorLinkProps } from '~/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/hooks/useLastEditorItem'
import { useContextMenu } from '~/hooks/useContextMenu'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { useDraggable } from '~/hooks/useDraggable'
import { useSidebarItemDropTarget } from '~/hooks/useSidebarItemDropTarget'
import { useExternalDropTarget } from '~/hooks/useExternalDropTarget'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

function FolderSvg() {
  return (
    <div className="folder flex h-full relative text-white">
      {/* Left section */}
      <div className="folder-left shrink-0 w-[120px] -mr-px">
        <svg
          viewBox="0 0 120 200"
          preserveAspectRatio="none"
          className="w-full h-full block"
        >
          <path
            d="M 100,15 L 85,0 L 10,0 C 5,0 0,5 0,15 L 0,185 C 0,195 5,200 10,200 L 120,200 L 120,15 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Middle section */}
      <div className="folder-middle grow min-w-[20px] -mr-px">
        <svg
          viewBox="0 0 20 200"
          preserveAspectRatio="none"
          className="w-full h-full block"
        >
          <rect x="0" y="15" width="20" height="200" fill="currentColor" />
        </svg>
      </div>

      {/* Right section*/}
      <div className="folder-right shrink-0 w-[60px]">
        <svg
          viewBox="0 0 60 200"
          preserveAspectRatio="none"
          className="w-full h-full block"
        >
          <path
            d="M 0,15 L 50,15 C 55,15 59,17 60,25 L 60,185 C 60,195 57,200 50,200 L 0,200 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Background (hides seams) */}
      <div className="folder-seam-cover absolute top-[11.5px] left-5 right-5 bottom-[1.5px] bg-white pointer-events-none z-[1]"></div>
    </div>
  )
}

function FolderCardSkeleton() {
  return (
    <div className="h-[140px]">
      <div className="folder-wrapper">
        <FolderSvg />
        <div className="folder-content px-2">
          <div className="flex items-center gap-2 mb-2 min-w-0 py-0">
            <div className="pt-2">
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FolderCardInner({ item: folder, onClick }: ItemCardProps<Folder>) {
  const ref = useRef<HTMLDivElement>(null)
  const linkProps = useEditorLinkProps(folder)
  const { setLastSelectedItem } = useLastEditorItem()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()

  const isDropTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === folder._id,
  )
  const isTrashAction = useSidebarUIStore(
    (s) =>
      s.dragOutcome?.type === 'operation' && s.dragOutcome.action === 'trash',
  )

  const canDrag = hasAtLeastPermissionLevel(
    folder.myPermissionLevel,
    PERMISSION_LEVEL.FULL_ACCESS,
  )

  const { isDraggingRef } = useDraggable({
    ref,
    data: { sidebarItemId: folder._id },
    canDrag,
    dragOpacity: '0.2',
  })

  useSidebarItemDropTarget({ ref, item: folder })

  useExternalDropTarget({
    ref,
    parentId: folder._id,
    canAcceptFiles: canDropFilesOnTarget(folder),
  })

  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)
  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isFileDragTarget = isDraggingFiles && fileDragHoveredId === folder._id

  const cardContent = (
    <div ref={ref} className="h-[140px]">
      <Link
        {...linkProps}
        activeOptions={{ includeSearch: false }}
        className="block h-full [&.active]:pointer-events-auto"
        onClick={(e) => {
          if (isDraggingRef.current) {
            e.preventDefault()
            return
          }
          if (onClick) {
            e.preventDefault()
            onClick()
            return
          }
          setLastSelectedItem({ type: folder.type, slug: folder.slug })
        }}
      >
        <div
          className={`folder-wrapper group transition-all relative ${(() => {
            if (!isDropTarget && !isFileDragTarget) return ''
            if (isDropTarget && isTrashAction) return 'trash-drop-target'
            return 'valid-drop-target'
          })()}`}
        >
          <FolderSvg />

          <div className="folder-content px-2">
            <div className="flex items-center gap-2 mb-2 min-w-0 py-0">
              <CardTitle className="p-1 text-sm font-medium text-slate-800 truncate select-none flex-1 min-w-0">
                {folder.name}
              </CardTitle>
            </div>
          </div>

          {/* Three-dot menu button in top right */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-5 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Open folder menu"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleMoreOptions(e)
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </Link>
    </div>
  )

  return (
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext="folder-view"
      item={folder}
    >
      {cardContent}
    </EditorContextMenu>
  )
}

export function FolderCard(props: ItemCardProps<Folder>) {
  if (props.isLoading) {
    return <FolderCardSkeleton />
  }

  return (
    <ClientOnly fallback={<FolderCardSkeleton />}>
      <FolderCardInner {...props} />
    </ClientOnly>
  )
}
