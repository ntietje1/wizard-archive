import { ChevronRight, Loader2, MoreHorizontal } from 'lucide-react'
import type { SidebarItemButtonProps } from './types'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { sidebarItemRowPaddingStyle } from './sidebar-item-layout'
import {
  sidebarItemActionButtonClass,
  sidebarItemActionGroupClass,
  sidebarItemBackgroundClass,
  sidebarItemIconClass,
  sidebarItemNameClass,
} from '../../item-visual-state'
import type { SidebarItemVisualState } from '../../item-visual-state'
import type { MouseEvent, ReactNode } from 'react'

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
  onToggleExpanded: SidebarItemButtonProps['onToggleExpanded']
}) {
  const defaultIcon = pending ? <PendingIcon /> : <Icon className="size-4 shrink-0" />
  const canToggle = !pending && showChevron && Boolean(onToggleExpanded)

  if (!canToggle) {
    return (
      <div
        className={cn(
          'relative size-6 shrink-0 flex items-center justify-center',
          sidebarItemIconClass(visualState),
        )}
      >
        {defaultIcon}
      </div>
    )
  }

  const hoverIcon = (
    <Button
      variant="ghost"
      size="sm"
      className="size-6 hover:text-foreground hover:bg-item-action-hover rounded-sm"
      aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
      aria-expanded={expanded}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onToggleExpanded?.(e)
      }}
    >
      <div className={cn('flex items-center justify-center', expanded && 'rotate-90')}>
        <ChevronRight className="size-3" />
      </div>
    </Button>
  )

  return (
    <div
      className={cn(
        'relative size-6 shrink-0 flex items-center justify-center',
        sidebarItemIconClass(visualState),
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 group-focus-within:opacity-0">
        {defaultIcon}
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
        {hoverIcon}
      </div>
    </div>
  )
}

function SidebarItemActions({
  visualState,
  shareButton,
  onMoreOptions,
}: {
  visualState: SidebarItemVisualState
  shareButton: SidebarItemButtonProps['shareButton']
  onMoreOptions: SidebarItemButtonProps['onMoreOptions']
}) {
  if (!shareButton && !onMoreOptions) return null

  return (
    <div className={sidebarItemActionGroupClass}>
      {shareButton}
      {onMoreOptions && (
        <div className="relative size-6 shrink-0 flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'size-6 p-0 hover:bg-item-action-hover rounded-sm',
              sidebarItemActionButtonClass(visualState),
            )}
            aria-label="More options"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onMoreOptions(e)
            }}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function SidebarItemNameTarget({
  children,
  onClick,
  pending,
  renaming,
  visualState,
}: {
  children: ReactNode
  onClick: SidebarItemButtonProps['onClick']
  pending: boolean
  renaming: boolean
  visualState: SidebarItemVisualState
}) {
  if (renaming) {
    return <div className="flex items-center min-w-0 flex-1 h-full rounded-sm">{children}</div>
  }

  const ariaCurrent = visualState.isViewing ? 'page' : undefined

  return (
    <button
      type="button"
      className="flex items-center min-w-0 flex-1 h-full rounded-sm text-left"
      disabled={pending}
      aria-current={ariaCurrent}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function SidebarItemButtonBase({
  icon,
  itemId,
  name,
  nameContent,
  presentation,
  onClick,
  onContextMenu,
  onMoreOptions,
  onToggleExpanded,
  shareButton,
  rowRef,
}: SidebarItemButtonProps) {
  const {
    visualState,
    renaming,
    expanded,
    showChevron,
    pending = false,
    indentLevel = 0,
  } = presentation
  const rowPadding = sidebarItemRowPaddingStyle(indentLevel)
  const renderedNameContent = nameContent ?? (
    <span className={cn('truncate ml-1', sidebarItemNameClass(visualState))}>{name}</span>
  )
  const rowContextMenu = renaming
    ? undefined
    : pending
      ? (event: MouseEvent<HTMLDivElement>) => event.preventDefault()
      : onContextMenu

  return (
    <div
      ref={rowRef}
      className={cn(
        'relative flex items-center w-full h-8 rounded-sm',
        'group',
        '[[data-item-dragging]_&]:bg-primary/10',
        pending && 'opacity-70',
        sidebarItemBackgroundClass(visualState),
      )}
      style={rowPadding}
      data-item-selection-target="true"
      data-testid={`selectable-row-${itemId}`}
      data-selected={visualState.isSelected ? 'true' : 'false'}
      aria-busy={pending || undefined}
      onContextMenu={rowContextMenu}
    >
      <SidebarItemIconToggle
        Icon={icon}
        visualState={visualState}
        pending={pending}
        showChevron={showChevron}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
      />

      <SidebarItemNameTarget
        onClick={onClick}
        pending={pending}
        renaming={renaming}
        visualState={visualState}
      >
        {renderedNameContent}
      </SidebarItemNameTarget>

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
