import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { useConvex, useConvexMutation } from '@convex-dev/react-query'
import {
  validateCampaignName,
  validateCampaignSlugAsync,
  validateCampaignSlugSync,
} from './campaign-form-validators'
import type { Campaign } from 'convex/campaigns/types'
import { UrlPreview } from '~/routes/_authed/campaigns/-components/url-preview'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Button } from '~/components/shadcn/ui/button'
import { Link, Sword } from '~/lib/icons'
import { FormDialog } from '~/components/forms/base-form/form-dialog'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { useAuthQuery } from '~/hooks/useAuthQuery'

const DEFAULT_CAMPAIGN_FORM_VALUES: {
  name: string
  description: string
  slug: string
} = {
  name: '',
  description: '',
  slug: '',
}

interface CampaignDialogProps {
  mode: 'create' | 'edit'
  isOpen: boolean
  onClose: () => void
  campaign?: Campaign // Required for edit mode
}

export function CampaignDialog({
  mode,
  isOpen,
  onClose,
  campaign,
}: CampaignDialogProps) {
  const convex = useConvex()
  const userProfile = useAuthQuery(api.users.queries.getUserProfile, {})
  const createCampaign = useMutation({
    mutationFn: useConvexMutation(api.campaigns.mutations.createCampaign),
  })
  const updateCampaign = useMutation({
    mutationFn: useConvexMutation(api.campaigns.mutations.updateCampaign),
  })

  const form = useForm({
    defaultValues: { ...DEFAULT_CAMPAIGN_FORM_VALUES },
    onSubmit: async ({ value }) => {
      // Prevent submission if validation failed
      try {
        if (mode === 'create') {
          await createCampaign.mutateAsync({
            name: value.name.trim(),
            description: value.description.trim(),
            slug: value.slug.trim(),
          })

          toast.success('Campaign created successfully')
          onClose()
        } else if (campaign) {
          await updateCampaign.mutateAsync({
            campaignId: campaign._id,
            name: value.name.trim(),
            description: value.description.trim() || undefined,
            slug: value.slug.trim(),
          })

          toast.success('Campaign updated successfully')
          onClose()
        } else {
          toast.error('Invalid form state: missing campaign')
          return
        }
      } catch (error) {
        console.error('Failed to save campaign:', error)
        toast.error(`Failed to ${mode} campaign`)
      }
    },
  })

  // Initialize form data
  useEffect(() => {
    if (mode === 'create') {
      const randomSlug = Math.random().toString(36).substring(2, 15)
      form.reset({
        ...DEFAULT_CAMPAIGN_FORM_VALUES,
        slug: randomSlug,
      })
    } else if (campaign) {
      form.reset({
        name: campaign.name,
        description: campaign.description || '',
        slug: campaign.slug,
      })
    }
  }, [mode, campaign, isOpen, form])

  // Clear form when dialog closes
  useEffect(() => {
    if (!isOpen && form.state.isDirty) {
      form.reset({
        name: '',
        description: '',
        slug: '',
      })
    }
  }, [isOpen, form])

  const handleClose = () => {
    if (form.state.isSubmitting) return
    onClose()
  }

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'create' ? 'New Campaign' : 'Edit Campaign'}
      description={
        mode === 'create'
          ? 'Start a new TTRPG adventure and invite your party to join.'
          : 'Update campaign details'
      }
      icon={Sword}
    >
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
            onMount: ({ value }) => validateCampaignName(value),
            onBlur: ({ value }) => validateCampaignName(value),
          }}
        >
          {(field) => (
            <div className="space-y-2 px-px">
              <Label htmlFor="campaign-name">Campaign Name*</Label>
              <Input
                id="campaign-name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Enter campaign name"
                disabled={form.state.isSubmitting}
                required
              />
              {field.state.meta.errors.length > 0 &&
              field.state.meta.isTouched ? (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              ) : null}
            </div>
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <div className="space-y-2 px-px">
              <Label htmlFor="campaign-description">Description</Label>
              <textarea
                id="campaign-description"
                rows={3}
                className="flex h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="A thrilling adventure in the Sword Coast..."
                disabled={form.state.isSubmitting}
              />
            </div>
          )}
        </form.Field>

        <form.Field
          name="slug"
          validators={{
            onMount: ({ value }) => {
              return validateCampaignSlugSync(value)
            },
            onBlur: ({ value }) => {
              return validateCampaignSlugSync(value)
            },
            onChangeAsync: async ({ value }) => {
              const syncError = validateCampaignSlugSync(value)
              if (syncError) return syncError
              return validateCampaignSlugAsync(
                convex,
                value,
                mode === 'edit' && campaign ? campaign._id : undefined,
              )
            },
            onChangeAsyncDebounceMs: 300,
          }}
        >
          {(field) => (
            <div className="space-y-2 px-px">
              <Label
                htmlFor="campaign-slug"
                className="flex items-center gap-2"
              >
                <Link className="h-4 w-4" />
                Custom Link*
              </Label>
              <div className="relative">
                <Input
                  id="campaign-slug"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={() => field.handleBlur()}
                  placeholder="campaign-link"
                  minLength={3}
                  maxLength={30}
                  disabled={form.state.isSubmitting}
                  required
                  className="pr-8"
                />
                {field.state.meta.isValidating && (
                  <LoadingSpinner
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    aria-label="Validating slug"
                  />
                )}
              </div>
              {field.state.meta.errors.length > 0 &&
              field.state.meta.isTouched ? (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              ) : null}

              {userProfile.data?.username ? (
                <UrlPreview
                  url={`${window.location.origin}/join/${userProfile.data.username}/${field.state.value || 'campaign-link'}`}
                />
              ) : (
                <UrlPreview url="Loading preview..." />
              )}
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
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {mode === 'create' ? 'Create Campaign' : 'Update Campaign'}
                </Button>
              </div>
            )
          }}
        </form.Subscribe>
      </form>
    </FormDialog>
  )
}
