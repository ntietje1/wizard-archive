import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '~/components/shadcn/ui/dialog'
import { MapViewer } from './map-viewer'
import type { Id } from 'convex/_generated/dataModel'

interface MapViewDialogProps {
  mapId: Id<'maps'>
  isOpen: boolean
  onClose: () => void
}

//TODO: fix this onOpenChange
export function MapViewDialog({ mapId, isOpen, onClose }: MapViewDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="!max-w-[98vw] !max-h-[90vh] sm:!max-w-[90vw] !w-[90vw] !h-[90vh] p-0 flex flex-col overflow-hidden"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Map Viewer</DialogTitle>
        <MapViewer mapId={mapId} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}
