import { api } from 'convex/_generated/api'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { FormDialog } from './form-dialog'
import type { ReactNode } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { getCategoryIcon } from '~/lib/category-icons'

interface TagFormDialogProps {
  isOpen: boolean
  onClose: () => void
  campaignId: Id<'campaigns'>
  categoryId: Id<'tagCategories'>
  mode: 'create' | 'edit'
  children: ReactNode
}

export function TagFormDialog({
  isOpen,
  onClose,
  campaignId,
  categoryId,
  mode,
  children,
}: TagFormDialogProps) {
  const categoryQuery = useQuery(
    convexQuery(api.tags.queries.getTagCategory, { campaignId, categoryId }),
  )

  const category = categoryQuery.data

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'create'
          ? `New ${category?.name || 'Tag'}`
          : `Edit ${category?.name || 'Tag'}`
      }
      description={
        mode === 'create'
          ? `Add a new ${category?.name || 'Tag'} to your campaign.`
          : `Update ${category?.name || 'Tag'} details.`
      }
      icon={getCategoryIcon(category?.iconName)}
    >
      {children}
    </FormDialog>
  )
}
