import type { LucideIcon } from 'lucide-react'

interface SearchResultItemProps {
  icon: LucideIcon
  title: React.ReactNode
  subtitle?: string
  badge?: string
  detail?: React.ReactNode
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
}

export function SearchResultItem({
  icon: Icon,
  title,
  subtitle,
  badge,
  detail,
  isSelected,
  onClick,
  onMouseEnter,
}: SearchResultItemProps) {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 cursor-default select-none ${
        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <Icon className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{title}</span>
          {badge && (
            <span className="shrink-0 h-4 px-1.5 text-[10px] font-medium rounded-sm bg-muted text-muted-foreground border border-border inline-flex items-center">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
        {detail && (
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{detail}</div>
        )}
      </div>
    </div>
  )
}
