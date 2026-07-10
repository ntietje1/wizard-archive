import { useEffect, useRef, useState } from 'react'
import { ItemCard } from '../../filesystem/cards/item-card'
import { NewItemCard } from '../../filesystem/new-item-card'
import { DroppableFolderZone } from './droppable-folder-zone'
import type { FolderItemWithContent } from '../../workspace/items'
import { CreateNewDashboardSurface } from '../../filesystem/create-new-dashboard-surface'
import type { CreateItemOption } from '../../filesystem/create-item-options'
import { ContentGrid } from '@wizard-archive/ui/components/content-grid'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'
import { WorkspaceContextMenu } from '../../workspace/context-menu/context-menu'
import { useItemSurfaceRegistration } from '../../workspace/sidebar/use-item-surface-registration'
import type { FolderViewerSource } from '../../filesystem/cards/source'
import { getClientErrorMessage } from '../../../../../shared/errors/client'
import { toast } from 'sonner'

type FolderViewerProps = {
  item: FolderItemWithContent
  source: FolderViewerSource
}

export function FolderViewer({ item: folder, source }: FolderViewerProps) {
  const effectiveStatus = source.getStatus(folder)
  const children = source.getChildren(folder)
  const visibleItemIds = children.map((child) => child.id)
  const { activateSurface, handleSurfacePointerDown, itemSurfaceHotkeyProps } =
    useItemSurfaceRegistration({
      surface: 'folder-view',
      parentId: folder.id,
      visibleItemIds,
    })

  const canCreateInFolder = source.canCreateInFolder(folder)
  const [creatingKey, setCreatingKey] = useState<CreateItemOption['key'] | null>(null)
  const createInFlightRef = useRef(false)
  const mountedRef = useRef(true)
  const isCreateDisabled = creatingKey !== null

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const folderPath = [...folder.ancestors.map((a) => a.name), folder.name].join(' / ')
  const handleCreate = async (option: CreateItemOption) => {
    if (createInFlightRef.current) return

    createInFlightRef.current = true
    setCreatingKey(option.key)
    try {
      const result = await source.createItemInFolder({
        name: option.defaultName,
        parentId: folder.id,
        type: option.type,
      })
      if (result.status === 'completed') {
        await source.openItem(result.id)
      }
    } catch (error) {
      toast.error(getClientErrorMessage(error) ?? 'Failed to create item')
      console.error(error)
    } finally {
      createInFlightRef.current = false
      if (mountedRef.current) {
        setCreatingKey(null)
      }
    }
  }

  if (effectiveStatus === 'pending') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const isEmpty = children.length === 0

  return (
    <WorkspaceContextMenu
      viewContext="folder-view"
      className="flex flex-col h-full w-full min-h-0"
      item={folder}
    >
      <DroppableFolderZone
        folder={folder}
        source={source}
        className="group/sidebar-surface flex flex-col h-full w-full min-h-0"
        onPointerDownCapture={isEmpty ? handleSurfacePointerDown : undefined}
        onFocusCapture={activateSurface}
        {...itemSurfaceHotkeyProps}
      >
        {isEmpty ? (
          canCreateInFolder ? (
            <CreateNewDashboardSurface
              folderPath={folderPath}
              creatingKey={creatingKey}
              disabled={isCreateDisabled}
              onCreate={(option) => void handleCreate(option)}
            />
          ) : (
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <p className="text-muted-foreground">This folder is empty.</p>
            </div>
          )
        ) : (
          <ScrollArea className="flex-1 min-h-0" onPointerDownCapture={handleSurfacePointerDown}>
            <div className="w-full min-w-0">
              <ContentGrid className="p-6 min-h-0">
                {children.map((childItem) => {
                  return (
                    <ItemCard
                      key={childItem.id}
                      item={childItem}
                      parentId={folder.id}
                      source={source}
                      visibleItemIds={visibleItemIds}
                    />
                  )
                })}
                {canCreateInFolder && <NewItemCard parentId={folder.id} source={source} />}
              </ContentGrid>
            </div>
          </ScrollArea>
        )}
      </DroppableFolderZone>
    </WorkspaceContextMenu>
  )
}
