import type { ReactNode } from 'react'
import type { LucideIcon } from '~/features/shared/utils/icons'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/features/shadcn/components/card'
import { Button } from '~/features/shadcn/components/button'
import { Badge } from '~/features/shadcn/components/badge'

interface BaseContentCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  badges?: Array<{
    text: string
    icon?: LucideIcon
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }>
  actionButtons?: Array<{
    icon: LucideIcon
    onClick: (e: React.MouseEvent) => void
    'aria-label'?: string
    disabled?: boolean
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }>
  footer?: ReactNode
  className?: string
  hoverEffect?: {
    enabled?: boolean
    className?: string
  }
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
  icon,
  badges,
  actionButtons,
  footer,
  onClick,
  className = '',
  linkWrapper,
  hoverEffect,
}: ContentCardProps) {
  const Icon = icon
  const cardContent = (
    <Card
      className={`bg-card border border-border w-full h-full ${hoverEffect?.enabled ? hoverEffect.className || '' : ''} ${
        linkWrapper ? '' : className
      }`}
      onClick={!linkWrapper ? onClick : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-20">
            <div className="flex items-center gap-2 mb-1">
              {Icon && <Icon className="w-8 h-8 text-primary select-none" />}
              <CardTitle
                className={`text-lg text-foreground line-clamp-1 select-none`}
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
          {actionButtons.map(
            (button, index) =>
              !button.disabled && (
                <Button
                  key={index}
                  variant={button.variant || 'ghost'}
                  size="sm"
                  onClick={button.onClick}
                  className={`opacity-0 group-hover:opacity-100 transition-opacity`}
                  aria-label={button['aria-label']}
                >
                  <button.icon className="w-4 h-4" />
                </Button>
              ),
          )}
        </div>
      )}
    </div>
  )
}
