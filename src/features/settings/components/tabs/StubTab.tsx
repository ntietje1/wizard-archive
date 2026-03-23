import type { LucideIcon } from '~/features/shared/utils/icons'
import { Separator } from '~/features/shadcn/components/separator'

export function StubTab({
  category,
  title,
  description,
  icon: Icon,
}: {
  category: string
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
          {category}
        </p>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Separator />

      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex items-center justify-center rounded-lg bg-muted p-4 mb-4">
          <Icon className="size-8 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-muted-foreground/60 uppercase tracking-wider">
          Coming soon
        </span>
      </div>
    </div>
  )
}
