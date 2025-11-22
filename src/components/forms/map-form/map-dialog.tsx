import { FormDialog } from '../category-tag-form/base-tag-form/form-dialog'
import { MapPin } from '~/lib/icons'
import { MapForm } from './map-form'
import type { Id } from 'convex/_generated/dataModel'

interface MapDialogProps {
  isOpen: boolean
  onClose: () => void
  mapId?: Id<'gameMaps'>
  campaignId?: Id<'campaigns'>
  categoryId?: Id<'tagCategories'>
  parentFolderId?: Id<'folders'>
  onSuccess?: () => void
}

export function MapDialog({
  isOpen,
  onClose,
  mapId,
  campaignId,
  categoryId,
  parentFolderId,
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
        categoryId={categoryId}
        parentFolderId={parentFolderId}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </FormDialog>
  )
}

