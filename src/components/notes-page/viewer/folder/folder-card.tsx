import { useEffect, useRef } from 'react'
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
import { cn } from '~/lib/shadcn/utils'

const H = 140
const R = 4
const TAB_W = 80
const TAB_H = 12
const NOTCH_W = 12

function folderPath(w: number) {
  return [
    `M ${R},0`,
    `L ${TAB_W},0`,
    `L ${TAB_W + NOTCH_W},${TAB_H}`,
    `L ${w - R},${TAB_H}`,
    `A ${R},${R} 0 0,1 ${w},${TAB_H + R}`,
    `L ${w},${H - R}`,
    `A ${R},${R} 0 0,1 ${w - R},${H}`,
    `L ${R},${H}`,
    `A ${R},${R} 0 0,1 0,${H - R}`,
    `L 0,${R}`,
    `A ${R},${R} 0 0,1 ${R},0`,
    'Z',
  ].join(' ')
}

type DropState = 'none' | 'valid' | 'trash'

function FolderSvg({
  containerRef,
  dropState = 'none',
}: {
  containerRef: React.RefObject<HTMLElement | null>
  dropState?: DropState
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const svg = svgRef.current
    const path = pathRef.current
    if (!container || !svg || !path) return
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentBoxSize[0]?.inlineSize ?? 0)
      if (w > 0) {
        svg.setAttribute('viewBox', `0 0 ${w} ${H}`)
        path.setAttribute('d', folderPath(w))
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [containerRef])

  return (
    <svg
      ref={svgRef}
      className={cn(
        'absolute inset-0 w-full h-full overflow-visible transition-[filter] duration-100',
        dropState === 'none' && 'group-hover:drop-shadow-md',
        dropState === 'valid' && 'drop-shadow-ring',
        dropState === 'trash' && 'drop-shadow-destructive',
      )}
    >
      <path
        ref={pathRef}
        className={cn(
          'stroke-foreground/10 stroke-2 [paint-order:stroke]',
          dropState === 'trash' ? 'fill-destructive-muted' : 'fill-card',
        )}
      />
    </svg>
  )
}

function FolderCardSkeleton() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  return (
    <div className="h-[140px]">
      <div ref={wrapperRef} className="relative block w-full h-full">
        <FolderSvg containerRef={wrapperRef} />
        <div className="relative z-[2] pt-4 px-3">
          <Skeleton className="h-5 w-32" />
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

  const dropState: DropState =
    !isDropTarget && !isFileDragTarget
      ? 'none'
      : isDropTarget && isTrashAction
        ? 'trash'
        : 'valid'

  const cardContent = (
    <div ref={ref} className="h-[140px]">
      <Link
        {...linkProps}
        activeOptions={{ includeSearch: false }}
        className="block h-full [&.active]:pointer-events-auto"
        draggable={false}
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
        <div className="relative block w-full h-full cursor-pointer group">
          <FolderSvg containerRef={ref} dropState={dropState} />

          <div className="relative z-[2] pt-3 px-2">
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle className="p-1 text-sm font-medium text-foreground truncate select-none flex-1 min-w-0">
                {folder.name}
              </CardTitle>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="absolute top-[18px] right-2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
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
