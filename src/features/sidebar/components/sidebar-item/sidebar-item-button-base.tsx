import { Link } from '@tanstack/react-router'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { EditableName } from './editable-item-name'
import type { SidebarItemButtonProps } from './types'
import { Button } from '~/features/shadcn/components/button'
import { HoverToggleButton } from '~/features/sidebar/components/hover-toggle-button'
import { cn } from '~/features/shadcn/lib/utils'
import { sidebarItemRowPaddingStyle } from '~/features/sidebar/components/sidebar-item/sidebar-item-layout'
import {
  sidebarItemActionButtonClass,
  sidebarItemActionGroupClass,
  sidebarItemBackgroundClass,
  sidebarItemIconClass,
  sidebarItemNameClass,
} from '~/features/sidebar/utils/sidebar-item-visual-state'

export function SidebarItemButtonBase({
  icon: Icon,
  name,
  presentation,
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
  const { visualState, focused, renaming, expanded, showChevron, indentLevel = 0 } = presentation
  const actionButtonClassName = sidebarItemActionButtonClass(visualState)
  const rowPadding = sidebarItemRowPaddingStyle(indentLevel)
  const nameContent = onFinishRename ? (
    <EditableName
      initialName={name}
      isRenaming={renaming}
      onFinishRename={onFinishRename}
      onCancelRename={onCancelRename}
      displayClassName={sidebarItemIconClass(visualState)}
      campaignId={campaignId}
      parentId={parentId}
      excludeId={excludeId}
    />
  ) : (
    <span className={cn('truncate ml-1', sidebarItemNameClass(visualState))}>{name}</span>
  )

  return (
    <div
      className={cn(
        'relative flex items-center w-full h-8 px-1 rounded-sm',
        'group',
        '[[data-item-dragging]_&]:bg-primary/10',
        sidebarItemBackgroundClass(visualState),
      )}
      style={rowPadding}
      data-item-selection-target="true"
      data-testid={`selectable-row-${name}`}
      role="option"
      aria-selected={visualState.isSelected}
      onContextMenu={onContextMenu}
    >
      {/* Icon / Chevron Toggle */}
      <HoverToggleButton
        className={cn(
          'relative size-6 shrink-0 flex items-center justify-center',
          sidebarItemIconClass(visualState),
        )}
        nonHoverComponent={<Icon className="size-4 shrink-0" />}
        hoverComponent={
          showChevron ? (
            <Button
              variant="ghost"
              size="sm"
              className="size-6 hover:text-foreground hover:bg-muted-foreground/10 rounded-sm"
              aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onToggleExpanded(e)
              }}
            >
              <div
                data-testid="chevron-wrapper"
                className={cn('flex items-center justify-center', expanded && 'rotate-90')}
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
      {renaming || !linkProps ? (
        <div className="flex items-center min-w-0 flex-1 h-full rounded-sm">{nameContent}</div>
      ) : (
        <Link
          {...linkProps}
          activeOptions={{ includeSearch: false }}
          className="flex items-center min-w-0 flex-1 h-full rounded-sm select-none"
          draggable={false}
          tabIndex={focused ? 0 : -1}
          onClick={onClick}
        >
          {nameContent}
        </Link>
      )}

      {/* Action Buttons */}
      {!renaming && (
        <div className={sidebarItemActionGroupClass}>
          {shareButton}
          <div className="relative size-6 shrink-0 flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'size-6 p-0 hover:bg-muted-foreground/10 rounded-sm',
                actionButtonClassName,
              )}
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
