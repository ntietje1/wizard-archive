import { TagFormDialog } from '../base-tag-form/tag-form-dialog.tsx'
import LocationTagForm from './location-tag-form.tsx'
import type { TagDialogProps } from '../base-tag-form/types.ts'
import type { Location } from 'convex/locations/types'
import type { Id } from 'convex/_generated/dataModel'

export default function LocationTagDialog(
  props: TagDialogProps<Location> & {
    onLocationCreated?: (locationId: Id<'locations'>) => void
  },
) {
  const location = props.mode === 'edit' ? props.tag : null

  return (
    <TagFormDialog
      mode={props.mode}
      isOpen={props.isOpen}
      onClose={props.onClose}
      campaignId={props.campaignId}
      categoryId={props.categoryId}
    >
      <LocationTagForm
        mode={props.mode}
        location={location}
        campaignId={props.campaignId}
        categoryId={props.categoryId}
        parentId={props.parentId}
        isOpen={props.isOpen}
        onClose={props.onClose}
        onLocationCreated={props.onLocationCreated}
      />
    </TagFormDialog>
  )
}
