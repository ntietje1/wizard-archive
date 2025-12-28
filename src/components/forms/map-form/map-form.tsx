import { useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  convexQuery,
  useConvex,
  useConvexMutation,
} from '@convex-dev/react-query'
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
import { ImageUploadSection } from '~/components/file-upload/image-upload-section'

export interface MapFormValues {
  name: string
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
  const convex = useConvex()
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
        await updateMutation.mutateAsync({
          mapId,
          name: values.name,
          imageStorageId: finalImageStorageId,
        })
        toast.success('Map updated')
      } else if (campaignId) {
        // Create new map - require image
        const newMapId = await createMutation.mutateAsync({
          campaignId,
          name: values.name,
          imageStorageId: finalImageStorageId,
          parentId,
        })
        await openParentFolders(newMapId)
        // Get the created map's slug for onSuccess callback
        let mapSlug: string | undefined
        try {
          const createdMap = await convex.query(api.gameMaps.queries.getMap, {
            mapId: newMapId,
          })
          mapSlug = createdMap.slug
        } catch (error) {
          console.error('Failed to get created map:', error)
        }

        // Only navigate to map if onSuccess is not provided (onSuccess handles navigation)
        if (!onSuccess && mapSlug) {
          navigateToMap(mapSlug)
        }
        toast.success('Map created')
        onSuccess?.(mapSlug)
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
      // key={formKey}
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
              ? 'Map name is required'
              : undefined,
        }}
      >
        {(field) => (
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
        })}
      >
        {({ name }) => {
          const isDisabled = !name || !hasImage || isSubmitting
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
