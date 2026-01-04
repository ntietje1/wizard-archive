import { useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Button } from '~/components/shadcn/ui/button'
import { useFileWithPreview } from '~/hooks/useFileWithPreview'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { GenericFileUploadSection } from '~/components/file-upload/generic-file-upload-section'

export interface FileFormValues {
  name: string
}

interface FileFormProps {
  fileId?: Id<'files'>
  campaignId?: Id<'campaigns'>
  parentId?: SidebarItemId
  onClose: () => void
  onSuccess?: (fileSlug?: string) => void
}

const defaultFileFormValues: FileFormValues = {
  name: '',
}

export function FileForm({
  fileId,
  campaignId,
  parentId,
  onClose,
  onSuccess,
}: FileFormProps) {
  const { openParentFolders } = useOpenParentFolders()
  const { navigateToFile } = useEditorNavigation()
  const file = useQuery(
    convexQuery(api.files.queries.getFile, fileId ? { fileId } : 'skip'),
  )

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.files.mutations.createFile),
  })

  const updateMutation = useMutation({
    mutationFn: useConvexMutation(api.files.mutations.updateFile),
  })

  const fileUpload = useFileWithPreview({
    isOpen: true,
    fileStorageId: file.data?.storageId,
    existingFileName: file.data?.name,
    uploadOnSelect: true,
    fileTypeValidator: (fileToValidate: File) => {
      // Accept any viewable media file
      const mimeType = fileToValidate.type.toLowerCase()
      const fileName = fileToValidate.name.toLowerCase()

      // Check if it's a viewable media type
      const isViewable =
        mimeType.startsWith('image/') ||
        mimeType.startsWith('video/') ||
        mimeType.startsWith('audio/') ||
        mimeType === 'application/pdf' ||
        /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|pdf|mp4|webm|ogg|mov|avi|wmv|flv|mp3|wav|aac|flac|m4a)$/i.test(
          fileName,
        )

      if (!isViewable) {
        return {
          success: false,
          error:
            'Please upload a valid file type (image, video, audio, or PDF)',
        }
      }

      // Check file size (10MB max)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (fileToValidate.size > maxSize) {
        return {
          success: false,
          error: 'File must be less than 10MB',
        }
      }

      return { success: true }
    },
  })

  // Get initial values based on current props
  const defaultValues = useMemo((): FileFormValues => {
    if (fileId && file.data) {
      return {
        name: file.data.name || '',
      }
    }
    return defaultFileFormValues
  }, [fileId, file.data])

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
    },
  })

  async function handleSubmit(values: FileFormValues) {
    try {
      let finalStorageId: Id<'_storage'> | undefined = undefined

      if (fileUpload.file) {
        // New file was selected, commit the upload
        try {
          finalStorageId = await fileUpload.handleSubmit()
        } catch (error) {
          console.error('Failed to commit file upload:', error)
          toast.error('Failed to save file')
          return
        }
      } else if (file.data?.storageId && !fileUpload.removed) {
        // Keep existing file if it hasn't been removed
        finalStorageId = file.data.storageId
      }

      // Validate that file is required
      if (!finalStorageId) {
        toast.error('File is required')
        return
      }

      if (fileId) {
        // Update existing file
        await updateMutation.mutateAsync({
          fileId,
          name: values.name,
          storageId: finalStorageId,
        })
        toast.success('File updated')
        onSuccess?.(file.data?.slug)
        onClose()
      } else if (campaignId) {
        // Create new file - require file
        const { fileId: newFileId, slug: newFileSlug } =
          await createMutation.mutateAsync({
            campaignId,
            name: values.name,
            storageId: finalStorageId,
            parentId,
          })
        await openParentFolders(newFileId)
        // Get the created file's slug for onSuccess callback
        navigateToFile(newFileSlug)
        toast.success('File created')
        onSuccess?.(newFileSlug)
        onClose()
      } else {
        toast.error('Invalid form state: missing file or campaign ID')
        return
      }
    } catch (error) {
      console.error(error)
      toast.error(fileId ? 'Failed to update file' : 'Failed to create file')
    }
  }

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    fileUpload.isUploading

  // Disable form while file data is loading in edit mode
  const isLoadingFile =
    fileId !== undefined && file.data === undefined && file.isPending

  const isDisabled = isSubmitting || isLoadingFile

  const hasFile = !!(
    fileUpload.file ||
    (file.data?.storageId && !fileUpload.removed)
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-4"
    >
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) =>
            !value || value.trim().length === 0
              ? undefined // Name is optional
              : undefined,
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>File Name (optional)</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Enter file name"
              disabled={isDisabled}
              autoFocus
            />
            {field.state.meta.errors[0] && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <div className="space-y-2">
        <Label>File</Label>
        <GenericFileUploadSection
          label=""
          fileUpload={fileUpload}
          handleFileSelect={fileUpload.handleFileSelect}
          isSubmitting={isDisabled}
        />
        {fileUpload.uploadError ? (
          <p className="text-sm text-destructive">{fileUpload.uploadError}</p>
        ) : !hasFile ? (
          <p className="text-sm text-destructive">File is required</p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isDisabled}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!hasFile || isDisabled}>
          {fileId ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
