import { Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '~/components/shadcn/ui/button'
import { cn } from '~/lib/shadcn/utils'

interface ZoomControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  className?: string
}

export function ZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
  className,
}: ZoomControlsProps) {
  return (
    <div
      className={cn(
        'absolute top-4 right-4 z-[1000] flex flex-col gap-2',
        className,
      )}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={onZoomIn}
        className="bg-card shadow-md"
        title="Zoom In"
      >
        <Plus className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onZoomOut}
        className="bg-card shadow-md"
        title="Zoom Out"
      >
        <Minus className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onReset}
        className="bg-card shadow-md"
        title="Reset View"
      >
        <RotateCcw className="w-4 h-4" />
      </Button>
    </div>
  )
}
