import { memo } from 'react'
import { motion } from 'motion/react'
import { EditableName } from './editable-item-name'
import type { SidebarItemButtonProps } from './types'
import { ChevronRight, MoreHorizontal } from '~/lib/icons'
import { Button } from '~/components/shadcn/ui/button'
import { HoverToggleButton } from '~/components/hover-toggle-button'
import { cn } from '~/lib/shadcn/utils'

function SidebarItemButtonBaseComponent({
  icon: Icon,
  name,
  defaultName,
  isExpanded = false,
  isSelected = false,
  isDragging = false,
  isRenaming = false,
  isDraggingActive = false,
  showChevron = true,
  onSelect = () => {},
  onMoreOptions = () => {},
  onToggleExpanded = () => {},
  onFinishRename,
  onCancelRename,
  campaignId,
  parentId,
  excludeId,
}: SidebarItemButtonProps) {
  return (
    <div
      className={cn(
        'relative flex items-center w-full h-8 px-1 rounded-sm',
        !isDraggingActive && 'group',
        isSelected && 'bg-muted',
        isDragging && 'bg-amber-500/10',
        !isSelected && !isDragging && !isDraggingActive && 'hover:bg-muted/50',
      )}
    >
      {/* Icon / Chevron Toggle */}
      <HoverToggleButton
        className="relative h-6 w-6 shrink-0 flex items-center justify-center text-muted-foreground"
        nonHoverComponent={<Icon className="h-4 w-4 shrink-0" />}
        hoverComponent={
          showChevron && !isDraggingActive ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 hover:text-foreground hover:bg-muted-foreground/10 rounded-sm"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpanded(e)
              }}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: isExpanded ? 0.2 : 0.15, ease: 'easeInOut' }}
                className="flex items-center justify-center"
              >
                <ChevronRight className="h-3 w-3" />
              </motion.div>
            </Button>
          ) : (
            <Icon className="h-4 w-4 shrink-0" />
          )
        }
      />

      {/* Item Name */}
      <button
        type="button"
        className="flex items-center min-w-0 flex-1 h-full rounded-sm"
        onClick={onSelect}
      >
        {onFinishRename ? (
          <EditableName
            initialName={name}
            defaultName={defaultName}
            isRenaming={isRenaming}
            onFinishRename={onFinishRename}
            onCancelRename={onCancelRename}
            campaignId={campaignId}
            parentId={parentId}
            excludeId={excludeId}
          />
        ) : (
          <span className="truncate ml-1">{name || defaultName}</span>
        )}
      </button>

      {/* More Options Button */}
      {!isRenaming && !isDraggingActive && (
        <HoverToggleButton
          className="relative h-6 w-6 shrink-0 flex items-center justify-center"
          hoverComponent={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm"
              onClick={onMoreOptions}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
        />
      )}
    </div>
  )
}

export const SidebarItemButtonBase = memo(SidebarItemButtonBaseComponent)
