import { useRef } from 'react'
import { useForm } from '@tanstack/react-form'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import {
  validateCampaignName,
  validateCampaignSlug,
} from 'convex/campaigns/validation'
import { Link, Sword } from 'lucide-react'
import type { RefObject } from 'react'
import type { Campaign } from 'convex/campaigns/types'
import { UrlPreview } from '~/features/campaigns/components/url-preview'
import { Input } from '~/features/shadcn/components/input'
import { Label } from '~/features/shadcn/components/label'
import { Textarea } from '~/features/shadcn/components/textarea'
import { Button } from '~/features/shadcn/components/button'
import { FormDialog } from '~/shared/components/form-dialog'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { handleError } from '~/shared/utils/logger'

interface CampaignDialogProps {
  mode: 'create' | 'edit'
  isOpen: boolean
  onClose: () => void
  campaign?: Campaign
  campaigns: Array<Campaign>
}

export function CampaignDialog({
  mode,
  isOpen,
  onClose,
  campaign,
  campaigns,
}: CampaignDialogProps) {
  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'New Campaign' : 'Edit Campaign'}
      description={
        mode === 'create'
          ? 'Start a new TTRPG adventure and invite your party to join.'
          : 'Update campaign details'
      }
      icon={Sword}
    >
      {isOpen && (
        <CampaignForm
          mode={mode}
          onClose={onClose}
          campaign={campaign}
          campaigns={campaigns}
        />
      )}
    </FormDialog>
  )
}

function CampaignForm({
  mode,
  onClose,
  campaign,
  campaigns,
}: Omit<CampaignDialogProps, 'isOpen'>) {
  const userProfile = useAuthQuery(api.users.queries.getUserProfile, {})
  const createCampaign = useAppMutation(api.campaigns.mutations.createCampaign)
  const updateCampaign = useAppMutation(api.campaigns.mutations.updateCampaign)

  const campaignsRef: RefObject<Array<Campaign>> = useRef(campaigns)
  campaignsRef.current = campaigns

  const defaultValues =
    mode === 'edit' && campaign
      ? {
          name: campaign.name,
          description: campaign.description || '',
          slug: campaign.slug,
        }
      : {
          name: '',
          description: '',
          slug: Math.random().toString(36).substring(2, 15),
        }

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
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
        handleError(error, 'Failed to save campaign')
      }
    },
  })

  const handleClose = () => {
    if (form.state.isSubmitting) return
    onClose()
  }

  return (
    <form
      noValidate
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
            <Textarea
              id="campaign-description"
              rows={3}
              className="h-20"
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
          onMount: ({ value }) => validateCampaignSlug(value),
          onBlur: ({ value }) => validateCampaignSlug(value),
          onChange: ({ value }) => {
            const syncError = validateCampaignSlug(value)
            if (syncError) return syncError
            const excludeId = mode === 'edit' ? campaign?._id : undefined
            const slugTaken = campaignsRef.current.some(
              (c) => c.slug === value && c._id !== excludeId,
            )
            return slugTaken ? 'This link is already taken.' : null
          },
        }}
      >
        {(field) => (
          <div className="space-y-2 px-px">
            <Label htmlFor="campaign-slug" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Custom Link*
            </Label>
            <Input
              id="campaign-slug"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={() => field.handleBlur()}
              placeholder="campaign-link"
              maxLength={30}
              disabled={form.state.isSubmitting}
            />
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
  )
}
