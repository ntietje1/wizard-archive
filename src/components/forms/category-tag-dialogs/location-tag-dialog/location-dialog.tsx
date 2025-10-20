import type { Location } from 'convex/locations/types'
import {
  convexQuery,
  useConvex,
  useConvexMutation,
} from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { Label } from '~/components/shadcn/ui/label'
import { Input } from '~/components/shadcn/ui/input'
import { ColorPicker } from '../base-tag-dialog/color-picker'
import { Button } from '~/components/shadcn/ui/button.tsx'
import { useCampaign } from '~/contexts/CampaignContext'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import BaseTagDialog from '../base-tag-dialog/base-dialog.tsx'
import {
  validateTagName,
  validateTagNameAsync,
  validateTagDescription,
} from '../generic-tag-dialog/validators.ts'
import {
  type TagDialogProps,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
} from '../base-tag-dialog/types.ts'
import { defaultLocationFormValues, type LocationFormValues } from './types.ts'

export default function LocationDialog(props: TagDialogProps<Location>) {
  // Extract properties based on discriminated union
  const isEditMode = props.mode === 'edit'
  const location = isEditMode ? props.tag : undefined
  const config = props.config
  const navigateToNote = props.navigateToNote ?? false
  const parentFolderId = !isEditMode ? props.parentFolderId : undefined
  const mode = props.mode
  const isOpen = props.isOpen
  const onClose = props.onClose
  const router = useRouter()
  const convex = useConvex()
  const { campaignWithMembership, dmUsername, campaignSlug } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign

  console.log('config', config)

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

  const createLocationMutation = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.createLocation),
  })
  const updateTagMutation = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.updateTag),
  })
  const updateLocationMutation = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.updateLocation),
  })

  const getInitialValues = ({ mode }: { mode: 'create' | 'edit' }) => {
    if (mode === 'edit' && location) {
      return {
        name: location.displayName || '',
        description: location.description || '',
        color: location.color,
      }
    }
    return {
      ...defaultLocationFormValues,
      color: getCategory.data?.defaultColor || defaultLocationFormValues.color,
    }
  }

  async function handleSubmit(args: {
    mode: 'create' | 'edit'
    values: LocationFormValues
  }) {
    const { mode, values } = args
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
        const tagResult = await createLocationMutation.mutateAsync({
          displayName: values.name.trim(),
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          color: values.color,
          campaignId: campaign._id,
          categoryId: getCategory.data._id,
          parentFolderId,
        })

        if (navigateToNote && tagResult.noteId) {
          const note = await convex.query(api.notes.queries.getNote, {
            noteId: tagResult.noteId,
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
      } else if (mode === 'edit' && location) {
        await updateTagMutation.mutateAsync({
          tagId: location.tagId,
          displayName: values.name.trim(),
          description: values.description.trim() || undefined,
          color: values.color,
        })

        await updateLocationMutation.mutateAsync({
          locationId: location.locationId,
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
    <BaseTagDialog
      mode={mode}
      isOpen={isOpen}
      onClose={onClose}
      config={config}
      tag={location as any}
      getInitialValues={getInitialValues}
      onSubmit={handleSubmit}
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
                  mode === 'edit' && location ? location.tagId : undefined,
                )
              },
              onChangeAsyncDebounceMs: 300,
            }}
          >
            {(field: any) => (
              <div className="space-y-2 px-px">
                <Label htmlFor={`${config.singular.toLowerCase()}-name`}>
                  {config.singular} Name
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
