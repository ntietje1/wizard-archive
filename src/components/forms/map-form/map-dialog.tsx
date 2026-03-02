import { FormDialog } from '../base-form/form-dialog'
import { MapForm } from './map-form'
import type { Id } from 'convex/_generated/dataModel'
import { MapPin } from '~/lib/icons'

interface MapDialogProps {
  isOpen: boolean
  onClose: () => void
  mapId?: Id<'gameMaps'>
  campaignId?: Id<'campaigns'>
  parentId?: Id<'folders'> | null
  onSuccess?: (mapSlug?: string) => void
}

export function MapDialog({
  isOpen,
  onClose,
  mapId,
  campaignId,
  parentId,
  onSuccess,
}: MapDialogProps) {
  if (!isOpen) return null

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={mapId ? 'Edit Map' : 'Create Map'}
      description={
        mapId
          ? 'Update map settings and image'
          : 'Create a new map for your campaign'
      }
      icon={MapPin}
    >
      <MapForm
        mapId={mapId}
        campaignId={campaignId}
        parentId={parentId}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </FormDialog>
  )
}
