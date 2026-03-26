import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { toast } from 'sonner'
import { Loader } from 'lucide-react'
import { validateFileForUpload } from 'convex/storage/validation'
import type { Id } from 'convex/_generated/dataModel'
import { IconPicker } from '~/features/sidebar/components/forms/icon-picker'
import { ColorPicker } from '~/features/sidebar/components/forms/color-picker'
import { useNameValidation } from '~/shared/hooks/useNameValidation'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useEditSidebarItem } from '~/features/sidebar/hooks/useEditSidebarItem'
import { Label } from '~/features/shadcn/components/label'
import { Button } from '~/features/shadcn/components/button'
import { getIconByName } from '~/shared/utils/category-icons'
import { useFileWithPreview } from '~/features/file-upload/hooks/useFileWithPreview'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { GenericFileUploadSection } from '~/features/file-upload/components/generic-file-upload-section'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '~/features/shadcn/components/input-group'

export interface FileFormValues {
  name: string
  iconName: string | null
  color: string | null
}

interface FileFormProps {
  fileId?: Id<'files'>
  campaignId?: Id<'campaigns'>
  parentId?: Id<'folders'> | null
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
  const { editItem } = useEditSidebarItem()
  const { createItem } = useCreateSidebarItem()
  const file = useAuthQuery(
    api.files.queries.getFile,
    fileId ? { fileId } : 'skip',
  )

  const fileUpload = useFileWithPreview({
    isOpen: true,
    fileStorageId: file.data?.storageId ?? undefined,
    uploadOnSelect: true,
    fileTypeValidator: validateFileForUpload,
  })

  // Accept drag-and-drop anywhere on screen
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      const droppedFile = e.dataTransfer?.files[0]
      if (droppedFile) {
        fileUpload.handleFileSelect(droppedFile)
      }
    }
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [fileUpload])

  // Get initial values based on current props
  const defaultValues: FileFormValues = (() => {
    if (fileId && file.data) {
      return {
        name: file.data.name || '',
        iconName: file.data.iconName ?? null,
        color: file.data.color ?? null,
      }
    }
    return defaultFileFormValues
  })()

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
    },
  })

  const { checkNameUnique } = useNameValidation({
    name: form.state.values.name,
    initialName: file.data?.name ?? '',
    isActive: !!fileId && !!file.data,
    campaignId,
    parentId: file.data?.parentId ?? null,
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

      if (fileId && file.data) {
        try {
          const { slug } = await editItem({
            item: file.data,
            name: finalName,
            storageId: finalStorageId,
            iconName: values.iconName,
            color: values.color,
          })

          toast.success('File updated')
          onSuccess?.(slug)
        } catch (error) {
          console.error(error)
          return
        }
      } else if (campaignId) {
        const { id: newFileId, slug: newFileSlug } = await createItem({
          type: SIDEBAR_ITEM_TYPES.files,
          campaignId,
          name: finalName,
          storageId: finalStorageId,
          parentId: parentId ?? null,
        })
        await openParentFolders(newFileId)
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
    }
  }

  const isLoadingFile =
    fileId !== undefined && file.data === undefined && file.isPending

  const hasFile = !!(
    fileUpload.file ||
    (file.data?.storageId && !fileUpload.removed)
  )

  const isDisabled =
    form.state.isSubmitting || fileUpload.isUploading || isLoadingFile

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
          onChangeAsync: ({ value }) => checkNameUnique(value),
          onChangeAsyncDebounceMs: 300,
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>File Name (optional)</Label>
            <InputGroup>
              <InputGroupInput
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Enter file name"
                disabled={isDisabled}
                autoFocus
                aria-invalid={field.state.meta.errors.length > 0}
              />
              {field.state.meta.isValidating && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton className="rounded-full" size="icon-xs">
                    <Loader className="size-4 animate-spin" />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            {field.state.meta.errors[0] && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <div className="flex items-end gap-4">
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

      <form.Subscribe selector={(s) => s.canSubmit}>
        {(canSubmit) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isDisabled}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!hasFile || isDisabled || (fileId && !canSubmit)}
            >
              {form.state.isSubmitting
                ? fileId
                  ? 'Updating...'
                  : 'Creating...'
                : fileId
                  ? 'Update'
                  : 'Create'}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}
