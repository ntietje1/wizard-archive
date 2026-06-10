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
import type { SidebarItemCreationCommand } from '~/features/sidebar/sidebar-item-creation-catalog'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'
import { useEditorWorkspaceSource } from '~/features/editor/workspace/editor-workspace-source-context'

interface NewItemCardProps {
  parentId: Id<'sidebarItems'>
}

export function NewItemCard({ parentId }: NewItemCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  const {
    items: { createItem },
  } = useEditorWorkspaceSource()

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

  const handleCreate = async (command: SidebarItemCreationCommand) => {
    await createItem({ type: command.type, parentId })
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
            <ContextMenuItem key={command.id} onClick={() => handleCreate(command)}>
              <Icon className="size-4 mr-2" />
              New {command.label}
            </ContextMenuItem>
          )
        })}
      </ContextMenuContent>
    </ContextMenu>
  )
}
