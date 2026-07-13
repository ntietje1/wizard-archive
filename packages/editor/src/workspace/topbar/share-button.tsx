import { useState } from 'react'
import { ChevronDown, ChevronUp, Lock, Users } from 'lucide-react'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@wizard-archive/ui/shadcn/components/popover'
import { SidebarItemsSharePanel } from '../../sharing/sidebar-items/panel'
import type { ResourceShareSource, ResourceShareState } from '../../sharing/contracts'
import type { AnyItem } from '../items'

export function ShareButton({
  isLoading,
  item,
  share,
}: {
  isLoading: boolean
  item: AnyItem | null | undefined
  share: ResourceShareSource
}) {
  if (share.status !== 'available') {
    return null
  }

  const shareItems = item && item.isTrashed !== true ? [item] : []
  return share.renderItemsShareState(shareItems, (state) => (
    <ShareButtonState isLoading={isLoading} shareItems={shareItems} shareState={state} />
  ))
}

function ShareButtonState({
  isLoading,
  shareItems,
  shareState,
}: {
  isLoading: boolean
  shareItems: Array<AnyItem>
  shareState: ResourceShareState
}) {
  const hasItems = shareItems.length > 0
  const canOpen = hasItems && !isLoading && shareState.status === 'ready' && !shareState.isMutating
  const isShared = shareState.status === 'ready' && shareState.aggregateShareStatus !== 'not_shared'
  const StatusIcon = isShared ? Users : Lock
  const label = getShareButtonLabel(shareState, isShared)

  if (canOpen) {
    return (
      <OpenableShareButton
        label={label}
        shareItems={shareItems}
        shareState={shareState}
        StatusIcon={StatusIcon}
      />
    )
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" disabled>
      <StatusIcon className="size-3.5" />
      <span className="text-xs">{label}</span>
      <ChevronDown className="size-3 text-muted-foreground" />
    </Button>
  )
}

function OpenableShareButton({
  label,
  shareItems,
  shareState,
  StatusIcon,
}: {
  label: string
  shareItems: Array<AnyItem>
  shareState: Extract<ResourceShareState, { status: 'ready' }>
  StatusIcon: typeof Users
}) {
  const [open, setOpen] = useState(false)
  const Chevron = open ? ChevronUp : ChevronDown

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <StatusIcon className="size-3.5" />
            <span className="text-xs">{label}</span>
            <Chevron className="size-3 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="start" side="bottom" sideOffset={4} className="w-auto p-2">
        <SidebarItemsSharePanel items={shareItems} state={shareState} />
      </PopoverContent>
    </Popover>
  )
}

function getShareButtonLabel(shareState: ResourceShareState | null, isShared: boolean) {
  if (isShared) return 'Shared'
  if (
    shareState?.status === 'failed' ||
    shareState?.status === 'incomplete' ||
    shareState?.status === 'unavailable'
  ) {
    return 'Unavailable'
  }
  return 'Private'
}
