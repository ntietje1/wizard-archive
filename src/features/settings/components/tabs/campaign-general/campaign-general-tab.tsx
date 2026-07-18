import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useOptionalCampaign } from '~/features/campaigns/hooks/useCampaign'
import { SettingsSection } from '~/features/settings/components/settings-section'
import { Switch } from '@wizard-archive/ui/shadcn/components/switch'
import { useUpdateCampaignMutation } from '~/features/campaigns/hooks/use-campaign-operations'
import { FOLDER_ACCESS_INHERITANCE } from '@wizard-archive/editor/resources/access-policy'

export function CampaignGeneralTab() {
  const campaignContext = useOptionalCampaign()
  const updateCampaign = useUpdateCampaignMutation({
    onError: () => {
      toast.error('Failed to update campaign settings')
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
