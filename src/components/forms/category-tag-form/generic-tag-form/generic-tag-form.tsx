import { useCallback, useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
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
import { Label } from '~/components/shadcn/ui/label'
import { Input } from '~/components/shadcn/ui/input'
import { ColorPicker } from '../base-tag-form/color-picker.tsx'
import { Button } from '~/components/shadcn/ui/button.tsx'
import { Textarea } from '~/components/shadcn/ui/textarea'
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  defaultBaseFormValues,
  type BaseTagFormValues,
} from '../base-tag-form/types.ts'
import { ImageUploadSection } from '~/components/file-upload/image-upload-section.tsx'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileWithPreview } from '~/hooks/useFileWithPreview.ts'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import { ErrorAlertAndCharacterCount } from '../base-tag-form/error-alert.tsx'
import type { GenericTagFormProps } from './types.ts'

export default function GenericTagForm({
  mode,
  tag,
  config,
  navigateToNote,
  parentFolderId,
  isOpen,
  onClose,
}: GenericTagFormProps) {
  const router = useRouter()
  const convex = useConvex()
  const { campaignWithMembership, dmUsername, campaignSlug } = useCampaign()
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
        color: tag.color,
      }
    } else {
      return {
        ...defaultBaseFormValues,
        color: getCategory.data?.defaultColor || defaultBaseFormValues.color,
      }
    }
  }, [tag, getCategory.data, mode])

  const form = useForm({
    defaultValues: getInitialValues(),
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
      onClose()
    },
  })

  useEffect(() => {
    form.reset(getInitialValues())
  }, [mode, tag?._id, getInitialValues, form])

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
          return
        }
      }

      if (mode === 'create') {
        const result = await createMutation.mutateAsync({
          displayName: value.name.trim(),
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color,
          imageStorageId: imageStorageId,
          campaignId: campaign._id,
          categoryId: getCategory.data._id,
          parentFolderId,
        })

        if (navigateToNote && result.noteId) {
          const note = await convex.query(api.notes.queries.getNote, {
            noteId: result.noteId,
          })
          if (note?.slug) {
            router.navigate({
              to: '/campaigns/$dmUsername/$campaignSlug/notes/$noteSlug',
              params: {
                dmUsername,
                campaignSlug,
                noteSlug: note.slug,
              },
            })
          }
        }

        toast.success(`${config.singular} created successfully`)
        onClose()
      } else if (mode === 'edit' && tag) {
        await updateMutation.mutateAsync({
          tagId: tag._id,
          displayName: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color,
          imageStorageId: imageStorageId,
        })

        toast.success(`${config.singular} updated successfully`)
        onClose()
      }
    } catch (error) {
      console.error(`Failed to ${mode} tag:`, error)
      toast.error(`Failed to ${mode} ${config.singular.toLowerCase()}`)
    }
  }

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
            if (!campaign) return undefined
            return validateTagNameAsync(
              convex,
              campaign._id,
              value,
              mode === 'edit' && tag ? tag._id : undefined,
            )
          },
          onChangeAsyncDebounceMs: 300,
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label
              htmlFor={`${config.singular.toLowerCase()}-name`}
              className="text-sm font-semibold"
            >
              {config.singular} Name *
            </Label>
            <Input
              id={`${config.singular.toLowerCase()}-name`}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder={`Enter ${config.singular.toLowerCase()} name...`}
              maxLength={MAX_NAME_LENGTH}
              disabled={form.state.isSubmitting || imageUpload.isUploading}
              className="transition-colors"
            />
            <ErrorAlertAndCharacterCount
              error={field.state.meta.errors[0]}
              shouldShowError={
                field.state.meta.errors.length > 0 && field.state.meta.isTouched
              }
              characterCount={field.state.value.length}
              maxCharCount={MAX_NAME_LENGTH}
            />
          </div>
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
          <div className="space-y-2">
            <Label
              htmlFor={`${config.singular.toLowerCase()}-description`}
              className="text-sm font-semibold"
            >
              Description
            </Label>
            <Textarea
              id={`${config.singular.toLowerCase()}-description`}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder={`Describe this ${config.singular.toLowerCase()}...`}
              maxLength={MAX_DESCRIPTION_LENGTH}
              disabled={form.state.isSubmitting || imageUpload.isUploading}
              className="resize-none"
            />
            <ErrorAlertAndCharacterCount
              error={field.state.meta.errors[0]}
              shouldShowError={
                field.state.meta.errors.length > 0 && field.state.meta.isTouched
              }
              characterCount={field.state.value.length}
              maxCharCount={MAX_DESCRIPTION_LENGTH}
            />
          </div>
        )}
      </form.Field>

      {/* Color Picker */}
      <form.Field name="color">
        {(field) => (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Tag Color</Label>
            <ColorPicker
              selectedColor={field.state.value}
              onColorChange={(color) => field.handleChange(color)}
              disabled={form.state.isSubmitting || imageUpload.isUploading}
              aria-labelledby="color-picker-label"
            />
          </div>
        )}
      </form.Field>

      {/* Image Upload Section */}
      <ImageUploadSection
        label={`Image`}
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
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting || imageUpload.isUploading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting || imageUpload.isUploading}
              >
                {isSubmitting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                    {mode === 'create' ? 'Creating...' : 'Updating...'}
                  </>
                ) : mode === 'create' ? (
                  'Create'
                ) : (
                  'Update'
                )}
              </Button>
            </div>
          )
        }}
      </form.Subscribe>
    </form>
  )
}
