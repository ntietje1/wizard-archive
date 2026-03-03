import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '~/components/shadcn/ui/button'
import { ZoomControls } from '~/components/viewer-controls/zoom-controls'

interface PdfToolbarProps {
  currentPage: number
  numPages: number
  onPrevPage: () => void
  onNextPage: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

export function PdfToolbar({
  currentPage,
  numPages,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: PdfToolbarProps) {
  return (
    <div className="flex items-center justify-between bg-background border-b px-3 py-1.5 shrink-0">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevPage}
          disabled={currentPage <= 1}
          title="Previous page"
          className="h-7 w-7"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-muted-foreground select-none min-w-[100px] text-center">
          Page {currentPage} of {numPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNextPage}
          disabled={currentPage >= numPages}
          title="Next page"
          className="h-7 w-7"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <ZoomControls
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onReset={onZoomReset}
        className="static flex-row gap-1 z-auto"
      />
    </div>
  )
}
