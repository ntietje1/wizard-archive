import { Loader2 } from 'lucide-react'
import { api } from 'convex/_generated/api'
import { useOptionalCampaign } from '~/features/campaigns/hooks/useCampaign'
import { SettingsSection } from '~/features/settings/components/tabs/account-profile/components/settings-section'
import { Switch } from '~/features/shadcn/components/switch'
import { useAppMutation } from '~/shared/hooks/useAppMutation'

export function CampaignGeneralTab() {
  const campaignContext = useOptionalCampaign()
  const updateCampaign = useAppMutation(api.campaigns.mutations.updateCampaign)

  if (!campaignContext) return <NoCampaignGeneralTab />

  const campaign = campaignContext.campaign.data

  if (campaignContext.campaign.isLoading || (!campaign && !campaignContext.campaign.isError)) {
    return (
      <CampaignGeneralShell>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
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
    updateCampaign.variables?.campaignId === campaign._id &&
    updateCampaign.variables.defaultFolderInheritShares !== undefined
      ? updateCampaign.variables.defaultFolderInheritShares
      : undefined
  const shareFolderContentsByDefault = pendingValue ?? campaign.defaultFolderInheritShares
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
            checked={shareFolderContentsByDefault}
            disabled={!canEdit || updateCampaign.isPending}
            onCheckedChange={(defaultFolderInheritShares) => {
              void updateCampaign.mutateAsync({
                campaignId: campaign._id,
                defaultFolderInheritShares,
              })
            }}
          />
        </div>
      </SettingsSection>
    </CampaignGeneralShell>
  )
}

function CampaignGeneralShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
          Campaign
        </p>
        <h2 className="text-lg font-semibold">General</h2>
      </div>
      {children}
    </div>
  )
}

function NoCampaignGeneralTab() {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
          Campaign
        </p>
        <h2 className="text-lg font-semibold">General</h2>
      </div>
      <p className="text-sm text-muted-foreground">Open a campaign to manage campaign settings.</p>
    </div>
  )
}
