import type { LucideIcon } from '~/lib/icons'
import { Card, CardContent } from '~/components/shadcn/ui/card'
import { Plus } from '~/lib/icons'

interface CreateActionCardProps {
  onClick: () => void
  title: string
  description: string
  icon?: LucideIcon
  className?: string
  minHeight?: string
}

export function CreateActionCard({
  onClick,
  title,
  description,
  icon: Icon = Plus,
  className = '',
  minHeight = 'h-full min-h-[180px]',
}: CreateActionCardProps) {
  return (
    <Card
      onClick={onClick}
      className={`border-2 border-dashed border-primary/40 hover:border-primary/60 transition-colors duration-100 ease-out cursor-pointer group bg-accent ${minHeight} ${className}`}
    >
      <CardContent className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="p-4 bg-accent rounded-xl mb-4">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
    </Card>
  )
}
