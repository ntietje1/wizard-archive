import type { TagDialogProps } from '../base-tag-form/types.ts'
import { TagFormDialog } from '../base-tag-form/tag-form-dialog.tsx'
import LocationTagForm from './location-tag-form.tsx'
import type { Location } from 'convex/locations/types'

export default function LocationTagDialog(props: TagDialogProps<Location>) {
  const location = props.mode === 'edit' ? props.tag : undefined

  return (
    <TagFormDialog
      mode={props.mode}
      isOpen={props.isOpen}
      onClose={props.onClose}
      config={props.config}
    >
      <LocationTagForm
        mode={props.mode}
        location={location}
        config={props.config}
        navigateToNote={props.navigateToNote}
        parentFolderId={props.parentFolderId}
        isOpen={props.isOpen}
        onClose={props.onClose}
      />
    </TagFormDialog>
  )
}
