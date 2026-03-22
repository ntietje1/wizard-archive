import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { EditableName } from './editable-item-name'
import type { SidebarItemButtonProps } from './types'
import { ChevronRight, MoreHorizontal } from '~/lib/icons'
import { Button } from '~/components/shadcn/ui/button'
import { HoverToggleButton } from '~/components/hover-toggle-button'
import { cn } from '~/lib/shadcn/utils'

function SidebarItemButtonBaseComponent({
  icon: Icon,
  name,
  isExpanded = false,
  isSelected = false,
  isRenaming = false,
  showChevron = true,
  linkProps,
  onClick,
  onMoreOptions = () => {},
  onToggleExpanded = () => {},
  onFinishRename,
  onCancelRename,
  campaignId,
  parentId,
  excludeId,
  shareButton,
}: SidebarItemButtonProps) {
  const nameContent = onFinishRename ? (
    <EditableName
      initialName={name}
      isRenaming={isRenaming}
      onFinishRename={onFinishRename}
      onCancelRename={onCancelRename}
      campaignId={campaignId}
      parentId={parentId}
      excludeId={excludeId}
    />
  ) : (
    <span className="truncate ml-1">{name}</span>
  )

  return (
    <div
      className={cn(
        'relative flex items-center w-full h-8 px-1 rounded-sm',
        'group',
        '[[data-item-dragging]_&]:bg-primary/10',
        isSelected && 'bg-muted',
        !isSelected && 'hover:bg-muted/70',
      )}
    >
      {/* Icon / Chevron Toggle */}
      <HoverToggleButton
        className="relative h-6 w-6 shrink-0 flex items-center justify-center text-muted-foreground"
        nonHoverComponent={<Icon className="h-4 w-4 shrink-0" />}
        hoverComponent={
          showChevron ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 hover:text-foreground hover:bg-muted-foreground/10 rounded-sm"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onToggleExpanded(e)
              }}
            >
              <div
                className={cn(
                  'flex items-center justify-center transition-transform duration-100 ease-out',
                  isExpanded && 'rotate-90',
                )}
              >
                <ChevronRight className="h-3 w-3" />
              </div>
            </Button>
          ) : (
            <Icon className="h-4 w-4 shrink-0" />
          )
        }
      />

      {/* Item Name */}
      {isRenaming || !linkProps ? (
        <div className="flex items-center min-w-0 flex-1 h-full rounded-sm">
          {nameContent}
        </div>
      ) : (
        <Link
          {...linkProps}
          activeOptions={{ includeSearch: false }}
          className="flex items-center min-w-0 flex-1 h-full rounded-sm select-none"
          draggable={false}
          onClick={onClick}
        >
          {nameContent}
        </Link>
      )}

      {/* Action Buttons */}
      {!isRenaming && (
        <div className="flex items-center shrink-0 w-0 overflow-hidden opacity-0 group-hover:w-auto group-hover:overflow-visible group-hover:opacity-100 has-[[data-share-open]]:w-auto has-[[data-share-open]]:overflow-visible has-[[data-share-open]]:opacity-100 group-hover:transition-opacity">
          {shareButton}
          <div className="relative h-6 w-6 shrink-0 flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm"
              onClick={(e) => {
                e.preventDefault()
                onMoreOptions(e)
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export const SidebarItemButtonBase = memo(SidebarItemButtonBaseComponent)
