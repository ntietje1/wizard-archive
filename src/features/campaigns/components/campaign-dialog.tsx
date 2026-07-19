import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { validateCampaignName } from 'shared/campaigns/validation'
import { Sword } from 'lucide-react'
import type { Campaign } from 'shared/campaigns/types'
import { Input } from '@wizard-archive/ui/shadcn/components/input'
import { Label } from '@wizard-archive/ui/shadcn/components/label'
import { Textarea } from '@wizard-archive/ui/shadcn/components/textarea'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { FormDialog } from '@wizard-archive/ui/components/form-dialog'
import {
  useCreateCampaignMutation,
  useUpdateCampaignMutation,
} from '~/features/campaigns/hooks/use-campaign-operations'
import { handleError } from '~/shared/utils/logger'

interface CampaignDialogProps {
  mode: 'create' | 'edit'
  isOpen: boolean
  onClose: () => void
  campaign?: Campaign
}

export function CampaignDialog({ mode, isOpen, onClose, campaign }: CampaignDialogProps) {
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
      {isOpen && <CampaignForm mode={mode} onClose={onClose} campaign={campaign} />}
    </FormDialog>
  )
}

function CampaignForm({ mode, onClose, campaign }: Omit<CampaignDialogProps, 'isOpen'>) {
  const createCampaign = useCreateCampaignMutation()
  const updateCampaign = useUpdateCampaignMutation()

  const form = useForm({
    defaultValues:
      mode === 'edit' && campaign
        ? {
            name: campaign.name,
            description: campaign.description || '',
          }
        : {
            name: '',
            description: '',
          },
    onSubmit: async ({ value }) => {
      try {
        if (mode === 'create') {
          await createCampaign.mutateAsync({
            name: value.name.trim(),
            description: value.description.trim(),
          })

          toast.success('Campaign created successfully')
          onClose()
        } else if (campaign) {
          await updateCampaign.mutateAsync({
            campaignId: campaign.id,
            name: value.name.trim(),
            description: value.description.trim() || undefined,
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
      action={() => {
        void form.handleSubmit()
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
            {field.state.meta.errors.length > 0 && field.state.meta.isTouched ? (
              <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
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

      <form.Subscribe
        selector={(s: any) => ({
          canSubmit: s.canSubmit,
          isSubmitting: s.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }: { canSubmit: boolean; isSubmitting: boolean }) => {
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
