import { useRouter } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/contexts/CampaignContext'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  convexQuery,
  useConvex,
  useConvexMutation,
} from '@convex-dev/react-query'
import {
  validateTagDescription,
  validateTagName,
  validateTagNameAsync,
} from './validators.ts'
import BaseTagDialog from '../base-tag-dialog/base-dialog.tsx'
import { toast } from 'sonner'
import { Label } from '~/components/shadcn/ui/label'
import { Input } from '~/components/shadcn/ui/input'
import { ColorPicker } from '../base-tag-dialog/color-picker.tsx'
import { Button } from '~/components/shadcn/ui/button.tsx'
import {
  type TagDialogProps,
  defaultBaseFormValues,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  type BaseTagFormValues,
} from '../base-tag-dialog/types.ts'

export default function GenericTagDialog(props: TagDialogProps) {
  // Extract properties based on discriminated union
  const isEditMode = props.mode === 'edit'
  const tag = isEditMode ? props.tag : undefined
  const config = props.config
  const navigateToNote = props.navigateToNote ?? false
  const mode = props.mode
  const isOpen = props.isOpen
  const onClose = props.onClose
  const parentFolderId = !isEditMode ? props.parentFolderId : undefined
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

  const getInitialValues = ({
    mode,
  }: {
    mode: 'create' | 'edit'
  }): BaseTagFormValues => {
    if (mode === 'edit' && tag) {
      return {
        name: tag.displayName,
        description: tag.description || '',
        color: tag.color,
      }
    }
    return {
      ...defaultBaseFormValues,
      color: getCategory.data?.defaultColor || defaultBaseFormValues.color,
    }
  }

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
      if (mode === 'create') {
        const result = await createMutation.mutateAsync({
          displayName: value.name.trim(),
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color,
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
        })

        toast.success(`${config.singular} updated successfully`)
        onClose()
      }
    } catch (error) {
      console.error(`Failed to ${mode} tag:`, error)
      toast.error(`Failed to ${mode} ${config.singular.toLowerCase()}`)
    }
  }

  if (!isOpen) return null

  return (
    <BaseTagDialog
      mode={mode}
      isOpen={isOpen}
      onClose={onClose}
      config={config}
      tag={tag as any}
      getInitialValues={getInitialValues}
      onSubmit={async ({ values }) => handleSubmit(values)}
    >
      {({ form, isSubmitting }: { form: any; isSubmitting: boolean }) => (
        <>
          {/* Name */}
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
            {(field: any) => (
              <div className="space-y-2 px-px">
                <Label htmlFor={`${config.singular.toLowerCase()}-name`}>
                  {config.singular} Name*
                </Label>
                <Input
                  id={`${config.singular.toLowerCase()}-name`}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={`Enter ${config.singular.toLowerCase()} name...`}
                  maxLength={MAX_NAME_LENGTH}
                  disabled={isSubmitting}
                />
                {field.state.meta.errors?.length &&
                field.state.meta.isTouched ? (
                  <p className="text-sm text-red-500">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          {/* Description */}
          <form.Field
            name="description"
            validators={{
              onChange: ({ value }: { value: string }) =>
                validateTagDescription(value, MAX_DESCRIPTION_LENGTH),
            }}
          >
            {(field: any) => (
              <div className="space-y-2 px-px">
                <Label htmlFor={`${config.singular.toLowerCase()}-description`}>
                  Description
                </Label>
                <textarea
                  id={`${config.singular.toLowerCase()}-description`}
                  rows={3}
                  className="flex h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  onBlur={field.handleBlur}
                  placeholder={`Describe this ${config.singular.toLowerCase()}...`}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </form.Field>

          {/* Color */}
          <form.Field name="color">
            {(field: any) => (
              <div className="space-y-2 px-px">
                <Label htmlFor={`${config.singular.toLowerCase()}-color`}>
                  {config.singular} Color
                </Label>
                <ColorPicker
                  selectedColor={field.state.value}
                  onColorChange={(color) => field.handleChange(color)}
                  disabled={isSubmitting}
                  aria-labelledby="color-picker-label"
                />
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(s: any) => ({
              canSubmit: s.canSubmit,
              isSubmitting: s.isSubmitting,
            })}
          >
            {({
              canSubmit,
              isSubmitting,
            }: {
              canSubmit: boolean
              isSubmitting: boolean
            }) => {
              return (
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!canSubmit || isSubmitting}>
                    {mode === 'create' ? 'Create' : 'Update'}
                  </Button>
                </div>
              )
            }}
          </form.Subscribe>
        </>
      )}
    </BaseTagDialog>
  )
}
