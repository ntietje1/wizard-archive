import { useCallback, useEffect } from 'react'
import { api } from 'convex/_generated/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  convexQuery,
  useConvex,
  useConvexMutation,
} from '@convex-dev/react-query'
import { useForm } from '@tanstack/react-form'
import {
  validateTagDescription,
  validateTagName,
  validateTagNameAsync,
} from './validators.ts'
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  defaultBaseFormValues,
  type BaseTagFormValues,
} from '../base-tag-form/types.ts'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileWithPreview } from '~/hooks/useFileWithPreview.ts'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import type { GenericTagFormProps } from './types.ts'
import {
  NameField,
  DescriptionField,
  ColorField,
  ImageUploadField,
  SubmitButtons,
} from './fields.tsx'
import { useEditorNavigation } from '~/hooks/useEditorNavigation.ts'

export default function GenericTagForm({
  mode,
  tag,
  config,
  parentFolderId,
  isOpen,
  onClose,
}: GenericTagFormProps) {
  const convex = useConvex()
  const { campaignWithMembership } = useCampaign()
  const { navigateToNote } = useEditorNavigation()
  const campaign = campaignWithMembership?.data?.campaign

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.createTag),
  })

  const updateMutation = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.updateTag),
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
    fileStorageId: tag?.imageStorageId,
    uploadOnSelect: true,
    fileTypeValidator: (file: File) => {
      if (!file.type.startsWith('image/')) {
        return { success: false, error: 'Only image files are allowed' }
      }
      return { success: true }
    },
  })

  const getInitialValues = useCallback((): BaseTagFormValues => {
    if (mode === 'edit' && tag) {
      return {
        name: tag.displayName,
        description: tag.description || '',
        color: tag.color ?? null,
      }
    } else {
      return defaultBaseFormValues
    }
  }, [tag, mode])

  const form = useForm({
    defaultValues: getInitialValues(),
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
      onClose()
    },
  })

  useEffect(() => {
    form.reset(getInitialValues())
  }, [mode, tag?._id, getInitialValues])

  async function handleSubmit(value: BaseTagFormValues) {
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
          displayName: value.name.trim(),
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color ?? undefined,
          imageStorageId: imageStorageId,
          campaignId: campaign._id,
          categoryId: getCategory.data._id,
          parentFolderId,
        })

        if (result.noteId) {
          const note = await convex.query(api.notes.queries.getNote, {
            noteId: result.noteId,
          })
          if (note?.slug) {
            navigateToNote(note.slug)
          }
        }

        toast.success(`${config.singular} created successfully`)
      } else if (mode === 'edit' && tag) {
        await updateMutation.mutateAsync({
          tagId: tag._id,
          displayName: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color,
          imageStorageId: imageStorageId,
        })

        toast.success(`${config.singular} updated successfully`)
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
          onChangeAsync: async ({ value }: { value: string }) => {
            if (!campaign || !getCategory.data) return undefined
            return validateTagNameAsync(
              convex,
              campaign._id,
              getCategory.data._id,
              value,
              mode === 'edit' && tag ? tag._id : undefined,
            )
          },
          onChangeAsyncDebounceMs: 300,
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
