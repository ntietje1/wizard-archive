import type { ResourceId } from '../resources/domain-id'
import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Plus } from 'lucide-react'

import { Card } from '@wizard-archive/ui/shadcn/components/card'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@wizard-archive/ui/shadcn/components/context-menu'
import type { ContextMenuRef } from '@wizard-archive/ui/shadcn/components/context-menu'
import type { SidebarItemCreationCommand } from '../workspace/sidebar/creation-catalog'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '../workspace/sidebar/creation-catalog'
import type { FolderViewerSource } from './cards/source'
import { getClientErrorMessage } from '../../../../shared/errors/client'
import { toast } from 'sonner'

type NewItemCardSource = Pick<FolderViewerSource, 'createItemInFolder'>

interface NewItemCardProps {
  parentId: ResourceId
  source: NewItemCardSource
}

export function NewItemCard({ parentId, source }: NewItemCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const menuRef = useRef<ContextMenuRef>(null)

  const openMenuAt = (clientX: number, clientY: number) => {
    if (isCreating) return
    menuRef.current?.openAt({ x: clientX, y: clientY })
    setIsOpen(true)
  }

  const openCreateMenu = (e: MouseEvent) => {
    e.preventDefault()
    openMenuAt(e.clientX, e.clientY)
  }

  const handleCreate = async (option: SidebarItemCreationCommand) => {
    if (isCreating) return
    setIsCreating(true)
    try {
      await source.createItemInFolder({ name: option.defaultName, type: option.type, parentId })
    } catch (error) {
      toast.error(getClientErrorMessage(error) ?? 'Failed to create item')
      console.error(error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <ContextMenu ref={menuRef} open={isOpen} onOpenChange={setIsOpen}>
      <ContextMenuTrigger
        render={
          <Card
            className="w-full h-[140px] cursor-pointer rounded-md border-dashed flex items-center justify-center hover:bg-muted/70 hover:border-solid"
            onClick={openCreateMenu}
            role="button"
            tabIndex={0}
            aria-label="Create item in this folder"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-disabled={isCreating}
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
        }
      />
      <ContextMenuContent className="w-48">
        {SIDEBAR_ITEM_CREATION_COMMANDS.map((option) => {
          const Icon = option.icon
          return (
            <ContextMenuItem
              key={option.key}
              disabled={isCreating}
              onClick={() => void handleCreate(option)}
            >
              <Icon className="size-4 mr-2" />
              New {option.label}
            </ContextMenuItem>
          )
        })}
      </ContextMenuContent>
    </ContextMenu>
  )
}
