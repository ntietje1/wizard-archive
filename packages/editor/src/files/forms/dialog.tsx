import { File } from 'lucide-react'
import { FileForm } from './form'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { FormDialog } from '@wizard-archive/ui/components/form-dialog'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'
import type { FileFormEditState, FileFormSource } from './source'

interface FileDialogProps {
  fileState: FileFormEditState
  isOpen: boolean
  onClose: () => void
  fileId?: SidebarItemId
  parentId?: SidebarItemId | null
  onSuccess?: (fileSlug?: string) => void
  source: FileFormSource
  upload: FileUploadControl
}

export function FileDialog({
  fileState,
  isOpen,
  onClose,
  fileId,
  parentId,
  onSuccess,
  source,
  upload,
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
          : 'Upload a new file for your workspace'
      }
      icon={File}
    >
      <FileForm
        fileState={fileState}
        fileId={fileId}
        parentId={parentId}
        onClose={onClose}
        onSuccess={onSuccess}
        source={source}
        upload={upload}
      />
    </FormDialog>
  )
}
