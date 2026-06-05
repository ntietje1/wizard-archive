import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Id } from 'convex/_generated/dataModel'
import { Card } from '~/features/shadcn/components/card'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '~/features/shadcn/components/context-menu'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { handleError } from '~/shared/utils/logger'
import type { SidebarItemCreationType } from '~/features/sidebar/sidebar-item-creation-catalog'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'

interface NewItemCardProps {
  parentId: Id<'sidebarItems'>
}

export function NewItemCard({ parentId }: NewItemCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  const { campaignId } = useCampaign()
  const { createItem } = useCreateFileSystemItem()
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

  const openCreateMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    openMenuAt(e.clientX, e.clientY)
  }

  const handleCreate = async (type: SidebarItemCreationType) => {
    if (!campaignId) return
    try {
      const result = await createItem({
        type,
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
              onClick={openCreateMenu}
              role="button"
              tabIndex={0}
              aria-label="Create item in this folder"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  const rect = e.currentTarget.getBoundingClientRect()
                  openMenuAt(rect.left + rect.width / 2, rect.top + rect.height / 2)
                }
              }}
            >
              <Plus className="size-6 text-muted-foreground" />
            </Card>
          </div>
        }
      />
      <ContextMenuContent className="w-48">
        {SIDEBAR_ITEM_CREATION_COMMANDS.map((command) => {
          const Icon = command.icon
          return (
            <ContextMenuItem key={command.id} onClick={() => handleCreate(command.type)}>
              <Icon className="size-4 mr-2" />
              New {command.label}
            </ContextMenuItem>
          )
        })}
      </ContextMenuContent>
    </ContextMenu>
  )
}
