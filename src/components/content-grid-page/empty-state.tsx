import type {LucideIcon} from '~/lib/icons';
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
        <Icon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-600 mb-2">{title}</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">{description}</p>
        {action && (
          <Button
            onClick={action.onClick}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {action.icon && <action.icon className="w-4 h-4" />}
            {action.label}
          </Button>
        )}
      </div>
    </div>
  )
}
