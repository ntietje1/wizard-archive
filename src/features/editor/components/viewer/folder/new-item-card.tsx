import { useRef, useState } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { File, FilePlus, FolderPlus, MapPin, Plus } from 'lucide-react'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import { Card } from '~/features/shadcn/components/card'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '~/features/shadcn/components/context-menu'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { handleError } from '~/shared/utils/logger'

interface NewItemCardProps {
  parentId: Id<'sidebarItems'>
}

export function NewItemCard({ parentId }: NewItemCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  const { campaignId } = useCampaign()
  const { createItem } = useCreateSidebarItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()

  const openMenuAt = (clientX: number, clientY: number) => {
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
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    openMenuAt(e.clientX, e.clientY)
  }

  const handleCreate = async (type: SidebarItemType) => {
    if (!campaignId) return
    try {
      const result = await createItem({
        type,
        campaignId,
        parentTarget: { kind: 'direct', parentId },
        name: getDefaultName(type, parentId),
      })
      openParentFolders(result.id)
      void navigateToItem(result.slug)
    } catch (error) {
      handleError(error, 'Failed to create item')
    }
  }

  return (
    <ContextMenu open={isOpen} onOpenChange={setIsOpen}>
      <ContextMenuTrigger
        render={
          <div ref={triggerRef} className="h-[140px]">
            <Card
              className="w-full h-full cursor-pointer rounded-md border-dashed flex items-center justify-center hover:bg-muted/70 hover:border-solid"
              onClick={handleClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  const rect = e.currentTarget.getBoundingClientRect()
                  openMenuAt(rect.left + rect.width / 2, rect.top + rect.height / 2)
                }
              }}
            >
              <Plus className="h-6 w-6 text-muted-foreground" />
            </Card>
          </div>
        }
      />
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => handleCreate(SIDEBAR_ITEM_TYPES.notes)}>
          <FilePlus className="h-4 w-4 mr-2" />
          New Note
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleCreate(SIDEBAR_ITEM_TYPES.folders)}>
          <FolderPlus className="h-4 w-4 mr-2" />
          New Folder
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleCreate(SIDEBAR_ITEM_TYPES.gameMaps)}>
          <MapPin className="h-4 w-4 mr-2" />
          New Map
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleCreate(SIDEBAR_ITEM_TYPES.files)}>
          <File className="h-4 w-4 mr-2" />
          New File
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
