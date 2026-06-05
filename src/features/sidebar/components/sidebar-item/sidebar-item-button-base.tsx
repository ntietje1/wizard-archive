import { Link } from '@tanstack/react-router'
import { ChevronRight, Loader2, MoreHorizontal } from 'lucide-react'
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
import type { SidebarItemVisualState } from '~/features/sidebar/utils/sidebar-item-visual-state'

function PendingIcon() {
  return <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
}

function SidebarItemIconToggle({
  Icon,
  visualState,
  pending,
  showChevron,
  expanded,
  onToggleExpanded,
}: {
  Icon: SidebarItemButtonProps['icon']
  visualState: SidebarItemVisualState
  pending: boolean
  showChevron: boolean
  expanded: boolean
  onToggleExpanded: NonNullable<SidebarItemButtonProps['onToggleExpanded']>
}) {
  const defaultIcon = pending ? <PendingIcon /> : <Icon className="size-4 shrink-0" />
  const hoverIcon =
    pending || !showChevron ? (
      defaultIcon
    ) : (
      <Button
        variant="ghost"
        size="sm"
        className="size-6 hover:text-foreground hover:bg-item-action-hover rounded-sm"
        aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onToggleExpanded(e)
        }}
      >
        <div className={cn('flex items-center justify-center', expanded && 'rotate-90')}>
          <ChevronRight className="size-3" />
        </div>
      </Button>
    )

  return (
    <HoverToggleButton
      className={cn(
        'relative size-6 shrink-0 flex items-center justify-center',
        sidebarItemIconClass(visualState),
      )}
      nonHoverComponent={defaultIcon}
      hoverComponent={hoverIcon}
    />
  )
}

function SidebarItemActions({
  visualState,
  shareButton,
  onMoreOptions,
}: {
  visualState: SidebarItemVisualState
  shareButton: SidebarItemButtonProps['shareButton']
  onMoreOptions: NonNullable<SidebarItemButtonProps['onMoreOptions']>
}) {
  return (
    <div className={sidebarItemActionGroupClass}>
      {shareButton}
      <div className="relative size-6 shrink-0 flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'size-6 p-0 hover:bg-item-action-hover rounded-sm',
            sidebarItemActionButtonClass(visualState),
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
  )
}

function SidebarItemName({
  name,
  visualState,
  renaming,
  onFinishRename,
  onCancelRename,
  campaignId,
  parentId,
  excludeId,
}: Pick<
  SidebarItemButtonProps,
  'name' | 'onFinishRename' | 'onCancelRename' | 'campaignId' | 'parentId' | 'excludeId'
> & {
  visualState: SidebarItemVisualState
  renaming: boolean
}) {
  if (!onFinishRename) {
    return <span className={cn('truncate ml-1', sidebarItemNameClass(visualState))}>{name}</span>
  }

  return (
    <EditableName
      initialName={name}
      isRenaming={renaming}
      onFinishRename={onFinishRename}
      onCancelRename={onCancelRename}
      displayClassName={sidebarItemNameClass(visualState)}
      campaignId={campaignId}
      parentId={parentId}
      excludeId={excludeId}
    />
  )
}

export function SidebarItemButtonBase({
  icon,
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
  rowRef,
}: SidebarItemButtonProps) {
  const {
    visualState,
    focused,
    renaming,
    expanded,
    showChevron,
    pending = false,
    indentLevel = 0,
  } = presentation
  const rowPadding = sidebarItemRowPaddingStyle(indentLevel)
  const nameContent = (
    <SidebarItemName
      name={name}
      visualState={visualState}
      renaming={renaming}
      onFinishRename={onFinishRename}
      onCancelRename={onCancelRename}
      campaignId={campaignId}
      parentId={parentId}
      excludeId={excludeId}
    />
  )

  return (
    <div
      ref={rowRef}
      className={cn(
        'relative flex items-center w-full h-8 px-1 rounded-sm',
        'group',
        '[[data-item-dragging]_&]:bg-primary/10',
        pending && 'opacity-70',
        sidebarItemBackgroundClass(visualState),
      )}
      style={rowPadding}
      data-item-selection-target="true"
      data-testid={`selectable-row-${name}`}
      role="option"
      tabIndex={pending ? -1 : undefined}
      aria-selected={visualState.isSelected}
      aria-busy={pending || undefined}
      onContextMenu={pending ? (event) => event.preventDefault() : onContextMenu}
    >
      <SidebarItemIconToggle
        Icon={icon}
        visualState={visualState}
        pending={pending}
        showChevron={showChevron}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
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
      {!renaming && !pending && (
        <SidebarItemActions
          visualState={visualState}
          shareButton={shareButton}
          onMoreOptions={onMoreOptions}
        />
      )}
    </div>
  )
}
