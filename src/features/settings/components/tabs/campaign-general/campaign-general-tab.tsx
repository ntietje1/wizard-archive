import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CAMPAIGN_NAME_MAX_LENGTH, CAMPAIGN_SLUG_MAX_LENGTH } from 'shared/campaigns/constants'
import type { Campaign } from 'shared/campaigns/types'
import { validateCampaignName, validateCampaignSlug } from 'shared/campaigns/validation'
import { useOptionalCampaign } from '~/features/campaigns/hooks/useCampaign'
import { SettingsSection } from '~/features/settings/components/settings-section'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { Input } from '@wizard-archive/ui/shadcn/components/input'
import { Label } from '@wizard-archive/ui/shadcn/components/label'
import { Switch } from '@wizard-archive/ui/shadcn/components/switch'
import { Textarea } from '@wizard-archive/ui/shadcn/components/textarea'
import { useUpdateCampaignMutation } from '~/features/campaigns/hooks/use-campaign-operations'
import { FOLDER_ACCESS_INHERITANCE } from '@wizard-archive/editor/resources/access-policy'
import { getClientErrorMessage } from 'shared/errors/client'

export function CampaignGeneralTab() {
  const campaignContext = useOptionalCampaign()
  const updateCampaign = useUpdateCampaignMutation({
    onError: (error) => {
      toast.error(getClientErrorMessage(error) ?? 'Failed to update campaign settings')
    },
  })

  if (!campaignContext) return <NoCampaignGeneralTab />

  const campaign = campaignContext.campaign.data

  if (campaignContext.campaign.isLoading) {
    return (
      <CampaignGeneralShell>
        <output
          aria-label="Loading campaign settings"
          className="flex items-center justify-center py-8"
        >
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </output>
      </CampaignGeneralShell>
    )
  }

  if (campaignContext.campaign.isError || !campaign) {
    return (
      <CampaignGeneralShell>
        <SettingsSection title="Folders">
          <p className="text-sm text-destructive">Failed to load campaign settings.</p>
        </SettingsSection>
      </CampaignGeneralShell>
    )
  }

  const pendingValue =
    updateCampaign.isPending &&
    updateCampaign.variables?.campaignId === campaign.id &&
    updateCampaign.variables.resourceAccessDefaults !== undefined
      ? updateCampaign.variables.resourceAccessDefaults.folderInheritance
      : undefined
  const folderInheritance = pendingValue ?? campaign.resourceAccessDefaults.folderInheritance
  const canEdit = campaignContext.isDm === true

  return (
    <CampaignGeneralShell>
      <CampaignDetailsForm
        key={`${campaign.id}:${campaign.name}:${campaign.description}:${campaign.slug}`}
        campaign={campaign}
        canEdit={canEdit}
        updateCampaign={updateCampaign}
      />
      <SettingsSection title="Folders">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Share folder contents automatically</p>
            <p className="text-sm text-muted-foreground">
              When this is on, sharing a folder will share all documents within it.
            </p>
          </div>
          <Switch
            aria-label="Share folder contents automatically"
            checked={folderInheritance === FOLDER_ACCESS_INHERITANCE.enabled}
            disabled={!canEdit || updateCampaign.isPending}
            onCheckedChange={(enabled) => {
              updateCampaign.mutate({
                campaignId: campaign.id,
                resourceAccessDefaults: {
                  folderInheritance: enabled
                    ? FOLDER_ACCESS_INHERITANCE.enabled
                    : FOLDER_ACCESS_INHERITANCE.disabled,
                },
              })
            }}
          />
        </div>
      </SettingsSection>
    </CampaignGeneralShell>
  )
}

type UpdateCampaignMutation = ReturnType<typeof useUpdateCampaignMutation>

