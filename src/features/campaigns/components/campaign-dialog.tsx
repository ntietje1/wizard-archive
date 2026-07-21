import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { validateCampaignName } from 'shared/campaigns/validation'
import { Sword } from 'lucide-react'
import { Input } from '@wizard-archive/ui/shadcn/components/input'
import { Label } from '@wizard-archive/ui/shadcn/components/label'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { FormDialog } from '@wizard-archive/ui/components/form-dialog'
import { useCreateCampaignMutation } from '~/features/campaigns/hooks/use-campaign-operations'
import { handleError } from '~/shared/utils/logger'

interface CampaignDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function CampaignDialog({ isOpen, onClose }: CampaignDialogProps) {
  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title="New Campaign"
      description="Start a new TTRPG adventure and invite your party to join."
      icon={Sword}
    >
      {isOpen && <CampaignForm onClose={onClose} />}
    </FormDialog>
  )
}

function CampaignForm({ onClose }: Pick<CampaignDialogProps, 'onClose'>) {
  const createCampaign = useCreateCampaignMutation()

  const form = useForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => {
      try {
        await createCampaign.mutateAsync({ name: value.name.trim() })
        toast.success('Campaign created successfully')
        onClose()
      } catch (error) {
        handleError(error, 'Failed to create campaign')
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

      <form.Subscribe selector={(state) => state}>
        {(state) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!state.canSubmit || state.isSubmitting}>
              Create Campaign
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}
