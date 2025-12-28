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
      className={`border-2 border-dashed border-amber-300 hover:border-amber-400 transition-all duration-200 cursor-pointer group bg-gradient-to-br from-amber-50 to-orange-50 hover:shadow-lg ${minHeight} ${className}`}
    >
      <CardContent className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="p-4 bg-amber-100 rounded-full mb-4 group-hover:bg-amber-200 transition-colors">
          <Icon className="h-8 w-8 text-amber-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-600 text-sm">{description}</p>
      </CardContent>
    </Card>
  )
}
