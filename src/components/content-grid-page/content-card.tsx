import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/shadcn/ui/card'
import { Button } from '~/components/shadcn/ui/button'
import { Badge } from '~/components/shadcn/ui/badge'
import { type ReactNode } from 'react'
import type { LucideIcon } from '~/lib/icons'

interface BaseContentCardProps {
  title: string
  description?: string
  color?: string
  icon?: LucideIcon
  badges?: {
    text: string
    icon?: LucideIcon
    variant?:
      | 'default'
      | 'secondary'
      | 'destructive'
      | 'outline'
      | 'destructive-subtle'
  }[]
  actionButtons?: {
    icon: LucideIcon
    onClick: (e: React.MouseEvent) => void
    'aria-label'?: string
    variant?:
      | 'default'
      | 'secondary'
      | 'destructive'
      | 'outline'
      | 'destructive-subtle'
  }[]
  footer?: ReactNode
  className?: string
}

type ContentCardProps = BaseContentCardProps &
  (
    | {
        linkWrapper: (children: ReactNode) => ReactNode
        onClick?: never
      }
    | {
        linkWrapper?: never
        onClick: (e: React.MouseEvent) => void
      }
  )

export function ContentCard({
  title,
  description,
  color,
  icon,
  badges,
  actionButtons,
  footer,
  onClick,
  className = '',
  linkWrapper,
}: ContentCardProps) {
  const Icon = icon
  const cardContent = (
    <Card
      className={`hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-white to-slate-50 border border-slate-200 hover:border-amber-300 w-full h-full ${linkWrapper ? '' : className}`}
      onClick={!linkWrapper ? onClick : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-20">
            <div className="flex items-center gap-2 mb-1">
              {Icon && <Icon className="w-8 h-8 text-amber-600" />}
              <CardTitle
                className={`text-lg text-slate-800 group-hover:text-amber-700 transition-colors line-clamp-1`}
              >
                {title}
              </CardTitle>
            </div>
            {badges &&
              badges.map((badge, index) => (
                <Badge
                  key={index}
                  variant={badge.variant || 'secondary'}
                  className="w-fit text-xs"
                >
                  {badge.icon && <badge.icon className="w-3 h-3 mr-1" />}
                  {badge.text}
                </Badge>
              ))}
          </div>
        </div>
      </CardHeader>

      {(description || footer) && (
        <CardContent className="pt-0">
          {description && (
            <CardDescription className="line-clamp-3 mb-3">
              {description}
            </CardDescription>
          )}
          {footer}
        </CardContent>
      )}
    </Card>
  )

  const wrappedCard = linkWrapper ? linkWrapper(cardContent) : cardContent

  return (
    <div className={`relative group ${linkWrapper ? className : ''}`}>
      {wrappedCard}
      {actionButtons && (
        <div className="absolute top-4 right-4 flex gap-1 z-10">
          {actionButtons.map((button, index) => (
            <Button
              key={index}
              variant={button.variant || 'ghost'}
              size="sm"
              onClick={button.onClick}
              className={`opacity-0 group-hover:opacity-100 transition-opacity`}
              aria-label={button['aria-label']}
            >
              {button.icon && <button.icon className="w-4 h-4" />}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
