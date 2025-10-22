import { type ReactNode } from 'react'
import type { TagCategoryConfig } from './types'
import { FormDialog } from './form-dialog'

interface TagFormDialogProps {
  isOpen: boolean
  onClose: () => void
  config: TagCategoryConfig
  mode: 'create' | 'edit'
  children: ReactNode
}

export function TagFormDialog({
  isOpen,
  onClose,
  config,
  mode,
  children,
}: TagFormDialogProps) {
  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'create' ? `New ${config.singular}` : `Edit ${config.singular}`
      }
      description={
        mode === 'create'
          ? `Add a new ${config.singular.toLowerCase()} to your campaign.`
          : `Update ${config.singular.toLowerCase()} details`
      }
      icon={config.icon}
    >
      {children}
    </FormDialog>
  )
}
