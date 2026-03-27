import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { toast } from 'sonner'
import { Loader } from 'lucide-react'
import type { Id } from 'convex/_generated/dataModel'
import { handleError } from '~/shared/utils/logger'
import { IconPicker } from '~/features/sidebar/components/forms/icon-picker'
import { ColorPicker } from '~/features/sidebar/components/forms/color-picker'
import { useNameValidation } from '~/shared/hooks/useNameValidation'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useEditSidebarItem } from '~/features/sidebar/hooks/useEditSidebarItem'
import { getIconByName } from '~/shared/utils/category-icons'
import { Label } from '~/features/shadcn/components/label'
import { Button } from '~/features/shadcn/components/button'
import { useFileWithPreview } from '~/features/file-upload/hooks/useFileWithPreview'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { ImageUploadSection } from '~/features/file-upload/components/image-upload-section'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '~/features/shadcn/components/input-group'

export interface MapFormValues {
  name: string
  iconName: string | null
  color: string | null
}

interface MapFormProps {
  mapId?: Id<'gameMaps'>
  campaignId?: Id<'campaigns'>
  parentId?: Id<'folders'> | null
  onClose: () => void
  onSuccess?: (mapSlug?: string) => void
}

const defaultMapFormValues: MapFormValues = {
  name: '',
  iconName: null,
  color: null,
}

export function MapForm({
  mapId,
  campaignId,
  parentId,
  onClose,
  onSuccess,
}: MapFormProps) {
  const { openParentFolders } = useOpenParentFolders()
  const { navigateToItem } = useEditorNavigation()
  const { editItem } = useEditSidebarItem()
  const { createItem } = useCreateSidebarItem()
  const map = useAuthQuery(
    api.gameMaps.queries.getMap,
    mapId ? { mapId } : 'skip',
  )

  const imageUpload = useFileWithPreview({
    isOpen: true,
    fileStorageId: map.data?.imageStorageId ?? undefined,
    uploadOnSelect: true,
    fileTypeValidator: (file: File) => {
      if (!file.type.startsWith('image/')) {
        return { valid: false, error: 'Only image files are allowed' }
      }
      return { valid: true }
    },
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
        imageUpload.handleFileSelect(droppedFile)
      }
    }
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [imageUpload])

  // Get initial values based on current props
  const defaultValues: MapFormValues = (() => {
    if (mapId && map.data) {
      return {
        name: map.data.name || '',
        iconName: map.data.iconName ?? null,
        color: map.data.color ?? null,
      }
    }
    return defaultMapFormValues
  })()

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
    },
  })

  const { checkNameUnique } = useNameValidation({
    name: form.state.values.name,
    initialName: map.data?.name ?? '',
    isActive: !!mapId,
    campaignId,
    parentId: map.data?.parentId ?? null,
    excludeId: mapId,
  })

  async function handleSubmit(values: MapFormValues) {
    try {
      let finalImageStorageId: Id<'_storage'> | undefined = undefined

      if (imageUpload.file) {
        // New file was selected, commit the upload
        try {
          finalImageStorageId = await imageUpload.handleSubmit()
        } catch (error) {
          handleError(error, 'Failed to save image')
          return
        }
      } else if (map.data?.imageStorageId && !imageUpload.removed) {
        // Keep existing image if it hasn't been removed
        finalImageStorageId = map.data.imageStorageId
      }

      // Validate that image is required
      if (!finalImageStorageId) {
        toast.error('Map image is required')
        return
      }

      if (mapId && map.data) {
        try {
          const { slug } = await editItem({
            item: map.data,
            name: values.name,
            imageStorageId: finalImageStorageId,
            iconName: values.iconName,
            color: values.color,
          })

          toast.success('Map updated')
          onSuccess?.(slug)
        } catch (error) {
          handleError(error, 'Failed to save map')
          return
        }
      } else if (campaignId) {
        const { id: newMapId, slug: newMapSlug } = await createItem({
          type: SIDEBAR_ITEM_TYPES.gameMaps,
          campaignId,
          name: values.name,
          imageStorageId: finalImageStorageId,
          parentId: parentId ?? null,
        })
        await openParentFolders(newMapId)
        navigateToItem(newMapSlug)
        toast.success('Map created')
        onSuccess?.(newMapSlug)
        onClose()
      } else {
        toast.error('Invalid form state: missing map or campaign ID')
        return
      }
    } catch (error) {
      handleError(error, 'Failed to save map')
    }
  }

  const hasImage = !!(
    imageUpload.file ||
    (map.data?.imageStorageId && !imageUpload.removed)
  )

  const isLoadingMap =
    mapId !== undefined && map.data === undefined && map.isPending

  const isDisabled =
    form.state.isSubmitting || imageUpload.isUploading || isLoadingMap

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
          onChange: ({ value }) => {
            if (!value || value.trim().length === 0) {
              return 'Map name is required'
            }
            return undefined
          },
          onChangeAsync: ({ value }) => checkNameUnique(value),
          onChangeAsyncDebounceMs: 300,
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Map Name</Label>
            <InputGroup>
              <InputGroupInput
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Enter map name"
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
                defaultIcon="MapPin"
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
              const PreviewIcon = getIconByName(values.iconName ?? 'MapPin')
              return (
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                  <PreviewIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate text-sm">
                    {values.name || 'Untitled Map'}
                  </span>
                </div>
              )
            }}
          </form.Subscribe>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Map Image</Label>
        <ImageUploadSection
          label=""
          fileUpload={imageUpload}
          handleFileSelect={imageUpload.handleFileSelect}
          isSubmitting={isDisabled}
        />
        {!hasImage && (
          <p className="text-sm text-destructive">Map image is required</p>
        )}
      </div>

      <form.Subscribe
        selector={(s) => ({
          name: s.values.name,
          canSubmit: s.canSubmit,
        })}
      >
        {({ name, canSubmit }) => {
          const isSubmitDisabled =
            !name || !hasImage || isDisabled || (mapId && !canSubmit)
          return (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isDisabled}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitDisabled}>
                {form.state.isSubmitting
                  ? mapId
                    ? 'Updating...'
                    : 'Creating...'
                  : mapId
                    ? 'Update'
                    : 'Create'}
              </Button>
            </div>
          )
        }}
      </form.Subscribe>
    </form>
  )
}
