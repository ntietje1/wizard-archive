import { useState } from 'react'
import { ChevronDown, ChevronUp, Lock, Users } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/features/shadcn/components/popover'
import { SidebarItemsSharePanel } from '~/features/sharing/components/sidebar-items-share-panel'
import type { EditorWorkspaceSharingState } from '../../workspace/editor-workspace-source'

export function ShareButton({ share }: { share: EditorWorkspaceSharingState }) {
  const [open, setOpen] = useState(false)

  if (!share.visible) {
    return null
  }

  const Chevron = open ? ChevronUp : ChevronDown
  const StatusIcon = share.shared ? Users : Lock
  const label = share.shared ? 'Shared' : 'Private'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton
        disabled={share.disabled}
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <StatusIcon className="size-3.5" />
            <span className="text-xs">{label}</span>
            <Chevron className="size-3 text-muted-foreground" />
          </Button>
        }
      />
      {share.items.length > 0 && (
        <PopoverContent align="start" side="bottom" sideOffset={4} className="w-auto p-2">
          <SidebarItemsSharePanel items={share.items} />
        </PopoverContent>
      )}
    </Popover>
  )
}
