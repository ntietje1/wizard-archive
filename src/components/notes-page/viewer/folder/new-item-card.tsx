import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import type { SidebarItemType } from 'convex/sidebarItems/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import { File, FilePlus, FolderPlus, MapPin, Plus } from '~/lib/icons'
import { Card } from '~/components/shadcn/ui/card'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '~/components/shadcn/ui/context-menu'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

interface NewItemCardProps {
  parentId: Id<'folders'>
}

export function NewItemCard({ parentId }: NewItemCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { createItem } = useSidebarItemMutations()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()

  const openMenuAt = useCallback((clientX: number, clientY: number) => {
    if (triggerRef.current) {
      triggerRef.current.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          button: 2,
        }),
      )
      setIsOpen(true)
    }
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      openMenuAt(e.clientX, e.clientY)
    },
    [openMenuAt],
  )

  const handleCreate = useCallback(
    async (type: SidebarItemType) => {
      if (!campaignId) return
      try {
        const result = await createItem({
          type,
          campaignId,
          parentId,
        })
        openParentFolders(result.id)
        navigateToItem(result)
      } catch (error) {
        console.error(error)
        toast.error(`Failed to create item`)
      }
    },
    [campaignId, parentId, createItem, openParentFolders, navigateToItem],
  )

  return (
    <ContextMenu open={isOpen} onOpenChange={setIsOpen}>
      <ContextMenuTrigger
        render={
          <div ref={triggerRef} className="h-[140px]">
            <Card
              className="w-full h-full cursor-pointer rounded-md border-dashed flex items-center justify-center hover:bg-accent/50 hover:border-solid transition-all"
              onClick={handleClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  const rect = e.currentTarget.getBoundingClientRect()
                  openMenuAt(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                  )
                }
              }}
            >
              <Plus className="h-6 w-6 text-muted-foreground" />
            </Card>
          </div>
        }
      />
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onSelect={() => handleCreate(SIDEBAR_ITEM_TYPES.notes)}
        >
          <FilePlus className="h-4 w-4 mr-2" />
          New Note
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => handleCreate(SIDEBAR_ITEM_TYPES.folders)}
        >
          <FolderPlus className="h-4 w-4 mr-2" />
          New Folder
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => handleCreate(SIDEBAR_ITEM_TYPES.gameMaps)}
        >
          <MapPin className="h-4 w-4 mr-2" />
          New Map
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => handleCreate(SIDEBAR_ITEM_TYPES.files)}
        >
          <File className="h-4 w-4 mr-2" />
          New File
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
