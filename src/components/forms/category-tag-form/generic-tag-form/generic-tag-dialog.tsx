import { TagFormDialog } from '../base-tag-form/tag-form-dialog.tsx'
import GenericTagForm from './generic-tag-form.tsx'
import type { TagDialogProps } from '../base-tag-form/types.ts'
import type { Tag } from 'convex/tags/types.ts'

export default function GenericTagDialog(props: TagDialogProps<Tag>) {
  const tag = props.mode === 'edit' ? props.tag : null

  return (
    <TagFormDialog
      mode={props.mode}
      isOpen={props.isOpen}
      onClose={props.onClose}
      campaignId={props.campaignId}
      categoryId={props.categoryId}
    >
      <GenericTagForm
        mode={props.mode}
        tag={tag}
        campaignId={props.campaignId}
        categoryId={props.categoryId}
        parentId={props.parentId}
        isOpen={props.isOpen}
        onClose={props.onClose}
      />
    </TagFormDialog>
  )
}