function CampaignDetailsForm({
  campaign,
  canEdit,
  updateCampaign,
}: {
  campaign: Campaign
  canEdit: boolean
  updateCampaign: UpdateCampaignMutation
}) {
  const navigate = useNavigate()
  const form = useForm({
    defaultValues: {
      name: campaign.name,
      description: campaign.description,
      slug: String(campaign.slug),
    },
    onSubmit: async ({ value }) => {
      const nextSlug = value.slug.trim()
      try {
        await updateCampaign.mutateAsync({
          campaignId: campaign.id,
          name: value.name.trim(),
          description: value.description.trim(),
          slug: nextSlug,
        })
      } catch {
        return
      }

      toast.success('Campaign settings updated')
      if (nextSlug !== campaign.slug) {
        await navigate({
          to: '/campaigns/$dmUsername/$campaignSlug/editor',
          params: {
            dmUsername: campaign.dmUserProfile.username,
            campaignSlug: nextSlug,
          },
          search: true,
          replace: true,
        })
      }
    },
  })

  return (
    <SettingsSection title="Details">
      <form
        noValidate
        action={() => {
          void form.handleSubmit()
        }}
        className="flex flex-col gap-4"
      >
        <form.Field
          name="name"
          validators={{
            onBlur: ({ value }) => validateCampaignName(value),
            onSubmit: ({ value }) => validateCampaignName(value),
          }}
        >
          {(field) => (
            <CampaignField
              label="Name"
              htmlFor="campaign-settings-name"
              error={field.state.meta.errors[0]}
            >
              <Input
                id="campaign-settings-name"
                value={field.state.value}
                maxLength={CAMPAIGN_NAME_MAX_LENGTH}
                disabled={!canEdit || form.state.isSubmitting}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            </CampaignField>
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <CampaignField label="Description" htmlFor="campaign-settings-description">
              <Textarea
                id="campaign-settings-description"
                value={field.state.value}
                rows={3}
                disabled={!canEdit || form.state.isSubmitting}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            </CampaignField>
          )}
        </form.Field>

        <form.Field
          name="slug"
          validators={{
            onBlur: ({ value }) => validateCampaignSlug(value),
            onSubmit: ({ value }) => validateCampaignSlug(value),
          }}
        >
          {(field) => (
            <CampaignField
              label="Campaign link"
              htmlFor="campaign-settings-slug"
              error={field.state.meta.errors[0]}
              hint="Lowercase letters, numbers, hyphens, and underscores. Changing this breaks existing links."
            >
              <Input
                id="campaign-settings-slug"
                value={field.state.value}
                maxLength={CAMPAIGN_SLUG_MAX_LENGTH}
                autoCapitalize="none"
                spellCheck={false}
                disabled={!canEdit || form.state.isSubmitting}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            </CampaignField>
          )}
        </form.Field>

        {canEdit && (
          <form.Subscribe selector={(state) => state}>
            {(state) => {
              const hasChanges =
                state.values.name.trim() !== campaign.name ||
                state.values.description.trim() !== campaign.description ||
                state.values.slug.trim() !== campaign.slug
              return (
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={!hasChanges || !state.canSubmit || state.isSubmitting}
                  >
                    {state.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    {state.isSubmitting ? 'Saving' : 'Save changes'}
                  </Button>
                </div>
              )
            }}
          </form.Subscribe>
        )}
      </form>
    </SettingsSection>
  )
}

function CampaignField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error?: string | null
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function CampaignGeneralShell({
  children,
  spacing = 'default',
}: {
  children: React.ReactNode
  spacing?: 'compact' | 'default'
}) {
  return (
    <div className={`flex flex-col ${spacing === 'compact' ? 'gap-2' : 'gap-6'}`}>
      <CampaignGeneralHeader />
      {children}
    </div>
  )
}

function CampaignGeneralHeader() {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
        Campaign
      </p>
      <h2 className="text-lg font-semibold">General</h2>
    </div>
  )
}

function NoCampaignGeneralTab() {
  return (
    <CampaignGeneralShell spacing="compact">
      <p className="text-sm text-muted-foreground">Open a campaign to manage campaign settings.</p>
    </CampaignGeneralShell>
  )
}
