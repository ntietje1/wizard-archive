import { useMemo } from 'react'
import { api } from 'convex/_generated/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  convexQuery,
  useConvex,
  useConvexMutation,
} from '@convex-dev/react-query'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import {
  validateTagDescription,
  validateTagName,
} from '../generic-tag-form/validators.ts'
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
} from '../base-tag-form/types.ts'
import {
  ColorField,
  DescriptionField,
  ImageUploadField,
  NameField,
  SubmitButtons,
} from '../generic-tag-form/fields.tsx'
import { defaultLocationFormValues } from './types.ts'
import type { Id } from 'convex/_generated/dataModel'
import type { LocationFormValues, LocationTagFormProps } from './types.ts'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation.ts'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { useFileWithPreview } from '~/hooks/useFileWithPreview.ts'

export default function LocationTagForm({
  mode,
  location,
  campaignId,
  categoryId,
  parentId,
  isOpen,
  onClose,
  onLocationCreated,
}: LocationTagFormProps) {
  const { campaignWithMembership } = useCampaign()
  const { navigateToTag } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const campaign = campaignWithMembership.data?.campaign

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.createLocation),
  })

  const updateMutation = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.updateLocation),
  })

  const categoryQuery = useQuery(
    convexQuery(api.tags.queries.getTagCategory, { campaignId, categoryId }),
  )

  const imageUpload = useFileWithPreview({
    isOpen,
    fileStorageId: location?.imageStorageId,
    uploadOnSelect: true,
    fileTypeValidator: (file: File) => {
      if (!file.type.startsWith('image/')) {
        return { success: false, error: 'Only image files are allowed' }
      }
      return { success: true }
    },
  })

  const defaultValues = useMemo((): LocationFormValues => {
    if (mode === 'edit' && location) {
      return {
        name: location.name || '',
        description: location.description || '',
        color: location.color ?? null,
      }
    } else {
      return defaultLocationFormValues
    }
  }, [mode, location])

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
    },
  })

  async function handleSubmit(value: LocationFormValues) {
    if (!campaign) {
      toast.error('Campaign not found')
      return
    }

    if (!categoryQuery.data) {
      toast.error(`Category not found`)
      return
    }

    try {
      let imageStorageId: Id<'_storage'> | undefined = undefined

      if (imageUpload.file) {
        try {
          imageStorageId = await imageUpload.handleSubmit()
        } catch (error) {
          console.error('Failed to upload image:', error)
          toast.error('Failed to upload image')
          return
        }
      }

      if (mode === 'create') {
        const { tagId, locationId, slug } = await createMutation.mutateAsync({
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color ?? undefined,
          imageStorageId,
          campaignId: campaign._id,
          categoryId: categoryQuery.data._id,
          parentId: parentId ?? categoryQuery.data._id,
        })
        onLocationCreated?.(locationId)
        await openParentFolders(tagId)
        navigateToTag(slug)
        toast.success(
          `${categoryQuery.data.name || 'Tag'} created successfully`,
        )
        onClose()
      } else if (location) {
        console.log('updateMutation', value)
        console.log('location', location)
        await updateMutation.mutateAsync({
          locationId: location.locationId,
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color,
          imageStorageId,
        })

        toast.success(
          `${categoryQuery.data.name || 'Tag'} updated successfully`,
        )
        onClose()
      } else {
        toast.error('Invalid form state: missing location')
        return
      }
    } catch (error) {
      console.error(`Failed to ${mode} tag:`, error)
      toast.error(`Failed to ${mode} ${categoryQuery.data.name || 'Tag'}`)
    }
  }

  const isFormDisabled = form.state.isSubmitting || imageUpload.isUploading

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-4"
    >
      {/* Name Field */}
      <form.Field
        name="name"
        validators={{
          onMount: ({ value }: { value: string }) =>
            validateTagName(value, MAX_NAME_LENGTH),
          onChange: ({ value }: { value: string }) =>
            validateTagName(value, MAX_NAME_LENGTH),
        }}
      >
        {(field) => (
          <NameField
            field={field}
            categoryName={categoryQuery.data?.name || 'Tag'}
            isDisabled={isFormDisabled}
          />
        )}
      </form.Field>

      {/* Description Field */}
      <form.Field
        name="description"
        validators={{
          onChange: ({ value }: { value: string }) =>
            validateTagDescription(value, MAX_DESCRIPTION_LENGTH),
        }}
      >
        {(field) => (
          <DescriptionField
            field={field}
            categoryName={categoryQuery.data?.name || 'Tag'}
            isDisabled={isFormDisabled}
          />
        )}
      </form.Field>

      {/* Color Picker */}
      <form.Field name="color">
        {(field) => (
          <ColorField
            field={field}
            isDisabled={isFormDisabled}
            categoryDefaultColor={categoryQuery.data?.defaultColor}
          />
        )}
      </form.Field>

      {/* Image Upload Section */}
      <ImageUploadField
        label="Image"
        fileUpload={imageUpload}
        isSubmitting={form.state.isSubmitting}
        handleFileSelect={imageUpload.handleFileSelect}
      />

      {/* Submit Buttons */}
      <form.Subscribe
        selector={(s: { canSubmit: boolean; isSubmitting: boolean }) => ({
          canSubmit: s.canSubmit,
          isSubmitting: s.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }) => {
          return (
            <SubmitButtons
              mode={mode}
              isSubmitting={isSubmitting}
              canSubmit={canSubmit}
              imageUpload={imageUpload}
              nameValue={form.state.values.name}
              onClose={onClose}
            />
          )
        }}
      </form.Subscribe>
    </form>
  )
}
