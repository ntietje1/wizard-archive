import { CATEGORY_KIND  } from 'convex/tags/types'
import { FormDialog } from '../category-tag-form/base-tag-form/form-dialog'
import { CategoryForm } from './category-form'
import type {TagCategory} from 'convex/tags/types';
import type { Id } from 'convex/_generated/dataModel'
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
  const isSystemCategory =
    props.mode === 'edit' && props.category.kind === CATEGORY_KIND.SystemCore

  return (
    <FormDialog
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={props.mode === 'create' ? 'New Category' : 'Edit Category'}
      description={
        props.mode === 'create'
          ? 'Create a new category for organizing tags.'
          : isSystemCategory
            ? 'Update the default color for this system category. Name and icon cannot be changed.'
            : 'Update the category name, icon, and default color.'
      }
      icon={props.mode === 'create' ? Plus : Edit}
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
