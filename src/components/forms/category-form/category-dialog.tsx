import { FormDialog } from '../category-tag-form/base-tag-form/form-dialog'
import type { Id } from 'convex/_generated/dataModel'
import type { TagCategory } from 'convex/tags/types'
import { CategoryForm } from './category-form'
import { Edit, Plus } from '~/lib/icons'

interface CategoryDialogBaseProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (newSlug: string) => void
}

export type CategoryDialogProps =
  | (CategoryDialogBaseProps & {
      mode: 'create'
      campaignId: Id<'campaigns'>
      category?: never
    })
  | (CategoryDialogBaseProps & {
      mode: 'edit'
      category: TagCategory
      campaignId?: never
    })

export function CategoryDialog(props: CategoryDialogProps) {
  return (
    <FormDialog
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={props.mode === 'create' ? 'New Category' : 'Edit Category'}
      description={
        props.mode === 'create'
          ? 'Create a new category for organizing tags.'
          : 'Update the category name, icon, and default color.'
      }
      icon={props.mode === 'create' ? Plus : Edit}
      maxWidth="max-w-2xl"
    >
      <CategoryForm
        mode={props.mode}
        category={props.category}
        campaignId={props.campaignId}
        onClose={props.onClose}
        onSuccess={props.onSuccess}
      />
    </FormDialog>
  )
}
