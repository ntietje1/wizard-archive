import { TagFormDialog } from '../base-tag-form/tag-form-dialog.tsx'
import GenericTagForm from './generic-tag-form.tsx'
import type { TagDialogProps } from '../base-tag-form/types.ts'
import type { Tag } from 'convex/tags/types.ts'

export default function GenericTagDialog(props: TagDialogProps<Tag>) {
  const tag = props.mode === 'edit' ? props.tag : undefined

  return (
    <TagFormDialog
      mode={props.mode}
      isOpen={props.isOpen}
      onClose={props.onClose}
      config={props.config}
    >
      <GenericTagForm
        mode={props.mode}
        tag={tag}
        config={props.config}
        parentId={props.parentId}
        isOpen={props.isOpen}
        onClose={props.onClose}
      />
    </TagFormDialog>
  )
}
