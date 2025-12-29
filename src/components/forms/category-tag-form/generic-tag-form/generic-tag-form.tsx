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
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  defaultBaseFormValues,
} from '../base-tag-form/types.ts'
import { validateTagDescription, validateTagName } from './validators.ts'
import {
  ColorField,
  DescriptionField,
  ImageUploadField,
  NameField,
  SubmitButtons,
} from './fields.tsx'
import type { BaseTagFormValues } from '../base-tag-form/types.ts'
import type { Id } from 'convex/_generated/dataModel'
import type { GenericTagFormProps } from './types.ts'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileWithPreview } from '~/hooks/useFileWithPreview.ts'
import { useEditorNavigation } from '~/hooks/useEditorNavigation.ts'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

export default function GenericTagForm({
  mode,
  tag,
  campaignId,
  categoryId,
  parentId,
  isOpen,
  onClose,
}: GenericTagFormProps) {
  const { campaignWithMembership } = useCampaign()
  const { navigateToTag } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const campaign = campaignWithMembership.data?.campaign

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.createTag),
  })

  const updateMutation = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.updateTag),
  })

  const categoryQuery = useQuery(
    convexQuery(api.tags.queries.getTagCategory, { campaignId, categoryId }),
  )

  const imageUpload = useFileWithPreview({
    isOpen,
    fileStorageId: tag?.imageStorageId,
    uploadOnSelect: true,
    fileTypeValidator: (file: File) => {
      if (!file.type.startsWith('image/')) {
        return { success: false, error: 'Only image files are allowed' }
      }
      return { success: true }
    },
  })

  const defaultValues = useMemo((): BaseTagFormValues => {
    if (mode === 'edit' && tag) {
      return {
        name: tag.name || '',
        description: tag.description || '',
        color: tag.color ?? null,
      }
    } else {
      return defaultBaseFormValues
    }
  }, [mode, tag])

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
      onClose()
    },
  })

  async function handleSubmit(value: BaseTagFormValues) {
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
        const { tagId, slug } = await createMutation.mutateAsync({
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color ?? undefined,
          imageStorageId,
          campaignId: campaign._id,
          categoryId: categoryQuery.data._id,
          parentId: parentId ?? categoryQuery.data._id,
        })
        await openParentFolders(tagId)
        navigateToTag(slug)
        toast.success(
          `${categoryQuery.data.name || 'Tag'} created successfully`,
        )
        onClose()
      } else if (tag) {
        await updateMutation.mutateAsync({
          tagId: tag._id,
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color,
          imageStorageId,
        })

        toast.success(
          `${categoryQuery.data.name || 'Tag'} updated successfully`,
        )
      } else {
        toast.error('Invalid form state: missing tag')
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
