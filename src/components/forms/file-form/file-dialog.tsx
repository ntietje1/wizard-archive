import { File } from 'lucide-react'
import { FormDialog } from '../category-tag-form/base-tag-form/form-dialog'
import { FileForm } from './file-form'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types'

interface FileDialogProps {
  isOpen: boolean
  onClose: () => void
  fileId?: Id<'files'>
  campaignId?: Id<'campaigns'>
  parentId?: SidebarItemId
  onSuccess?: (fileSlug?: string) => void
}

export function FileDialog({
  isOpen,
  onClose,
  fileId,
  campaignId,
  parentId,
  onSuccess,
}: FileDialogProps) {
  if (!isOpen) return null

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={fileId ? 'Edit File' : 'Create File'}
      description={
        fileId
          ? 'Update file settings and upload a new file'
          : 'Upload a new file for your campaign'
      }
      icon={File}
    >
      <FileForm
        fileId={fileId}
        campaignId={campaignId}
        parentId={parentId}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </FormDialog>
  )
}
