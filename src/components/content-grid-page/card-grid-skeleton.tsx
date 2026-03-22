import { ContentGrid } from './content-grid'
import { Card, CardContent, CardHeader } from '~/components/shadcn/ui/card'

interface CardGridSkeletonProps {
  count?: number
  showCreateCard?: boolean
  cardHeight?: string
  className?: string
}

export function CardGridSkeleton({
  count = 6,
  showCreateCard = true,
  cardHeight = 'h-[180px]',
  className = '',
}: CardGridSkeletonProps) {
  const skeletonCount = showCreateCard ? count - 1 : count

  return (
    <ContentGrid className={className}>
      {showCreateCard && (
        <Card className={`${cardHeight} border-2 border-dashed`}>
          <CardContent className="flex flex-col items-center justify-center h-full p-6">
            <div className="bg-muted w-16 h-16 rounded-full mb-4" />
            <div className="bg-muted rounded-md h-5 w-32 mb-2" />
            <div className="bg-muted rounded-md h-4 w-48" />
          </CardContent>
        </Card>
      )}

      {Array.from({ length: skeletonCount }).map((_, i) => (
        <Card key={i} className={cardHeight}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-muted w-3 h-3 rounded-full" />
                  <div className="bg-muted rounded-md h-5 w-32" />
                </div>
                <div className="bg-muted rounded-md h-4 w-16" />
              </div>
              <div className="bg-muted rounded-md w-8 h-8" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-muted rounded-md h-4 w-full mb-2" />
            <div className="bg-muted rounded-md h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </ContentGrid>
  )
}
