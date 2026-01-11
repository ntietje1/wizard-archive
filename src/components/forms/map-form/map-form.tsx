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
import { FormFieldValidation } from '~/components/validation/name-validation-feedback'
import { getIconByName } from '~/lib/category-icons'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Button } from '~/components/shadcn/ui/button'
import { useFileWithPreview } from '~/hooks/useFileWithPreview'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { ImageUploadSection } from '~/components/file-upload/image-upload-section'

export interface MapFormValues {
  name: string
  iconName: string | null
  color: string | null
}

interface MapFormProps {
  mapId?: Id<'gameMaps'>
  campaignId?: Id<'campaigns'>
  parentId?: SidebarItemId
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
  const { navigateToMap } = useEditorNavigation()
  const map = useQuery(
    convexQuery(api.gameMaps.queries.getMap, mapId ? { mapId } : 'skip'),
  )

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.createMap),
  })

  const updateMutation = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.updateMap),
  })

  const imageUpload = useFileWithPreview({
    isOpen: true,
    fileStorageId: map.data?.imageStorageId,
    uploadOnSelect: true,
    fileTypeValidator: (file: File) => {
      if (!file.type.startsWith('image/')) {
        return { success: false, error: 'Only image files are allowed' }
      }
      return { success: true }
    },
  })

  // Get initial values based on current props
  const defaultValues = useMemo((): MapFormValues => {
    if (mapId && map.data) {
      return {
        name: map.data.name || '',
        iconName: map.data.iconName ?? null,
        color: map.data.color ?? null,
      }
    }
    return defaultMapFormValues
  }, [mapId, map.data])

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
    },
  })

  const { isLoading: isValidating, shouldValidate, checkNameUnique } = useNameValidation({
    name: form.state.values.name,
    initialName: map.data?.name ?? '',
    isActive: !!mapId,
    campaignId,
    parentId: map.data?.parentId,
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
          console.error('Failed to commit image upload:', error)
          toast.error('Failed to save image')
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

      if (mapId) {
        // Update existing map
        try {
          await updateMutation.mutateAsync({
            mapId,
            name: values.name,
            imageStorageId: finalImageStorageId,
            iconName: values.iconName,
            color: values.color,
          })
          toast.success('Map updated')
        } catch (error) {
          console.error(error)
          toast.error('Failed to update map')
          return
        }
      } else if (campaignId) {
        // Create new map - require image
        const { mapId: newMapId, slug: newMapSlug } =
          await createMutation.mutateAsync({
            campaignId,
            name: values.name,
            imageStorageId: finalImageStorageId,
            parentId,
          })
        await openParentFolders(newMapId)
        // Get the created map's slug for onSuccess callback
        navigateToMap(newMapSlug)
        toast.success('Map created')
        onSuccess?.(newMapSlug)
        onClose()
      } else {
        toast.error('Invalid form state: missing map or campaign ID')
        return
      }
    } catch (error) {
      console.error(error)
      toast.error(mapId ? 'Failed to update map' : 'Failed to create map')
    }
  }

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    imageUpload.isUploading

  const hasImage = !!(
    imageUpload.file ||
    (map.data?.imageStorageId && !imageUpload.removed)
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
        {(field) => {
          const hasRequiredError = field.state.meta.errors.some(
            (e) => e === 'Map name is required',
          )
          const hasUniqueError = field.state.meta.errors.some((e) =>
            e?.includes('already exists'),
          )
          return (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Map Name</Label>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Enter map name"
                disabled={isSubmitting}
                autoFocus
                aria-invalid={field.state.meta.errors.length > 0}
              />
              {hasRequiredError ? (
                <p className="text-sm text-destructive">Map name is required</p>
              ) : (
                <FormFieldValidation
                  isLoading={isValidating || field.state.meta.isValidating}
                  isNotUnique={hasUniqueError}
                  shouldValidate={shouldValidate || field.state.meta.isValidating}
                />
              )}
            </div>
          )
        }}
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
          isSubmitting={isSubmitting}
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
          const isDisabled = !name || !hasImage || isSubmitting || (mapId && !canSubmit)
          return (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isDisabled}>
                {mapId ? 'Update' : 'Create'}
              </Button>
            </div>
          )
        }}
      </form.Subscribe>
    </form>
  )
}
