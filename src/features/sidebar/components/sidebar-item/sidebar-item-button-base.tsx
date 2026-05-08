import { Link } from '@tanstack/react-router'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { EditableName } from './editable-item-name'
import type { SidebarItemButtonProps } from './types'
import { Button } from '~/features/shadcn/components/button'
import { HoverToggleButton } from '~/features/sidebar/components/hover-toggle-button'
import { cn } from '~/features/shadcn/lib/utils'

export function SidebarItemButtonBase({
  icon: Icon,
  name,
  isExpanded = false,
  isSelected = false,
  isFocused = false,
  isRenaming = false,
  showChevron = true,
  linkProps,
  onClick,
  onContextMenu,
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
        isFocused && 'ring-1 ring-ring',
        !isSelected && 'hover:bg-muted/70',
      )}
      data-item-selection-target="true"
      role="option"
      aria-selected={isSelected}
      onContextMenu={onContextMenu}
    >
      {/* Icon / Chevron Toggle */}
      <HoverToggleButton
        className="relative size-6 shrink-0 flex items-center justify-center text-muted-foreground"
        nonHoverComponent={<Icon className="size-4 shrink-0" />}
        hoverComponent={
          showChevron ? (
            <Button
              variant="ghost"
              size="sm"
              className="size-6 hover:text-foreground hover:bg-muted-foreground/10 rounded-sm"
              aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
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
                <ChevronRight className="size-3" />
              </div>
            </Button>
          ) : (
            <Icon className="size-4 shrink-0" />
          )
        }
      />

      {/* Item Name */}
      {isRenaming || !linkProps ? (
        <div className="flex items-center min-w-0 flex-1 h-full rounded-sm">{nameContent}</div>
      ) : (
        <Link
          {...linkProps}
          activeOptions={{ includeSearch: false }}
          className="flex items-center min-w-0 flex-1 h-full rounded-sm select-none"
          draggable={false}
          tabIndex={isFocused ? 0 : -1}
          onClick={onClick}
        >
          {nameContent}
        </Link>
      )}

      {/* Action Buttons */}
      {!isRenaming && (
        <div className="flex items-center shrink-0 w-0 overflow-hidden opacity-0 group-hover:w-auto group-hover:overflow-visible group-hover:opacity-100 has-[[data-share-open]]:w-auto has-[[data-share-open]]:overflow-visible has-[[data-share-open]]:opacity-100 group-hover:transition-opacity">
          {shareButton}
          <div className="relative size-6 shrink-0 flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm"
              aria-label="More options"
              onClick={(e) => {
                e.preventDefault()
                onMoreOptions(e)
              }}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
