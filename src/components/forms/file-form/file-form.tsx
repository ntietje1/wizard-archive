import { useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { IconPicker } from '../sidebar-item-form/icon-picker'
import { ColorPicker } from '../sidebar-item-form/color-picker'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import { useNameValidation } from '~/hooks/useNameValidation'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Button } from '~/components/shadcn/ui/button'
import { getIconByName } from '~/lib/category-icons'
import { useFileWithPreview } from '~/hooks/useFileWithPreview'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { GenericFileUploadSection } from '~/components/file-upload/generic-file-upload-section'
import { validateFileForUpload } from '~/lib/file-validation'

export interface FileFormValues {
  name: string
  iconName: string | null
  color: string | null
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
  iconName: null,
  color: null,
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
    uploadOnSelect: true,
    fileTypeValidator: validateFileForUpload,
  })

  // Get initial values based on current props
  const defaultValues = useMemo((): FileFormValues => {
    if (fileId && file.data) {
      return {
        name: file.data.name || '',
        iconName: file.data.iconName ?? null,
        color: file.data.color ?? null,
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

  const { isNotUnique } = useNameValidation({
    name: form.state.values.name,
    initialName: file.data?.name ?? '',
    isActive: !!fileId && !!file.data,
    campaignId,
    parentId: file.data?.parentId,
    excludeId: fileId,
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

      // Use file's actual name if name field is empty
      const finalName =
        values.name.trim() ||
        fileUpload.file?.name ||
        fileUpload.fileMetadata?.name ||
        file.data?.name ||
        ''

      if (fileId) {
        // Prevent submission if name is invalid
        if (isNotUnique) {
          return
        }
        // Update existing file
        try {
          await updateMutation.mutateAsync({
            fileId,
            name: finalName,
            storageId: finalStorageId,
            iconName: values.iconName,
            color: values.color,
          })
          toast.success('File updated')
          onSuccess?.(file.data?.slug)
        } catch (error) {
          console.error(error)
          toast.error('Failed to update file')
          return
        }
      } else if (campaignId) {
        // Create new file - require file
        const { fileId: newFileId, slug: newFileSlug } =
          await createMutation.mutateAsync({
            campaignId,
            name: finalName,
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
          onChange: () => {
            if (isNotUnique) {
              return 'A name with this value already exists here'
            }
            return undefined
          },
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>File Name (optional)</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
              }}
              onBlur={field.handleBlur}
              placeholder="Enter file name"
              disabled={isDisabled}
              autoFocus
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors[0] && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Icon and Color Row */}
      <div className="flex items-end gap-4">
        {/* Icon Field */}
        <form.Field name="iconName">
          {(field) => (
            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker
                value={field.state.value ?? undefined}
                onChange={(iconName) => field.handleChange(iconName)}
                defaultIcon="File"
              />
            </div>
          )}
        </form.Field>

        {/* Color Field */}
        <form.Field name="color">
          {(field) => (
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker
                value={field.state.value}
                onChange={(color) => field.handleChange(color)}
              />
            </div>
          )}
        </form.Field>

        {/* Preview */}
        <div className="flex-1">
          <Label className="text-muted-foreground text-xs">Preview</Label>
          <form.Subscribe selector={(s) => s.values}>
            {(values) => {
              const PreviewIcon = getIconByName(values.iconName ?? 'File')
              return (
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                  <PreviewIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate text-sm">
                    {values.name || 'Untitled File'}
                  </span>
                </div>
              )
            }}
          </form.Subscribe>
        </div>
      </div>

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
