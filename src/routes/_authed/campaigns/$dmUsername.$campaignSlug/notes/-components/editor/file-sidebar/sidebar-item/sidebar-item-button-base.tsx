import { ChevronDown, ChevronRight, MoreHorizontal } from '~/lib/icons'
import { Button } from '~/components/shadcn/ui/button'
import { EditableName } from './editable-item-name'
import type { SidebarItemButtonProps } from './types'
import { HoverToggleButton } from '~/components/hover-toggle-button'
import { cn } from '~/lib/utils'

export function SidebarItemButtonBase({
  icon: Icon,
  name,
  defaultName,
  isExpanded = false,
  isSelected = false,
  isRenaming = false,
  showChevron = false,
  onSelect = () => {},
  onMoreOptions = () => {},
  onToggleExpanded = () => {},
  onFinishRename,
}: SidebarItemButtonProps) {
  return (
    <div
      className={cn(
        'group relative flex items-center w-full h-8 px-1 rounded-sm hover:bg-muted/50 transition-colors',
        isSelected && 'bg-muted',
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
                onToggleExpanded(e)
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          ) : (
            <Icon className="h-4 w-4 shrink-0" />
          )
        }
      />

      {/* Item Name */}
      <button
        type="button"
        className="flex items-center min-w-0 flex-1 rounded-sm"
        onClick={onSelect}
      >
        {onFinishRename ? (
          <EditableName
            initialName={name}
            defaultName={defaultName}
            isRenaming={isRenaming}
            onFinishRename={onFinishRename}
          />
        ) : (
          <span className="truncate ml-1">{name || defaultName}</span>
        )}
      </button>

      {/* More Options Button */}
      {!isRenaming && (
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
