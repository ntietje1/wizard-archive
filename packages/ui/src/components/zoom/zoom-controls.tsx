import { Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

interface ZoomControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  className?: string
}

export function ZoomControls({ onZoomIn, onZoomOut, onReset, className }: ZoomControlsProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onZoomIn}
        aria-label="Zoom in"
        className="bg-card shadow-md"
        title="Zoom In"
      >
        <Plus className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onZoomOut}
        aria-label="Zoom out"
        className="bg-card shadow-md"
        title="Zoom Out"
      >
        <Minus className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onReset}
        aria-label="Reset view"
        className="bg-card shadow-md"
        title="Reset View"
      >
        <RotateCcw className="w-4 h-4" />
      </Button>
    </div>
  )
}
