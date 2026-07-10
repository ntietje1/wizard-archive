import { MapPin } from 'lucide-react'
import { MapForm } from './form'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { FormDialog } from '@wizard-archive/ui/components/form-dialog'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'
import type { MapFormEditState, MapFormSource } from './source'

interface MapDialogProps {
  mapState: MapFormEditState
  isOpen: boolean
  onClose: () => void
  mapId: SidebarItemId
  onSuccess?: (mapSlug?: string) => void
  source: MapFormSource
  upload: FileUploadControl
}

export function MapDialog({
  isOpen,
  mapState,
  onClose,
  mapId,
  onSuccess,
  source,
  upload,
}: MapDialogProps) {
  if (!isOpen) return null
  const formKey =
    mapId && mapState.item
      ? `${mapId}:${mapState.item.name}:${mapState.item.iconName ?? ''}:${
          mapState.item.color ?? ''
        }`
      : `${mapId ?? 'new'}:loading`

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Map"
      description="Update map settings and image"
      icon={MapPin}
    >
      <MapForm
        key={formKey}
        mapState={mapState}
        mapId={mapId}
        onClose={onClose}
        onSuccess={onSuccess}
        source={source}
        upload={upload}
      />
    </FormDialog>
  )
}
