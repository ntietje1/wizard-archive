import { FormDialog } from '../category-tag-form/base-tag-form/form-dialog'
import { MapForm } from './map-form'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import { MapPin } from '~/lib/icons'

interface MapDialogProps {
  isOpen: boolean
  onClose: () => void
  mapId?: Id<'gameMaps'>
  campaignId?: Id<'campaigns'>
  categoryId?: Id<'tagCategories'>
  parentId?: SidebarItemId
  onSuccess?: (mapSlug?: string) => void
}

export function MapDialog({
  isOpen,
  onClose,
  mapId,
  campaignId,
  categoryId: _categoryId,
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
