import { useCallback, useEffect } from 'react'
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
  MAX_NAME_LENGTH
  
} from '../base-tag-form/types.ts'
import {
  ColorField,
  DescriptionField,
  ImageUploadField,
  NameField,
  SubmitButtons,
} from '../generic-tag-form/fields.tsx'
import {  defaultLocationFormValues } from './types.ts'
import type {TagCategoryConfig} from '../base-tag-form/types.ts';
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { Location } from 'convex/locations/types'
import type {LocationFormValues} from './types.ts';
import { useCampaign } from '~/contexts/CampaignContext'
import { useEditorNavigation } from '~/hooks/useEditorNavigation.ts'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { useFileWithPreview } from '~/hooks/useFileWithPreview.ts'

interface LocationTagFormProps {
  mode: 'create' | 'edit'
  location?: Location
  config: TagCategoryConfig
  parentId?: SidebarItemId
  isOpen: boolean
  onClose: () => void
  onLocationCreated?: (locationId: Id<'locations'>) => void
}

export default function LocationTagForm({
  mode,
  location,
  config,
  parentId,
  isOpen,
  onClose,
  onLocationCreated,
}: LocationTagFormProps) {
  const convex = useConvex()
  const { campaignWithMembership } = useCampaign()
  const { navigateToTag } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const campaign = campaignWithMembership?.data?.campaign

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.createLocation),
  })

  const updateMutation = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.updateLocation),
  })

  const getCategory = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaign?._id
        ? {
            campaignId: campaign?._id,
            slug: config.categorySlug,
          }
        : 'skip',
    ),
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

  const getInitialValues = useCallback((): LocationFormValues => {
    if (mode === 'edit' && location) {
      return {
        name: location.name || '',
        description: location.description || '',
        color: location.color ?? null,
      }
    } else {
      return defaultLocationFormValues
    }
  }, [location, mode])

  const form = useForm({
    defaultValues: getInitialValues(),
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
    },
  })

  useEffect(() => {
    form.reset(getInitialValues())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?._id, parentId])

  async function handleSubmit(value: LocationFormValues) {
    if (!campaign) {
      toast.error('Campaign not found')
      return
    }

    if (!getCategory.data) {
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
        const result = await createMutation.mutateAsync({
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color ?? undefined,
          imageStorageId,
          campaignId: campaign._id,
          categoryId: getCategory.data._id,
          parentId: parentId ?? getCategory.data._id,
        })

        if (onLocationCreated) {
          onLocationCreated(result.locationId)
        }

        // Open parent folders and get the tag to navigate to it
        await openParentFolders(result.tagId)
        const tag = await convex.query(api.tags.queries.getTag, {
          campaignId: campaign._id,
          tagId: result.tagId,
        })
        if (tag?.slug) {
          navigateToTag(tag.slug)
        }

        if (!onLocationCreated) {
          toast.success(`${config.singular} created successfully`)
          onClose()
        }
      } else if (mode === 'edit' && location) {
        await updateMutation.mutateAsync({
          locationId: location.locationId,
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color,
          imageStorageId,
        })

        toast.success(`${config.singular} updated successfully`)
        onClose()
      }
    } catch (error) {
      console.error(`Failed to ${mode} tag:`, error)
      toast.error(`Failed to ${mode} ${config.singular.toLowerCase()}`)
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
            config={config}
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
            config={config}
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
            categoryDefaultColor={getCategory.data?.defaultColor}
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
