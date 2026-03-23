import { CampaignsContent } from '../components/campaigns-content'
import { CampaignsFooter } from '../components/campaigns-footer'
import { CampaignsHeader } from '../components/campaigns-header'
import { UserMenu } from '~/features/auth/components/UserMenu'

export function CampaignSelectionPage() {
  return (
    <div className="flex flex-col flex-1">
      <div className="flex justify-end p-2 border-b bg-background">
        <UserMenu />
      </div>
      <div className="flex flex-col flex-1 p-8">
        <CampaignsHeader />
        <CampaignsContent />
        <CampaignsFooter />
      </div>
    </div>
  )
}
