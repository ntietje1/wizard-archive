import type { LucideIcon } from '~/lib/icons'
import { Button } from '~/components/shadcn/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`col-span-full ${className}`}>
      <div className="text-center py-12">
        <Icon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          {description}
        </p>
        {action && (
          <Button onClick={action.onClick}>
            {action.icon && <action.icon className="w-4 h-4" />}
            {action.label}
          </Button>
        )}
      </div>
    </div>
  )
}
